import { apiClient } from '../client';
import { OrganizationMember, Invitation, UserRole } from '../types';

export interface InviteMemberDto {
  email: string;
  role: UserRole;
}

export const organizationsApi = {
  updateOrg: (orgId: string, name: string) =>
    apiClient.patch<{ id: string; name: string }>(`/organizations/${orgId}`, { name }),

  listMembers: (orgId: string) =>
    apiClient.get<OrganizationMember[]>(`/organizations/${orgId}/members`),

  inviteMember: (orgId: string, dto: InviteMemberDto) =>
    apiClient.post<Invitation>(`/organizations/${orgId}/invitations`, dto),

  updateMemberRole: (orgId: string, userId: string, role: UserRole) =>
    apiClient.patch<{ success: boolean }>(`/organizations/${orgId}/members/${userId}`, { role }),

  removeMember: (orgId: string, userId: string) =>
    apiClient.delete<{ success: boolean }>(`/organizations/${orgId}/members/${userId}`),
};
