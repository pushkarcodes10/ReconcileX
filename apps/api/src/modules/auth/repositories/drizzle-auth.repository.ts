import { Inject, Injectable } from '@nestjs/common';
import {
  DatabaseClient,
  organizationMemberships,
  organizations,
  passwordResets,
  refreshTokens,
  Role,
  User,
  users,
} from '@reconcilex/db';
import { and, eq, isNull } from 'drizzle-orm';
import { DATABASE_CLIENT } from '../../../database/database.constants';
import { MembershipSummary } from '../interfaces/jwt-payload.interface';
import { CreateRegistrationParams, IAuthRepository } from './auth.repository.interface';

@Injectable()
export class DrizzleAuthRepository implements IAuthRepository {
  constructor(@Inject(DATABASE_CLIENT) private readonly db: DatabaseClient) {}

  async findUserByEmail(email: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return user || null;
  }

  async findUserById(id: string): Promise<User | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user || null;
  }

  async createRegistration(params: CreateRegistrationParams) {
    return this.db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(users)
        .values({
          name: params.name,
          email: params.email,
          passwordHash: params.passwordHash,
        })
        .returning();

      const [newOrg] = await tx
        .insert(organizations)
        .values({
          name: params.orgName,
          slug: params.orgSlug,
        })
        .returning();

      await tx.insert(organizationMemberships).values({
        userId: newUser.id,
        organizationId: newOrg.id,
        role: Role.ADMIN,
      });

      await tx.insert(refreshTokens).values({
        userId: newUser.id,
        tokenHash: params.refreshTokenHash,
        expiresAt: params.refreshTokenExpiresAt,
      });

      return {
        user: newUser,
        organization: newOrg,
      };
    });
  }

  async getUserMemberships(userId: string): Promise<MembershipSummary[]> {
    return this.db
      .select({
        membershipId: organizationMemberships.id,
        organizationId: organizations.id,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        role: organizationMemberships.role,
      })
      .from(organizationMemberships)
      .innerJoin(organizations, eq(organizationMemberships.organizationId, organizations.id))
      .where(eq(organizationMemberships.userId, userId));
  }

  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.insert(refreshTokens).values({
      userId,
      tokenHash,
      expiresAt,
    });
  }

  async findActiveRefreshToken(tokenHash: string) {
    const [record] = await this.db
      .select()
      .from(refreshTokens)
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
      .limit(1);
    return record || null;
  }

  async rotateRefreshToken(
    oldTokenId: string,
    userId: string,
    newTokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, oldTokenId));

      await tx.insert(refreshTokens).values({
        userId,
        tokenHash: newTokenHash,
        expiresAt,
      });
    });
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)));
  }

  async createPasswordReset(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.insert(passwordResets).values({
      userId,
      tokenHash,
      expiresAt,
    });
  }

  async findActivePasswordReset(tokenHash: string) {
    const [record] = await this.db
      .select()
      .from(passwordResets)
      .where(and(eq(passwordResets.tokenHash, tokenHash), isNull(passwordResets.usedAt)))
      .limit(1);
    return record || null;
  }

  async confirmPasswordReset(
    resetId: string,
    userId: string,
    newPasswordHash: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
        .where(eq(users.id, userId));

      await tx
        .update(passwordResets)
        .set({ usedAt: new Date() })
        .where(eq(passwordResets.id, resetId));

      await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
    });
  }
}
