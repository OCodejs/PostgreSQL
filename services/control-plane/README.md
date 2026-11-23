# PostgreSQL Control Plane Service

Node.js 22 service isolated from the Vite dashboard. Install dependencies in this directory and run `npm start` for the health API or `npm run worker` for the queue worker.

## Environment

- `DATABASE_URL`: required PostgreSQL connection string, set only in the hosting provider's secret manager.
- `PG_POOL_MAX`: optional pool size (default 5).
- `PGSSL`: set to `disable` only for local disposable development. Hosted staging must use TLS.
- `PORT`: API port (default 8787).
- `WORKER_ID`, `JOB_LEASE_SECONDS`, `WORKER_POLL_MS`: worker tuning.

## Identity and API

- Firebase ID tokens are verified with Google's Secure Token JWKS, issuer and audience.
- Set `FIREBASE_PROJECT_ID` to the existing dashboard project ID (`gen-lang-client-0367464144`). Do not use the unrelated sample project from another repository.
- `GET /healthz`: process liveness only; does not claim database connectivity.
- `GET /readyz`: performs a real PostgreSQL query. Returns 503 when unconfigured or disconnected.
- `GET/POST /api/v1/workspaces`: list and create workspaces for the authenticated Firebase UID.
- `GET /api/v1/workspaces/:id`: read only after membership verification.
- `POST /api/v1/workspaces/:id/jobs`: editor/owner only; requires `Idempotency-Key`; currently accepts only `kind=noop`.
- `POST /api/v1/jobs/:id/cancel`: editor/owner only; queued jobs cancel immediately and running jobs receive a cooperative cancellation request.

Set `CONTROL_PLANE_CORS_ORIGINS` to an explicit comma-separated allowlist of dashboard origins. No wildcard origin is used. All workspace and job queries are tenant-scoped through `workspace_members`. Rate limiting and additional audit coverage are still required before public exposure.

## Worker safety

Only `kind=noop` is accepted. Unsupported kinds fail closed. This is queue plumbing validation, not arbitrary code execution. Do not connect a runner or enable user workloads until isolated runtime tests pass.
