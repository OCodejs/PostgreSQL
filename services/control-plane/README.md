# PostgreSQL Control Plane Service

Node.js 22 service isolated from the Vite dashboard. Install dependencies in this directory and run `npm start` for the health API or `npm run worker` for the queue worker.

## Environment

- `DATABASE_URL`: required PostgreSQL connection string, set only in the hosting provider's secret manager.
- `PG_POOL_MAX`: optional pool size (default 5).
- `PGSSL`: set to `disable` only for local disposable development. Hosted staging must use TLS.
- `PORT`: API port (default 8787).
- `WORKER_ID`, `JOB_LEASE_SECONDS`, `WORKER_POLL_MS`: worker tuning.

## Endpoints

- `GET /healthz`: process liveness only; does not claim database connectivity.
- `GET /readyz`: performs a real PostgreSQL query. Returns 503 when unconfigured or disconnected.

No workspace API routes are exposed yet. Do not expose this service publicly until Firebase ID-token verification, workspace RBAC, rate limiting and audit enforcement are implemented.

## Worker safety

Only `kind=noop` is accepted. Unsupported kinds fail closed. This is queue plumbing validation, not arbitrary code execution. Do not connect a runner or enable user workloads until isolated runtime tests pass.
