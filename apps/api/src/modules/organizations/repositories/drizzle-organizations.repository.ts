import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DatabaseClient,
  Invitation,
  invitations,
  Organization,
  OrganizationMembership,
  organizationMemberships,
  organizations,
  Role,
  User,
  users,
} from '@reconcilex/db';
import { and, count, eq, isNull } from 'drizzle-orm';
import { DATABASE_CLIENT } from '../../../database/database.constants';
import {
  IOrganizationsRepository,
  OrgMemberSummary,
  UserOrganizationSummary,
} from './organizations.repository.interface';

@Injectable()
export class DrizzleOrganizationsRepository implements IOrganizationsRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async getUserOrganizations(userId: string): Promise<UserOrganizationSummary[]> {
    return this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        status: organizations.status,
        role: organizationMemberships.role,
        joinedAt: organizationMemberships.createdAt,
      })
      .from(organizationMemberships)
      .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
      .where(eq(organizationMemberships.userId, userId));
  }

  async getOrgById(orgId: string): Promise<Organization | null> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    return org || null;
  }

  async updateOrg(orgId: string, name: string): Promise<Organization> {
    const [updated] = await this.db
      .update(organizations)
      .set({
        name,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))
      .returning();

    if (!updated) {
      throw new NotFoundException('Organization not found');
    }
    return updated;
  }

  async getMembers(orgId: string): Promise<OrgMemberSummary[]> {
    return this.db
      .select({
        membershipId: organizationMemberships.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        role: organizationMemberships.role,
        joinedAt: organizationMemberships.createdAt,
      })
      .from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id))
      .where(eq(organizationMemberships.organizationId, orgId));
  }

  async findMembership(orgId: string, userId: string): Promise<OrganizationMembership | null> {
    const [membership] = await this.db
      .select()
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, orgId),
          eq(organizationMemberships.userId, userId),
        ),
      )
      .limit(1);
    return membership || null;
  }

  async countAdmins(orgId: string): Promise<number> {
    const [res] = await this.db
      .select({ total: count() })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, orgId),
          eq(organizationMemberships.role, Role.ADMIN),
        ),
      );
    return Number(res?.total ?? 0);
  }

  async createInvitation(
    orgId: string,
    email: string,
    role: Role,
    tokenHash: string,
    invitedById: string,
    expiresAt: Date,
  ): Promise<Invitation> {
    const [invitation] = await this.db
      .insert(invitations)
      .values({
        organizationId: orgId,
        email,
        role,
        tokenHash,
        invitedById,
        expiresAt,
      })
      .returning();
    return invitation;
  }

  async findActiveInvitation(tokenHash: string): Promise<Invitation | null> {
    const [invitation] = await this.db
      .select()
      .from(invitations)
      .where(and(eq(invitations.tokenHash, tokenHash), isNull(invitations.acceptedAt)))
      .limit(1);
    return invitation || null;
  }

  async findUserByEmail(email: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return user || null;
  }

  async createUser(name: string, email: string, passwordHash: string): Promise<User> {
    const [newUser] = await this.db.insert(users).values({ name, email, passwordHash }).returning();
    return newUser;
  }

  async acceptInvitation(
    invitationId: string,
    orgId: string,
    userId: string,
    role: Role,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(organizationMemberships).values({
        userId,
        organizationId: orgId,
        role,
      });

      await tx
        .update(invitations)
        .set({ acceptedAt: new Date() })
        .where(eq(invitations.id, invitationId));
    });
  }

  async updateMemberRole(membershipId: string, role: Role): Promise<OrganizationMembership> {
    const [updated] = await this.db
      .update(organizationMemberships)
      .set({ role, updatedAt: new Date() })
      .where(eq(organizationMemberships.id, membershipId))
      .returning();
    return updated;
  }

  async deleteMember(membershipId: string): Promise<void> {
    await this.db
      .delete(organizationMemberships)
      .where(eq(organizationMemberships.id, membershipId));
  }
}
