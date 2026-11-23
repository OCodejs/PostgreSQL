# Identity CI and Preview gate

This file is intentionally tracked under `services/identity` so changes to the Identity service trigger `.github/workflows/identity-ci.yml`.

## CI contract

The Identity CI job uses only:
- GitHub-hosted Ubuntu runner
- Node.js 22
- an ephemeral PostgreSQL 16 service container
- synthetic credentials and a disposable database created for the job

The job must run, in order:
1. Install dependencies with native build scripts enabled (Argon2id).
2. Typecheck and build the service.
3. Apply the Identity migrations to the ephemeral CI database only.
4. Run unit and PostgreSQL-backed authentication lifecycle tests.

No Neon, Firebase, Cloudflare D1, external DATABASE_URL, Production secret, or live OAuth credential is used by this CI workflow.

## Preview release gate

A separate Neon Preview database is required before any live service deployment. The database must be created under the OCodeJS Neon Free plan, with a small compute size and scale-to-zero. Do not migrate or copy Firebase/Firestore or D1 production data during initial validation.

The Preview migration gate is:
- verify the target project is on Free ($0/month) before provisioning;
- use a dedicated Preview database and role;
- run migrations and verify schema/table constraints;
- exercise register, verify-email, login, CSRF, /me, logout, session revocation, and account recovery;
- record rollback instructions and retain Firebase as the active Control Plane authentication provider.

GitHub OAuth federation must not move from Cloudflare D1 to PostgreSQL until token encryption, OAuth state/PKCE validation, account linking, callback URLs, session issuance, and rollback are tested end-to-end.
