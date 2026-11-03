import { UserRole } from '../api/types';

export interface RolePermissions {
  canManageOrg: boolean;
  canManageMembers: boolean;
  canWriteDataSources: boolean;
  canDeleteDataSources: boolean;
  canUploadCsv: boolean;
  canRunReconciliation: boolean;
  canConfirmRejectMatches: boolean;
  canMutateExceptions: boolean;
  canAssignOtherMembers: boolean;
  canViewReports: boolean;
}

export function getRolePermissions(role?: UserRole | null): RolePermissions {
  if (!role) {
    return {
      canManageOrg: false,
      canManageMembers: false,
      canWriteDataSources: false,
      canDeleteDataSources: false,
      canUploadCsv: false,
      canRunReconciliation: false,
      canConfirmRejectMatches: false,
      canMutateExceptions: false,
      canAssignOtherMembers: false,
      canViewReports: false,
    };
  }

  switch (role) {
    case 'ADMIN':
      return {
        canManageOrg: true,
        canManageMembers: true,
        canWriteDataSources: true,
        canDeleteDataSources: true,
        canUploadCsv: true,
        canRunReconciliation: true,
        canConfirmRejectMatches: true,
        canMutateExceptions: true,
        canAssignOtherMembers: true, // Only ADMIN can fetch /organizations/:orgId/members
        canViewReports: true,
      };

    case 'FINANCE_MANAGER':
      return {
        canManageOrg: false,
        canManageMembers: false,
        canWriteDataSources: true,
        canDeleteDataSources: true,
        canUploadCsv: true,
        canRunReconciliation: true,
        canConfirmRejectMatches: true,
        canMutateExceptions: true,
        canAssignOtherMembers: false, // Non-admins can self-assign only
        canViewReports: true,
      };

    case 'ANALYST':
      return {
        canManageOrg: false,
        canManageMembers: false,
        canWriteDataSources: false,
        canDeleteDataSources: false,
        canUploadCsv: true,
        canRunReconciliation: true,
        canConfirmRejectMatches: true,
        canMutateExceptions: true,
        canAssignOtherMembers: false, // Self-assign only
        canViewReports: true,
      };

    case 'AUDITOR':
      return {
        canManageOrg: false,
        canManageMembers: false,
        canWriteDataSources: false,
        canDeleteDataSources: false,
        canUploadCsv: false,
        canRunReconciliation: false,
        canConfirmRejectMatches: false,
        canMutateExceptions: false,
        canAssignOtherMembers: false,
        canViewReports: true,
      };

    default:
      return {
        canManageOrg: false,
        canManageMembers: false,
        canWriteDataSources: false,
        canDeleteDataSources: false,
        canUploadCsv: false,
        canRunReconciliation: false,
        canConfirmRejectMatches: false,
        canMutateExceptions: false,
        canAssignOtherMembers: false,
        canViewReports: false,
      };
  }
}
