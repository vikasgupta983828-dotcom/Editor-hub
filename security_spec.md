# Security Specification — EDITOR HUB PRO

## 1. Data Invariants
1. **No Self-Privilege Escalation**: A newly registered user in `/users/{uid}` MUST have `verifiedByAdmin == false` and `isBlocked == false`, and `uid == request.auth.uid`. Users can never modify `verifiedByAdmin`, `isBlocked`, `role`, or `createdAt` on update.
2. **PII Isolation**: Sensitive fields (`email`, `phone`, `payoutUpiId`, `payoutPaypalEmail`, `payoutBankSummary`) live strictly under `/users/{uid}/private/info` and are readable/writable ONLY by `uid` or Admin.
3. **Master Gate Relational Integrity**:
   - Subcollection `/projects/{projectId}/proposals/{proposalId}` MUST verify parent `/projects/{projectId}` exists, is `'pending'`, and `projectClientId` matches parent `clientId`.
   - Subcollection `/conversations/{conversationId}/messages/{messageId}` MUST verify parent `/conversations/{conversationId}` exists and `request.auth.uid` is either `participantA` or `participantB`.
4. **Immutable Ownership & Temporal Integrity**: `createdAt == request.time` on creation; `updatedAt == request.time` on updates; `createdAt`, `clientId`, `editorId` (once assigned), and `uid` remain immutable.
5. **Terminal State Locking**: Once a `Project` reaches `'completed'` or `'cancelled'`, or a `Dispute` reaches `'resolved_refund'`, `'resolved_release'`, or `'dismissed'`, only Admin (or non-status `reviewed: true` flip by client on completed project) can modify it.
6. **Verified Review Integrity**: A review in `/reviews/{reviewId}` can ONLY be created by the `clientId` of a `'completed'` project for that project's `editorId`.
7. **Zero-Trust List Queries**: Every `allow list` rule evaluates `resource.data` directly against `request.auth.uid` or public status flags without calling `get()` or `exists()`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Return PERMISSION_DENIED)
1. **Self-Verification Shadow Field**: User creates `/users/u1` with `{ ..., verifiedByAdmin: true }`.
2. **Self-Unblock / Role Escalation Update**: User updates `/users/u1` with `{ isBlocked: false, role: "admin" }`.
3. **Ghost Field Injection**: User updates `/users/u1` with `{ bio: "hi", shadowAdmin: true }`.
4. **PII Cross-Read**: Signed-in user `u2` reads `/users/u1/private/info`.
5. **Identity Spoofing on Portfolio**: User `u2` creates `/portfolioItems/p1` with `editorId: "u1"`.
6. **Unverified Email Write**: User with `email_verified: false` tries to create `/projects/proj1`.
7. **Oversized ID Poisoning**: User creates `/projects/<150-char-id>` or invalid chars `../hack`.
8. **Proposal on Non-Existent / Closed Project**: Editor creates proposal under `/projects/nonexistent/proposals/prop1`.
9. **Eavesdropping Conversation Messages**: User `u3` reads `/conversations/u1_u2/messages/m1`.
10. **Fake Review Injection**: User `u2` creates a 5-star review for `/projects/proj1` where `proj1.status == 'pending'`.
11. **Client Self-Releasing Unpaid Escrow / Tampering Commission**: User creates `/transactions/tx1` with `commissionPct: 0` or `status: 'completed'` for another user's project.
12. **Mutating Completed Project**: Client tries to update `budgetUsd` or `status: 'pending'` on a `completed` project.
