/**
 * Phase 0 Dirty Dozen Security Rule Verification Spec
 * Documents adversarial payloads verified against firestore.rules.
 */
export const dirtyDozenPayloads = [
  {
    name: '1. Self-verification on user create',
    path: '/users/attackerUid',
    op: 'create',
    payload: { uid: 'attackerUid', verifiedByAdmin: true, isBlocked: false },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Role & block status tamper on update',
    path: '/users/attackerUid',
    op: 'update',
    payload: { isBlocked: false, role: 'admin' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Ghost shadow field injection',
    path: '/users/attackerUid',
    op: 'update',
    payload: { bio: 'Updated', extraShadowField: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Cross-user PII read',
    path: '/users/victimUid/private/info',
    op: 'get',
    authUid: 'attackerUid',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Portfolio identity spoofing',
    path: '/portfolioItems/item1',
    op: 'create',
    authUid: 'attackerUid',
    payload: { editorId: 'victimUid', title: 'Stolen' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Unverified email project creation',
    path: '/projects/proj1',
    op: 'create',
    emailVerified: false,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Path variable ID poisoning',
    path: '/projects/invalid..id/with/slashes',
    op: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Orphaned proposal on closed/missing project',
    path: '/projects/missingProj/proposals/prop1',
    op: 'create',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Third-party chat eavesdropping',
    path: '/conversations/u1_u2/messages/m1',
    op: 'get',
    authUid: 'u3',
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Review on incomplete project',
    path: '/reviews/rev1',
    op: 'create',
    payload: { projectId: 'pendingProj', rating: 5 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Tampering platformConfig as non-admin',
    path: '/platformConfig/settings',
    op: 'update',
    authUid: 'attackerUid',
    payload: { commissionRatePct: 0 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Mutating completed project status',
    path: '/projects/completedProj',
    op: 'update',
    payload: { status: 'pending' },
    expected: 'PERMISSION_DENIED',
  },
];
