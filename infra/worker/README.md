# Queue Worker Contract

The worker is a separate process from the dashboard/API. It must not run arbitrary user code in its own process.

## Required runtime controls

- Dedicated non-root container; no privileged mode, host mounts, Docker socket or host PID/network namespaces.
- CPU, memory, process-count, disk and wall-clock limits.
- Default-deny network egress; explicit allowlist only when a task requires it.
- Read-only root filesystem, temporary per-job workspace, dropped Linux capabilities and seccomp/AppArmor profile.
- One tenant's files, logs, environment and artifacts must never be visible to another tenant.
- Secrets are short-lived, scoped to one job and injected at runtime; never included in logs or artifacts.
- Kill the complete process tree on timeout/cancellation and destroy the job workspace.

## Lifecycle

1. Claim one job transactionally with a lease.
2. Verify workspace membership and job kind against an allowlist.
3. Start an isolated runtime with strict resource limits.
4. Heartbeat the lease; stop immediately if ownership is lost.
5. Poll cancellation and enforce a hard deadline.
6. Persist bounded output and a terminal state transactionally.
7. On crash, let the lease reaper recover the job. Handlers must be idempotent.

## Required tests before enabling execution

- Concurrent claims never return the same job.
- Duplicate idempotency keys do not create duplicate jobs.
- Expired lease recovery and max-attempt dead-letter behavior.
- Worker restart while a job is running.
- Cancellation before claim, during execution and at completion boundary.
- Tenant A cannot read or cancel Tenant B's jobs or artifacts.
- Path traversal, symlink escape, process spawning, resource exhaustion and network egress tests.
- No task execution until the sandbox image and escape tests pass.

## Current status

No runner is deployed. The existing GitHub Codespaces integration is a handoff URL only; it is not an isolated execution provider.