# OCodeJS PostgreSQL Control Plane

This directory defines the PostgreSQL persistence contract for OCodeJS Infrastructure Studio. It is **not a hosted database** and does not provision cloud resources.

## Deployment boundary

- PostgreSQL 16 is the target baseline.
- Use a dedicated staging database and a dedicated least-privilege role.
- Never point this migration at production or an existing Firebase/Firestore project.
- Keep `DATABASE_URL` in the deployment provider's secret manager. Never commit it or paste it into chat.
- TLS must be enabled by the database provider. Do not disable certificate verification to make a connection work.
- The migration is additive and creates isolated control-plane tables. It does not alter existing application tables.

## Schema

- `workspaces` and `workspace_members`: tenant and membership boundary.
- `jobs`: durable queue, per-workspace idempotency, attempts, lease and cancellation state.
- `audit_events`: append-only control-plane audit trail.
- `schema_migrations`: migration version/checksum ledger.

All application reads and writes must scope workspace resources through a membership check. A UUID is an identifier, not an authorization mechanism.

## Queue protocol

1. Enqueue in a transaction with a unique `(workspace_id, idempotency_key)`.
2. Claim using `FOR UPDATE SKIP LOCKED`; update status, worker ID, attempt count and lease in the same transaction.
3. A worker may execute only while it owns an unexpired lease.
4. Heartbeat extends a lease only when `id`, `locked_by` and `status='running'` still match.
5. Reaper returns expired leases to `queued` with bounded exponential backoff, or moves exhausted jobs to `dead_letter`.
6. Cancellation is cooperative: workers poll `cancel_requested_at` and stop before committing side effects.
7. Every transition writes an audit event. External side effects must use idempotency keys or an outbox.

Suggested claim statement:

```sql
WITH candidate AS (
  SELECT id
  FROM jobs
  WHERE status = 'queued'
    AND available_at <= now()
    AND cancel_requested_at IS NULL
  ORDER BY available_at, created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE jobs AS j
SET status = 'running',
    locked_by = $1,
    lease_expires_at = now() + interval '60 seconds',
    attempts = attempts + 1,
    updated_at = now()
FROM candidate
WHERE j.id = candidate.id
RETURNING j.*;
```

## Migration

Review SQL before applying. Run against an empty staging database first, then verify:

- `SELECT version, applied_at FROM schema_migrations ORDER BY version;`
- `SELECT count(*) FROM workspaces;`
- `SELECT count(*) FROM jobs;`

Do not run migrations automatically at API startup. A separate, explicitly invoked migration job is required.

## Current status

The repository currently has no provisioned PostgreSQL endpoint, no worker deployment and no verified database credentials. This schema is a reviewed starting point, not evidence that a live database exists.