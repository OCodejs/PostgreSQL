import { randomUUID } from 'node:crypto';
import { getPool, closePool } from './db.mjs';

const workerId = process.env.WORKER_ID || `worker-${randomUUID()}`;
const leaseSeconds = Math.min(300, Math.max(15, Number(process.env.JOB_LEASE_SECONDS || 60)));
const pollMs = Math.min(30_000, Math.max(250, Number(process.env.WORKER_POLL_MS || 1500)));
let stopping = false;

async function recoverExpiredLeases(client) {
  await client.query(\`UPDATE jobs SET status = 'cancelled', updated_at = now(), finished_at = now() WHERE status = 'queued' AND cancel_requested_at IS NOT NULL\`);
  await client.query(`
    UPDATE jobs
    SET status = CASE WHEN attempts >= max_attempts THEN 'dead_letter' ELSE 'queued' END,
        locked_by = NULL,
        lease_expires_at = NULL,
        available_at = CASE
          WHEN attempts >= max_attempts THEN available_at
          ELSE now() + make_interval(secs => LEAST(300, (2 ^ LEAST(attempts, 8))::int))
        END,
        last_error = COALESCE(last_error, 'worker lease expired'),
        updated_at = now(),
        finished_at = CASE WHEN attempts >= max_attempts THEN now() ELSE NULL END
    WHERE status = 'running' AND lease_expires_at < now()
  `);
}

async function claimJob(client) {
  await client.query('BEGIN');
  try {
    const result = await client.query(`
      WITH candidate AS (
        SELECT id FROM jobs
        WHERE status = 'queued' AND available_at <= now()
          AND cancel_requested_at IS NULL
        ORDER BY available_at, created_at
        FOR UPDATE SKIP LOCKED LIMIT 1
      )
      UPDATE jobs AS j
      SET status = 'running', locked_by = $1,
          lease_expires_at = now() + make_interval(secs => $2),
          attempts = attempts + 1, updated_at = now()
      FROM candidate
      WHERE j.id = candidate.id
      RETURNING j.*
    `, [workerId, leaseSeconds]);
    await client.query('COMMIT');
    return result.rows[0] || null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function finishJob(client, job, status, result, errorMessage = null) {
  await client.query(`
    UPDATE jobs
    SET status = CASE WHEN $3 = 'failed' AND attempts < max_attempts THEN 'queued' ELSE CASE WHEN $3 = 'failed' THEN 'dead_letter' ELSE $3 END END,
        result = $4::jsonb, last_error = $5,
        available_at = CASE WHEN $3 = 'failed' AND attempts < max_attempts
          THEN now() + make_interval(secs => LEAST(300, (2 ^ LEAST(attempts, 8))::int)) ELSE available_at END,
        locked_by = NULL, lease_expires_at = NULL,
        updated_at = now(), finished_at = CASE WHEN $3 = 'failed' AND attempts < max_attempts THEN NULL ELSE now() END
    WHERE id = $1 AND locked_by = $2 AND status = 'running'
  `, [job.id, workerId, status, JSON.stringify(result), errorMessage]);
}

async function runJob(client, job) {
  // Deliberately allowlist only a no-op probe. User code execution is disabled.
  if (job.kind !== 'noop') {
    await finishJob(client, job, 'failed', { accepted: false }, 'unsupported_job_kind');
    return;
  }

  const lease = await client.query(`
    UPDATE jobs SET lease_expires_at = now() + make_interval(secs => $3), updated_at = now()
    WHERE id = $1 AND locked_by = $2 AND status = 'running'
      AND lease_expires_at > now()
    RETURNING id
  `, [job.id, workerId, leaseSeconds]);

  if (!lease.rowCount) return;

  const cancelled = await client.query(
    'SELECT cancel_requested_at FROM jobs WHERE id = $1 AND locked_by = $2',
    [job.id, workerId]
  );
  if (cancelled.rows[0]?.cancel_requested_at) {
    await finishJob(client, job, 'cancelled', { cancelled: true });
    return;
  }

  await finishJob(client, job, 'succeeded', { kind: 'noop', completedAt: new Date().toISOString() });
}

async function main() {
  const pool = getPool();
  console.log(JSON.stringify({ level: 'info', event: 'worker_started', workerId }));
  while (!stopping) {
    const client = await pool.connect();
    try {
      await recoverExpiredLeases(client);
      const job = await claimJob(client);
      if (job) {
        try {
          await runJob(client, job);
        } catch (error) {
          await finishJob(client, job, 'failed', null, String(error?.message || 'job_failed').slice(0, 1000));
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, pollMs));
      }
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', event: 'worker_iteration_failed', message: error.message }));
      await new Promise((resolve) => setTimeout(resolve, Math.min(30_000, pollMs * 4)));
    } finally {
      client.release();
    }
  }
  await closePool();
}

process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });

main().catch(async (error) => {
  console.error(JSON.stringify({ level: 'fatal', event: 'worker_stopped', message: error.message }));
  await closePool();
  process.exit(1);
});
