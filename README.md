# OCodeJS PostgreSQL Infrastructure Control Center

> PostgreSQL operations dashboard and the staging-first control-plane foundation for OCodeJS.

[![Control Plane CI](https://github.com/OCodejs/PostgreSQL/actions/workflows/control-plane-ci.yml/badge.svg)](https://github.com/OCodejs/PostgreSQL/actions/workflows/control-plane-ci.yml)

This repository contains two related but separately deployable parts:

1. **Infrastructure dashboard** — a React, TypeScript and Vite UI. Its existing Firebase Authentication and Firestore integrations remain in place.
2. **PostgreSQL control plane** — a separate Node.js 22 service, PostgreSQL schema/migrations and a queue-worker foundation under `services/control-plane`.

The dashboard is not a PostgreSQL hosting provider. A live database, worker, or production environment must not be inferred from the presence of configuration screens or sample charts.

## Current implementation status

| Capability | Status |
|---|---|
| Existing React/Vite dashboard | Present |
| Firebase client authentication | Present; uses the repository's Firebase app configuration |
| Existing Firestore persistence | Present; retained and not migrated by this work |
| PostgreSQL control-plane schema | Added; not yet applied to a database |
| Explicit migration runner | Added; not yet executed |
| Firebase ID-token verification in control-plane | Added; requires project configuration and end-to-end verification |
| Workspace list/create/read API | Added; requires a live staging database and API tests |
| Workspace membership enforcement | Basic owner/editor/viewer membership model in schema; member-management endpoints are not yet implemented in this service |
| Idempotent job enqueue and cancellation API | Added for the `noop` job kind only |
| Queue worker | Foundation added; only `noop` jobs are allowed |
| Isolated execution runtime | Not implemented; arbitrary user code execution is disabled |
| Real PostgreSQL hosting | Not provisioned |
| Live telemetry, backups and replicas | Not connected; dashboard sample values must be treated as demo data |
| Production deployment | Not performed |

**Do not use this project as a production database control plane yet.** Authentication, authorization, API rate limiting, audit coverage, queue race/recovery behavior and sandbox isolation still need integration and security testing.

## Architecture

```text
React + Vite Dashboard
  |-- Firebase Authentication (existing identity)
  |-- Firestore (existing dashboard/config data)
  |
  +---- optional VITE_CONTROL_PLANE_URL
              |
              v
      Node.js 22 Control Plane
        |-- Firebase ID-token verification (jose + Google JWKS)
        |-- Workspace API and membership checks
        |-- Job enqueue / idempotency / cancellation
        |
        v
      PostgreSQL 16 (dedicated staging database)
        |-- workspaces
        |-- workspace_members
        |-- jobs
        |-- audit_events
        |-- schema_migrations
        |
        v
      Queue Worker
        |-- SKIP LOCKED claim
        |-- leases and expired-lease recovery
        |-- bounded retry / dead-letter
        |-- noop handler only
        |
        X  No arbitrary code runner is connected
```

The PostgreSQL control plane is deliberately separate from the existing Firebase/Firestore persistence. No existing Firestore collections are migrated or deleted by the SQL migration.

## Repository layout

```text
.
├── .github/workflows/
│   └── control-plane-ci.yml
├── infra/
│   ├── README.md
│   ├── postgres/
│   │   ├── README.md
│   │   └── migrations/
│   │       └── 001_control_plane.sql
│   └── worker/
│       └── README.md
├── services/
│   └── control-plane/
│       ├── package.json
│       ├── README.md
│       ├── scripts/
│       │   └── migrate.mjs
│       └── src/
│           ├── auth.mjs
│           ├── db.mjs
│           ├── server.mjs
│           └── worker.mjs
├── src/
│   ├── components/
│   │   └── InfrastructureStatus.tsx
│   └── lib/
│       ├── firebase.ts
│       └── firestoreStore.ts
├── firebase-applet-config.json
├── package.json
└── .env.example
```

## Requirements

- Node.js **22 or later** for the control-plane service.
- npm (or a compatible package manager) for dependency installation.
- A dedicated PostgreSQL 16 staging database for integration work.
- A Firebase project with Authentication enabled and the Google provider configured.
- HTTPS and a secret manager for any deployed environment.

Do not put credentials in source files, frontend `VITE_*` variables, commits, issue comments or chat messages.

## Local development

### 1. Dashboard and existing application

Install the repository's frontend dependencies:

```bash
npm install
```

Copy `.env.example` to a local `.env` and provide only the values required by the existing app. Keep server-only credentials out of browser-exposed variables.

The root scripts currently defined in `package.json` are:

```bash
npm run dev
npm run build
npm run preview
npm run lint
```

The root `dev` script starts the existing Express/TypeScript server through `tsx`. The Vite frontend build is performed by `npm run build`. Check `server.ts` and `vite.config.ts` before changing the existing development topology.

### 2. Control-plane service

Install dependencies in the isolated service package:

```bash
cd services/control-plane
npm install
npm run check
```

The service package scripts are:

- `npm start` — start the control-plane HTTP service.
- `npm run worker` — start the queue worker.
- `npm run migrate` — apply pending SQL migrations explicitly.
- `npm run check` — run Node.js syntax checks for service and migration scripts.
- `npm test` — run Node.js unit tests (currently authentication fail-closed checks).

No automatic migration runs during API startup.

### 3. Environment variables

Configure these variables in the runtime's secret manager for the control-plane service:

| Variable | Purpose |
|---|---|
| `FIREBASE_PROJECT_ID` | Firebase project ID used as JWT issuer and audience |
| `DATABASE_URL` | PostgreSQL connection string; server-side secret only |
| `PG_POOL_MAX` | Maximum PostgreSQL pool size; defaults to 5 |
| `PORT` | HTTP listen port; defaults to 8787 |
| `CONTROL_PLANE_CORS_ORIGINS` | Comma-separated exact dashboard origins allowed to call readiness/API endpoints |
| `JOB_LEASE_SECONDS` | Worker lease duration; defaults to 60 seconds |
| `WORKER_POLL_MS` | Idle queue polling interval; defaults to 1500 ms |
| `WORKER_ID` | Optional stable worker identifier |

The database pool requires TLS by default and verifies the server certificate. Do not disable certificate verification in hosted staging or production.

For the dashboard, `VITE_CONTROL_PLANE_URL` is an optional public base URL for the separate control-plane service. It must never contain a database URL or secret. Leave it unset until a staging service has actually been deployed.

The existing `.env.example` also contains variables for the current applet and GitHub OAuth integration. Those settings are separate from the control-plane service.

## PostgreSQL staging setup

1. Create a **dedicated, empty staging database** on a provider/plan confirmed to have no charge or billing commitment.
2. Use a database role with only the privileges required by this schema and application.
3. Enable TLS and store the connection string in the deployment provider's secret manager.
4. Set `FIREBASE_PROJECT_ID` to the same Firebase project used by the dashboard.
5. Run the migration explicitly from `services/control-plane`:

   ```bash
   npm run migrate
   ```

6. Verify the migration ledger and created tables:

   ```sql
   SELECT version, checksum, applied_at
   FROM schema_migrations
   ORDER BY version;

   SELECT to_regclass('public.workspaces');
   SELECT to_regclass('public.workspace_members');
   SELECT to_regclass('public.jobs');
   SELECT to_regclass('public.audit_events');
   ```

7. Start the service and check its health endpoints.

The migration runner uses a PostgreSQL advisory lock and SHA-256 checksums. Review the SQL before applying it. Do not run it against production or an existing application database as a first test.

## HTTP endpoints

The current service exposes the following routes:

| Method | Path | Authentication | Description |
|---|---|---|---|
| GET | `/healthz` | No | Process liveness only |
| GET | `/readyz` | No | Executes a real database query; returns 503 when unconfigured/unavailable |
| GET | `/api/v1/workspaces` | Firebase ID token | List workspaces for the authenticated UID |
| POST | `/api/v1/workspaces` | Firebase ID token | Create a workspace and owner membership |
| GET | `/api/v1/workspaces/:id` | Firebase ID token + membership | Read a workspace |
| POST | `/api/v1/workspaces/:id/jobs` | Firebase ID token + editor/owner role | Enqueue a supported job; requires `Idempotency-Key` |
| POST | `/api/v1/jobs/:id/cancel` | Firebase ID token + editor/owner role | Cancel a queued job or request cancellation of a running job |

Example health check:

```bash
curl -i https://CONTROL-PLANE-HOST/healthz
curl -i https://CONTROL-PLANE-HOST/readyz
```

Example authenticated workspace creation:

```bash
curl -X POST https://CONTROL-PLANE-HOST/api/v1/workspaces \
  -H "Authorization: Bearer FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"name":"OCodeJS staging"}'
```

Example enqueue (only `noop` is accepted):

```bash
curl -X POST https://CONTROL-PLANE-HOST/api/v1/workspaces/WORKSPACE_UUID/jobs \
  -H "Authorization: Bearer FIREBASE_ID_TOKEN" \
  -H "Idempotency-Key: staging-probe-001" \
  -H "Content-Type: application/json" \
  --data '{"kind":"noop","payload":{}}'
```

Never use the placeholder token or host literally. Obtain an ID token through the configured Firebase client session and send it only over HTTPS.

## Queue and worker behavior

The worker foundation implements:

- Transactional job claim with `FOR UPDATE SKIP LOCKED`.
- Worker ownership and expiring leases.
- Expired-lease recovery.
- Attempt limits and bounded retry backoff.
- Dead-letter state after attempts are exhausted.
- Cancellation flags and queued-job cancellation.
- Idempotent enqueue through a unique workspace/idempotency-key constraint.

Only `kind=noop` is supported. The worker is **not** an arbitrary command runner and must not be extended to execute user-supplied shell commands in the service process.

Before production use, add and pass integration tests for concurrent claims, duplicate idempotency keys, worker crashes, lease expiry, retry boundaries, cancellation races, tenant isolation and audit completeness.

## Security model and deployment gates

- Firebase ID tokens are verified server-side against Google's Secure Token JWKS, issuer and audience.
- Workspace data access is scoped by authenticated Firebase UID and membership.
- Write operations require owner/editor membership.
- Database credentials remain server-side.
- CORS must use an explicit origin allowlist; do not configure wildcard origins.
- Public deployment still requires rate limiting, request logging/redaction, hardened headers, operational alerting and a complete authorization review.
- Worker execution must remain disabled for user workloads until a separate non-root sandbox is implemented and escape/cross-tenant tests pass.

Required sandbox controls include no privileged containers, no host mounts or Docker socket, read-only root filesystem, resource limits, process-tree termination, default-deny network egress and per-job filesystem isolation.

## CI

The workflow `.github/workflows/control-plane-ci.yml` runs on pull requests that change the control-plane or PostgreSQL infrastructure paths, and can also be manually dispatched.

It installs the service package dependencies, runs Node.js syntax checks, executes the Node.js unit tests and verifies that the migration file exists. The current unit tests cover missing bearer-token and missing Firebase project configuration behavior. This is still **not a PostgreSQL integration test**. A green run does not prove that a database has been provisioned, migrations have been applied, Firebase tokens work end-to-end or worker concurrency is correct.

## Troubleshooting

### `/readyz` returns 503

- Confirm `DATABASE_URL` exists in the service environment.
- Confirm the database host is reachable from the service.
- Check TLS/certificate configuration and database role permissions.
- Do not expose the connection string in logs or screenshots.

### API returns `authentication_not_configured`

Set `FIREBASE_PROJECT_ID` in the control-plane runtime and redeploy the service. The value must match the Firebase project that issued the ID token.

### Browser reports a CORS error

Set `CONTROL_PLANE_CORS_ORIGINS` to the exact scheme + hostname + port of the dashboard origin. Do not use `*`.

### Queue jobs remain queued

Confirm the worker process is running, that it uses the same staging `DATABASE_URL`, and that its role can update queue rows. Inspect job status, `available_at`, attempt count and lease fields in staging.

## Operational policy

- Preview/staging first.
- No production deployment or database migration without explicit approval.
- No paid resource creation without a clear cost estimate and approval.
- No automatic PR merge.
- Do not change `main` as part of feature work.
- Preserve the existing Firebase/Firestore data and application behavior.
- Report CI, database, migration and deployment status only after verifying the corresponding live result.

## Further documentation

- [Infrastructure architecture](infra/README.md)
- [PostgreSQL schema and migration guide](infra/postgres/README.md)
- [Worker lifecycle and isolation requirements](infra/worker/README.md)
- [Control-plane service guide](services/control-plane/README.md)
- [Security specification](security_spec.md)
- [GitHub Actions](https://github.com/OCodejs/PostgreSQL/actions)


## Unified Identity Service (Preview integration)

The canonical Fastify + PostgreSQL identity implementation is now vendored under `services/identity` from [OCodejs/oauth](https://github.com/OCodejs/oauth). It is kept as a separately deployable service boundary alongside the existing PostgreSQL Control Plane.

- [Identity service guide](services/identity/README.md)
- Email/password, Argon2id, email verification, password reset, opaque HttpOnly sessions, CSRF and audit logs are included in source.
- Identity migrations use `identity_schema_migrations`, separate from the Control Plane migration ledger.
- The current Control Plane still verifies Firebase ID tokens. Firebase/Firestore and workspace owner UIDs remain unchanged during this Preview integration.
- GitHub/Google upstream federation and an OIDC issuer are not yet implemented in the Node identity service. The existing Cloudflare D1 OAuth Worker remains a separate transitional runtime and is not automatically synchronized with PostgreSQL.
- No identity data was copied, no database migration was executed, and no Production service was deployed by this source import.

Do not switch consumers or disable Firebase until an isolated Preview database, CI, browser session flow, identity mapping and rollback plan have all been verified.
