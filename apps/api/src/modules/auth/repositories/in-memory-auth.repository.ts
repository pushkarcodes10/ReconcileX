import { Injectable } from '@nestjs/common';
import { Organization, PasswordReset, RefreshToken, Role, User } from '@reconcilex/db';
import { v4 as uuidv4 } from 'uuid';
import { MembershipSummary } from '../interfaces/jwt-payload.interface';
import { CreateRegistrationParams, IAuthRepository } from './auth.repository.interface';

interface StoredMembership {
  id: string;
  userId: string;
  organizationId: string;
  role: Role;
  createdAt: Date;
}

@Injectable()
export class InMemoryAuthRepository implements IAuthRepository {
  public users: Map<string, User> = new Map();
  public organizations: Map<string, Organization> = new Map();
  public memberships: Map<string, StoredMembership> = new Map();
  public refreshTokens: Map<string, RefreshToken> = new Map();
  public passwordResets: Map<string, PasswordReset> = new Map();

  async findUserByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return null;
  }

  async findUserById(id: string): Promise<User | null> {
    return this.users.get(id) || null;
  }

  async createRegistration(params: CreateRegistrationParams) {
    const userId = uuidv4();
    const orgId = uuidv4();
    const now = new Date();

    const user: User = {
      id: userId,
      email: params.email,
      passwordHash: params.passwordHash,
      name: params.name,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(userId, user);

    const organization: Organization = {
      id: orgId,
      name: params.orgName,
      slug: params.orgSlug,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };
    this.organizations.set(orgId, organization);

    const membershipId = uuidv4();
    this.memberships.set(membershipId, {
      id: membershipId,
      userId,
      organizationId: orgId,
      role: Role.ADMIN,
      createdAt: now,
    });

    const refreshTokenId = uuidv4();
    this.refreshTokens.set(refreshTokenId, {
      id: refreshTokenId,
      userId,
      tokenHash: params.refreshTokenHash,
      expiresAt: params.refreshTokenExpiresAt,
      revokedAt: null,
      createdAt: now,
    });

    return { user, organization };
  }

  async getUserMemberships(userId: string): Promise<MembershipSummary[]> {
    const results: MembershipSummary[] = [];
    for (const m of this.memberships.values()) {
      if (m.userId === userId) {
        const org = this.organizations.get(m.organizationId);
        if (org) {
          results.push({
            membershipId: m.id,
            organizationId: org.id,
            orgName: org.name,
            orgSlug: org.slug,
            role: m.role,
          });
        }
      }
    }
    return results;
  }

  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const id = uuidv4();
    this.refreshTokens.set(id, {
      id,
      userId,
      tokenHash,
      expiresAt,
      revokedAt: null,
      createdAt: new Date(),
    });
  }

  async findActiveRefreshToken(tokenHash: string): Promise<RefreshToken | null> {
    for (const token of this.refreshTokens.values()) {
      if (token.tokenHash === tokenHash && !token.revokedAt) {
        return token;
      }
    }
    return null;
  }

  async rotateRefreshToken(
    oldTokenId: string,
    userId: string,
    newTokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    const old = this.refreshTokens.get(oldTokenId);
    if (old) {
      old.revokedAt = new Date();
    }
    const id = uuidv4();
    this.refreshTokens.set(id, {
      id,
      userId,
      tokenHash: newTokenHash,
      expiresAt,
      revokedAt: null,
      createdAt: new Date(),
    });
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    for (const token of this.refreshTokens.values()) {
      if (token.tokenHash === tokenHash) {
        token.revokedAt = new Date();
      }
    }
  }

  async createPasswordReset(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const id = uuidv4();
    this.passwordResets.set(id, {
      id,
      userId,
      tokenHash,
      expiresAt,
      usedAt: null,
      createdAt: new Date(),
    });
  }

  async findActivePasswordReset(tokenHash: string): Promise<PasswordReset | null> {
    for (const reset of this.passwordResets.values()) {
      if (reset.tokenHash === tokenHash && !reset.usedAt) {
        return reset;
      }
    }
    return null;
  }

  async confirmPasswordReset(
    resetId: string,
    userId: string,
    newPasswordHash: string,
  ): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.passwordHash = newPasswordHash;
      user.updatedAt = new Date();
    }
    const reset = this.passwordResets.get(resetId);
    if (reset) {
      reset.usedAt = new Date();
    }
    for (const token of this.refreshTokens.values()) {
      if (token.userId === userId && !token.revokedAt) {
        token.revokedAt = new Date();
      }
    }
  }

  clear(): void {
    this.users.clear();
    this.organizations.clear();
    this.memberships.clear();
    this.refreshTokens.clear();
    this.passwordResets.clear();
  }
}
