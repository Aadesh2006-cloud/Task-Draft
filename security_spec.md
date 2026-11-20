# Briefline Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Default Deny**: Any unmatched path is unconditionally denied for read and write.
2. **PII Isolation (`/users/{userId}`)**: User email and account metadata are readable ONLY by the document owner (`request.auth.uid == userId` with `email_verified == true`) or an admin. Collection-wide `list` is forbidden.
3. **Zero Self-Assigned Privileges**: Users cannot create or update `/admins/{adminId}`, nor inject `isAdmin` or `role` fields onto `/users/{userId}`.
4. **Verified Identity & Temporal Integrity**: All client writes require `request.auth.token.email_verified == true`, exact UID ownership, and server-enforced timestamps (`request.time`).
5. **Terminal State Locking (`/project_briefs/{briefId}`)**: Once a project brief reaches `closed` or `cancelled`, non-admin updates are rejected.
6. **Participant Isolation (`/workspace_events/{eventId}`)**: Only the workspace `buyerUid`, `sellerUid`, or an admin may read events; writes are append-only (`update` and `delete` forbidden) and require `actorUid == request.auth.uid` as one of the two participants.
7. **Strict Schema & Bounds**: Every create enforces `hasAll` + `hasOnly`; every update enforces `affectedKeys().hasOnly(...)` wrapped by `isValid*()` helpers; every string/list enforces bounded `.size()` checks; every path ID enforces `isValidId()`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Shadow Field Injection on User Create**: Writing `{ uid, name, email, activeRole: "buyer", canBuy: true, canSell: false, isAdmin: true, createdAt, updatedAt }` to `/users/{uid}`.
2. **Unverified Admin Email Spoof**: Accessing `/users/{otherUid}` with `token.email == "kanugarg2006@gmail.com"` when `token.email_verified == false`.
3. **Cross-User PII Read**: Authenticated user A calling `get` on `/users/userB`.
4. **User Directory Scraping**: Authenticated user calling `list` on `/users`.
5. **Buyer Identity Spoofing**: User A creating `/project_briefs/brief_1` with `buyerUid: "userB"`.
6. **Client-Forged Timestamp**: Creating `/project_briefs/brief_2` with a backdated `createdAt` instead of `request.time`.
7. **Oversized String / Resource Exhaustion**: Creating `/project_briefs/brief_3` with a 5,000-character `title`.
8. **ID Poisoning**: Creating `/project_briefs/bad$id!with..spaces` violating `^[a-zA-Z0-9_\-]+$`.
9. **Terminal State Bypass**: Owner attempting to update `/project_briefs/brief_closed` whose `status` is already `"closed"`.
10. **Skill Array Overflow**: Writing 25 items into `skills` (limit is 15).
11. **Non-Participant Workspace Event Read**: User C calling `get` or `list` on `/workspace_events` belonging to `buyerA` and `sellerB`.
12. **Audit Tampering**: Participant attempting `update` or `delete` on an existing `/workspace_events/{eventId}`.
