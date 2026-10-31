import { Invitation, Organization, OrganizationMembership, Role, User } from '@reconcilex/db';

export const ORGANIZATIONS_REPOSITORY = 'ORGANIZATIONS_REPOSITORY';

export interface UserOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  role: string;
  joinedAt: Date;
}

export interface OrgMemberSummary {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  status: string;
  role: string;
  joinedAt: Date;
}

export interface IOrganizationsRepository {
  getUserOrganizations(userId: string): Promise<UserOrganizationSummary[]>;
  getOrgById(orgId: string): Promise<Organization | null>;
  updateOrg(orgId: string, name: string): Promise<Organization>;
  getMembers(orgId: string): Promise<OrgMemberSummary[]>;
  findMembership(orgId: string, userId: string): Promise<OrganizationMembership | null>;
  countAdmins(orgId: string): Promise<number>;
  createInvitation(
    orgId: string,
    email: string,
    role: Role,
    tokenHash: string,
    invitedById: string,
    expiresAt: Date,
  ): Promise<Invitation>;
  findActiveInvitation(tokenHash: string): Promise<Invitation | null>;
  findUserByEmail(email: string): Promise<User | null>;
  createUser(name: string, email: string, passwordHash: string): Promise<User>;
  acceptInvitation(invitationId: string, orgId: string, userId: string, role: Role): Promise<void>;
  updateMemberRole(membershipId: string, role: Role): Promise<OrganizationMembership>;
  deleteMember(membershipId: string): Promise<void>;
}
