import { describe, it, expect } from 'vitest';
import { getRolePermissions } from './permissions';

describe('Role-based Permissions Matrix (PRD & Plan Section 2.12)', () => {
  it('correctly maps ADMIN capabilities', () => {
    const perms = getRolePermissions('ADMIN');
    expect(perms.canManageOrg).toBe(true);
    expect(perms.canManageMembers).toBe(true);
    expect(perms.canWriteDataSources).toBe(true);
    expect(perms.canDeleteDataSources).toBe(true);
    expect(perms.canUploadCsv).toBe(true);
    expect(perms.canRunReconciliation).toBe(true);
    expect(perms.canConfirmRejectMatches).toBe(true);
    expect(perms.canMutateExceptions).toBe(true);
    expect(perms.canAssignOtherMembers).toBe(true);
  });

  it('correctly maps FINANCE_MANAGER capabilities', () => {
    const perms = getRolePermissions('FINANCE_MANAGER');
    expect(perms.canManageOrg).toBe(false);
    expect(perms.canManageMembers).toBe(false);
    expect(perms.canWriteDataSources).toBe(true);
    expect(perms.canDeleteDataSources).toBe(true);
    expect(perms.canUploadCsv).toBe(true);
    expect(perms.canRunReconciliation).toBe(true);
    expect(perms.canConfirmRejectMatches).toBe(true);
    expect(perms.canMutateExceptions).toBe(true);
    expect(perms.canAssignOtherMembers).toBe(false); // Self-assign only
  });

  it('correctly maps ANALYST capabilities', () => {
    const perms = getRolePermissions('ANALYST');
    expect(perms.canManageOrg).toBe(false);
    expect(perms.canManageMembers).toBe(false);
    expect(perms.canWriteDataSources).toBe(false);
    expect(perms.canDeleteDataSources).toBe(false);
    expect(perms.canUploadCsv).toBe(true);
    expect(perms.canRunReconciliation).toBe(true);
    expect(perms.canConfirmRejectMatches).toBe(true);
    expect(perms.canMutateExceptions).toBe(true);
    expect(perms.canAssignOtherMembers).toBe(false); // Self-assign only
  });

  it('correctly maps AUDITOR capabilities (read-only)', () => {
    const perms = getRolePermissions('AUDITOR');
    expect(perms.canManageOrg).toBe(false);
    expect(perms.canManageMembers).toBe(false);
    expect(perms.canWriteDataSources).toBe(false);
    expect(perms.canDeleteDataSources).toBe(false);
    expect(perms.canUploadCsv).toBe(false); // Cannot upload CSV
    expect(perms.canRunReconciliation).toBe(false); // Cannot start run
    expect(perms.canConfirmRejectMatches).toBe(false); // Cannot confirm/reject
    expect(perms.canMutateExceptions).toBe(false); // Cannot assign/comment/transition
    expect(perms.canAssignOtherMembers).toBe(false);
  });
});
