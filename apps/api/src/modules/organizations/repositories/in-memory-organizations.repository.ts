import { Injectable, NotFoundException } from '@nestjs/common';
import { Invitation, Organization, OrganizationMembership, Role, User } from '@reconcilex/db';
import { v4 as uuidv4 } from 'uuid';
import {
  IOrganizationsRepository,
  OrgMemberSummary,
  UserOrganizationSummary,
} from './organizations.repository.interface';

@Injectable()
export class InMemoryOrganizationsRepository implements IOrganizationsRepository {
  public organizations: Map<string, Organization> = new Map();
  public users: Map<string, User> = new Map();
  public memberships: Map<string, OrganizationMembership> = new Map();
  public invitations: Map<string, Invitation> = new Map();

  async getUserOrganizations(userId: string): Promise<UserOrganizationSummary[]> {
    const results: UserOrganizationSummary[] = [];
    for (const m of this.memberships.values()) {
      if (m.userId === userId) {
        const org = this.organizations.get(m.organizationId);
        if (org) {
          results.push({
            id: org.id,
            name: org.name,
            slug: org.slug,
            status: org.status,
            role: m.role,
            joinedAt: m.createdAt,
          });
        }
      }
    }
    return results;
  }

  async getOrgById(orgId: string): Promise<Organization | null> {
    return this.organizations.get(orgId) || null;
  }

  async updateOrg(orgId: string, name: string): Promise<Organization> {
    const org = this.organizations.get(orgId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    org.name = name;
    org.updatedAt = new Date();
    return org;
  }

  async getMembers(orgId: string): Promise<OrgMemberSummary[]> {
    const results: OrgMemberSummary[] = [];
    for (const m of this.memberships.values()) {
      if (m.organizationId === orgId) {
        const u = this.users.get(m.userId);
        if (u) {
          results.push({
            membershipId: m.id,
            userId: u.id,
            name: u.name,
            email: u.email,
            status: u.status,
            role: m.role,
            joinedAt: m.createdAt,
          });
        }
      }
    }
    return results;
  }

  async findMembership(orgId: string, userId: string): Promise<OrganizationMembership | null> {
    for (const m of this.memberships.values()) {
      if (m.organizationId === orgId && m.userId === userId) {
        return m;
      }
    }
    return null;
  }

  async countAdmins(orgId: string): Promise<number> {
    let count = 0;
    for (const m of this.memberships.values()) {
      if (m.organizationId === orgId && m.role === Role.ADMIN) {
        count++;
      }
    }
    return count;
  }

  async createInvitation(
    orgId: string,
    email: string,
    role: Role,
    tokenHash: string,
    invitedById: string,
    expiresAt: Date,
  ): Promise<Invitation> {
    const id = uuidv4();
    const invitation: Invitation = {
      id,
      organizationId: orgId,
      email,
      role,
      tokenHash,
      invitedById,
      expiresAt,
      acceptedAt: null,
      createdAt: new Date(),
    };
    this.invitations.set(id, invitation);
    return invitation;
  }

  async findActiveInvitation(tokenHash: string): Promise<Invitation | null> {
    for (const inv of this.invitations.values()) {
      if (inv.tokenHash === tokenHash && !inv.acceptedAt) {
        return inv;
      }
    }
    return null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        return u;
      }
    }
    return null;
  }

  async createUser(name: string, email: string, passwordHash: string): Promise<User> {
    const id = uuidv4();
    const now = new Date();
    const user: User = {
      id,
      email,
      name,
      passwordHash,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(id, user);
    return user;
  }

  async acceptInvitation(
    invitationId: string,
    orgId: string,
    userId: string,
    role: Role,
  ): Promise<void> {
    const inv = this.invitations.get(invitationId);
    if (inv) {
      inv.acceptedAt = new Date();
    }
    const membershipId = uuidv4();
    const now = new Date();
    this.memberships.set(membershipId, {
      id: membershipId,
      userId,
      organizationId: orgId,
      role,
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateMemberRole(membershipId: string, role: Role): Promise<OrganizationMembership> {
    const m = this.memberships.get(membershipId);
    if (!m) {
      throw new NotFoundException('Membership not found');
    }
    m.role = role;
    m.updatedAt = new Date();
    return m;
  }

  async deleteMember(membershipId: string): Promise<void> {
    this.memberships.delete(membershipId);
  }

  clear(): void {
    this.organizations.clear();
    this.users.clear();
    this.memberships.clear();
    this.invitations.clear();
  }
}
