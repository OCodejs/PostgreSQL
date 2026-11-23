import { createServer } from 'node:http';
import { getPool, closePool } from './db.mjs';
import { authenticateRequest } from './auth.mjs';

const port = Number(process.env.PORT || 8787);
const allowedOrigins = new Set(
  (process.env.CONTROL_PLANE_CORS_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)
);

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32 * 1024) {
      const error = new Error('request_too_large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_json_object');
    return value;
  } catch {
    const error = new Error('invalid_json');
    error.statusCode = 400;
    throw error;
  }
}

async function requireMembership(client, workspaceId, uid, write = false) {
  const result = await client.query(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND member_uid = $2',
    [workspaceId, uid]
  );
  const role = result.rows[0]?.role;
  if (!role || (write && !['owner', 'editor'].includes(role))) {
    const error = new Error('workspace_not_found_or_forbidden');
    error.statusCode = 404;
    throw error;
  }
  return role;
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
  }
  if (req.method === 'OPTIONS' && origin && allowedOrigins.has(origin)) {
    res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    res.setHeader('access-control-allow-headers', 'Authorization, Content-Type, Idempotency-Key');
    res.writeHead(204).end();
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/healthz') {
    send(res, 200, { service: 'ocodejs-control-plane', status: 'alive' });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/readyz') {
    try {
      const result = await getPool().query(
        "SELECT current_timestamp AS checked_at, current_setting('server_version') AS postgres_version"
      );
      send(res, 200, {
        service: 'ocodejs-control-plane',
        status: 'ready',
        database: { connected: true, version: result.rows[0].postgres_version, checkedAt: result.rows[0].checked_at }
      });
    } catch {
      send(res, 503, {
        service: 'ocodejs-control-plane',
        status: 'not_ready',
        database: { connected: false, reason: process.env.DATABASE_URL ? 'connection_failed' : 'unconfigured' }
      });
    }
    return;
  }

  let client;
  try {
    const identity = await authenticateRequest(req);
    client = await getPool().connect();

    if (req.method === 'GET' && url.pathname === '/api/v1/workspaces') {
      const result = await client.query(`
        SELECT w.id, w.name, w.owner_uid, m.role, w.created_at, w.updated_at
        FROM workspaces w
        JOIN workspace_members m ON m.workspace_id = w.id
        WHERE m.member_uid = $1
        ORDER BY w.created_at DESC
        LIMIT 100
      `, [identity.uid]);
      send(res, 200, { workspaces: result.rows });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/v1/workspaces') {
      const body = await readJson(req);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name || name.length > 120) {
        send(res, 400, { error: 'invalid_workspace_name' });
        return;
      }
      await client.query('BEGIN');
      try {
        const created = await client.query(
          'INSERT INTO workspaces(owner_uid, name) VALUES ($1, $2) RETURNING id, name, owner_uid, created_at',
          [identity.uid, name]
        );
        const workspace = created.rows[0];
        await client.query(
          "INSERT INTO workspace_members(workspace_id, member_uid, role) VALUES ($1, $2, 'owner')",
          [workspace.id, identity.uid]
        );
        await client.query(
          "INSERT INTO audit_events(workspace_id, actor_uid, action, resource_type, resource_id) VALUES ($1, $2, 'workspace.created', 'workspace', $3)",
          [workspace.id, identity.uid, workspace.id]
        );
        await client.query('COMMIT');
        send(res, 201, { workspace });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      return;
    }

    const workspaceMatch = url.pathname.match(/^\/api\/v1\/workspaces\/([0-9a-f-]{36})$/i);
    if (req.method === 'GET' && workspaceMatch) {
      const workspaceId = workspaceMatch[1];
      await requireMembership(client, workspaceId, identity.uid);
      const result = await client.query(
        'SELECT id, name, owner_uid, created_at, updated_at FROM workspaces WHERE id = $1',
        [workspaceId]
      );
      send(res, 200, { workspace: result.rows[0] });
      return;
    }

    const jobsMatch = url.pathname.match(/^\/api\/v1\/workspaces\/([0-9a-f-]{36})\/jobs$/i);
    if (req.method === 'POST' && jobsMatch) {
      const workspaceId = jobsMatch[1];
      await requireMembership(client, workspaceId, identity.uid, true);
      const idempotencyKey = String(req.headers['idempotency-key'] || '').trim();
      if (!idempotencyKey || idempotencyKey.length > 200) {
        send(res, 400, { error: 'idempotency_key_required' });
        return;
      }
      const body = await readJson(req);
      const kind = typeof body.kind === 'string' ? body.kind : '';
      if (kind !== 'noop') {
        send(res, 400, { error: 'unsupported_job_kind', allowed: ['noop'] });
        return;
      }
      const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload) ? body.payload : {};
      await client.query('BEGIN');
      try {
        const inserted = await client.query(`
          INSERT INTO jobs(workspace_id, kind, payload, idempotency_key)
          VALUES ($1, $2, $3::jsonb, $4)
          ON CONFLICT (workspace_id, idempotency_key) DO NOTHING
          RETURNING id, workspace_id, kind, status, attempts, created_at
        `, [workspaceId, kind, JSON.stringify(payload), idempotencyKey]);
        let job = inserted.rows[0];
        const created = Boolean(job);
        if (!job) {
          const existing = await client.query(
            'SELECT id, workspace_id, kind, status, attempts, created_at FROM jobs WHERE workspace_id = $1 AND idempotency_key = $2',
            [workspaceId, idempotencyKey]
          );
          job = existing.rows[0];
        } else {
          await client.query(
            "INSERT INTO audit_events(workspace_id, actor_uid, action, resource_type, resource_id, metadata) VALUES ($1, $2, 'job.queued', 'job', $3, $4::jsonb)",
            [workspaceId, identity.uid, job.id, JSON.stringify({ kind })]
          );
        }
        await client.query('COMMIT');
        send(res, created ? 202 : 200, { job, idempotentReplay: !created });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      return;
    }

    const cancelMatch = url.pathname.match(/^\/api\/v1\/jobs\/([0-9a-f-]{36})\/cancel$/i);
    if (req.method === 'POST' && cancelMatch) {
      const jobId = cancelMatch[1];
      await client.query('BEGIN');
      try {
        const found = await client.query(`
          SELECT j.id, j.workspace_id, j.status
          FROM jobs j JOIN workspace_members m ON m.workspace_id = j.workspace_id
          WHERE j.id = $1 AND m.member_uid = $2 AND m.role IN ('owner', 'editor')
          FOR UPDATE OF j
        `, [jobId, identity.uid]);
        if (!found.rowCount) {
          await client.query('ROLLBACK');
          send(res, 404, { error: 'job_not_found_or_forbidden' });
          return;
        }
        const job = found.rows[0];
        const updated = await client.query(`
          UPDATE jobs
          SET status = CASE WHEN status = 'queued' THEN 'cancelled' ELSE status END,
              cancel_requested_at = COALESCE(cancel_requested_at, now()),
              finished_at = CASE WHEN status = 'queued' THEN now() ELSE finished_at END,
              updated_at = now()
          WHERE id = $1 AND status IN ('queued', 'running')
          RETURNING id, status, cancel_requested_at
        `, [jobId]);
        await client.query(
          "INSERT INTO audit_events(workspace_id, actor_uid, action, resource_type, resource_id) VALUES ($1, $2, 'job.cancel_requested', 'job', $3)",
          [job.workspace_id, identity.uid, jobId]
        );
        await client.query('COMMIT');
        send(res, 200, { job: updated.rows[0] || { id: jobId, status: job.status } });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      return;
    }

    send(res, 404, { error: 'not_found' });
  } catch (error) {
    const status = Number(error?.statusCode) || (error?.message === 'DATABASE_URL is not configured' ? 503 : error?.code === '23503' ? 404 : 500);
    send(res, status, { error: status === 500 ? 'internal_error' : error.message });
  } finally {
    client?.release();
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', event: 'server_started', port }));
});

async function shutdown(signal) {
  console.log(JSON.stringify({ level: 'info', event: 'shutdown', signal }));
  server.close(async () => {
    await closePool();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
