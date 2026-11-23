# Infrastructure Control Center

The existing React dashboard is a control-plane UI, not a PostgreSQL hosting service. Mock cluster metrics, backups, replicas and uptime must remain visibly labeled as sample data until backed by authenticated telemetry.

Architecture target:

```
React Dashboard
   | Firebase identity (existing)
   v
Control API ---- PostgreSQL 16 (staging first)
   |                    |
   |                    +-- workspaces / RBAC / audit
   |                    +-- durable jobs / idempotency
   v
Queue Worker ---- Isolated per-job runtime (disabled until security tests pass)
```

## Separation of responsibilities

- Dashboard: presentation, user actions and operational visibility.
- Control API: identity verification, authorization, validation and durable state transitions.
- PostgreSQL: source of truth for control-plane state.
- Worker: queue processing and lifecycle management.
- Sandbox runtime: executes only allowlisted workloads under isolation.

Firebase Auth remains the identity provider in this phase. Firestore-backed preferences and existing user data are not migrated or deleted.

## Safety gates

- Staging database only; no production connection string.
- No paid cloud resource creation without explicit cost approval.
- No automatic schema migration at app startup.
- No arbitrary command execution in the API or worker host.
- No PR merge or production deployment from this branch.
- Live status must distinguish `connected`, `disconnected`, `unconfigured` and `sample`.
