# ocodejs Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Strict Ownership**: Every document under `/users/{userId}` and its subcollections (`clusters`, `snapshots`, `apiKeys`, `slackAlerts`, `teamMembers`, `integrationAudits`) belongs exclusively to `userId == request.auth.uid` with `request.auth.token.email_verified == true`.
2. **Master Gate Sync**: Subcollection writes require the parent `/users/{userId}` document to exist via `exists()`.
3. **Immutable Audit & Ownership Fields**: `ownerId` / `uid` and `createdAt` can never change after creation; `createdAt == request.time` on create and `updatedAt == request.time` on update. `integrationAudits` and `slackAlerts` are append-only (`allow update: if false`).
4. **No Shadow Fields, Secrets, or Unbounded Strings**: Every collection enforces strict `keys().hasAll(...) && keys().hasOnly(...)` allowlists on create, `affectedKeys().hasOnly(...)` on update, and `.size()` caps on every string and array. OAuth tokens and private keys are never persisted in Firestore.
5. **Path Hardening**: All document IDs match `^[a-zA-Z0-9_\-]+$` and are at most 128 characters.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Cross-User Read**: User B attempts `get` on `/users/userA` or `list` on `/users/userA/integrationAudits`.
2. **User Collection List Scraping**: User A attempts `list` on `/users`.
3. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to create `/users/{uid}`.
4. **UID Spoofing**: User A creates `/users/userA/teamMembers/m1` with `ownerId: "userB"`.
5. **Shadow Field Injection**: User A creates `/users/userA/integrationAudits/a1` with extra field `oauthToken: "ya29.secret"`.
6. **Client Timestamp Forgery**: User A creates `/users/userA/integrationAudits/a1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`.
7. **Immutable Audit Tampering**: User A attempts `update` on `/users/userA/integrationAudits/a1` to rewrite `summary` or `status`.
8. **ID Poisoning**: User A attempts to create `/users/userA/teamMembers/bad..id` or a 2KB document ID.
9. **Unbounded Array Bomb**: User A writes `appliedSqlIds` with 500 elements or non-string entries.
10. **Invalid Enum Value**: User A writes `channel: "discord"` or `role: "SuperRoot"` to `integrationAudits` or `teamMembers`.
11. **Team Member Role Escalation**: User A updates `/users/userA/teamMembers/m1` attempting to mutate `role` or `email` instead of only `twoFactorEnabled`, `lastActive`, and `updatedAt`.
12. **Orphan Subcollection Write**: User A writes `/users/userA/integrationAudits/a1` before `/users/userA` exists.
