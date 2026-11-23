# OCodeJS Identity Service

This directory contains the canonical Node.js identity service imported from OCodejs/oauth into the PostgreSQL infrastructure repository. It is a separately deployable Fastify service, not part of the Vite dashboard runtime.

## Included capabilities

- Email/password registration with Argon2id.
- Email verification and password-reset tokens (single-use, hashed at rest).
- Opaque HttpOnly browser sessions; only SHA-256 token hashes are stored.
- Signed double-submit CSRF and exact-origin CORS.
- Rate limiting and security audit events.
- PostgreSQL persistence and explicit migrations.

GitHub/Google upstream federation and an OAuth 2.0 / OIDC issuer are not implemented in this Node service yet. The existing Cloudflare `ocodejs-auth` Worker remains a separate transitional OAuth/D1 implementation; its users, sessions and credentials are not automatically shared with this PostgreSQL identity store.

## Run locally

Requires Node.js 22+, PostgreSQL 14+, and SMTP for production email delivery.

```sh
cd services/identity
npm install
cp .env.example .env
npm run typecheck
npm test
npm run build
```

Set `DATABASE_URL`, independent 32+ character `SESSION_SECRET` and `CSRF_SECRET`, exact `WEB_ORIGINS`, `APP_BASE_URL`, and SMTP values in the runtime secret manager. Never commit `.env`.

Apply migrations only to an explicitly provisioned isolated database:

```sh
npm run db:migrate
npm run dev
```

The identity migration runner uses its own `identity_schema_migrations` ledger. This intentionally avoids colliding with the existing control-plane `schema_migrations(version, checksum)` table in the same PostgreSQL database.

## Routes

- `GET /health`
- `GET /api/v1/auth/csrf`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/request-password-reset`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/me`
- `POST /api/v1/auth/logout`

State-changing browser requests require the CSRF cookie and matching `X-CSRF-Token` header. Use `credentials: "include"`.

## Data boundary

The identity migrations create `users`, `user_sessions`, `audit_logs`, and `account_action_tokens`. They do not alter or delete Firebase/Firestore data, Control Plane workspaces, jobs, memberships or audit_events. Workspace ownership currently uses Firebase UID strings; mapping those identities to the new immutable identity UUID is a later, explicit migration gate. Never merge accounts by email alone.

## Safety

- This import is source integration only; it does not provision a database or deploy the service.
- Do not run migrations against Production.
- Keep the old Firebase login path active until Preview parity and rollback are proven.
- No Production cutover, DNS changes, secret migration or PR merge is included.
