import { Organization, PasswordReset, RefreshToken, User } from '@reconcilex/db';
import { MembershipSummary } from '../interfaces/jwt-payload.interface';

export const AUTH_REPOSITORY = 'AUTH_REPOSITORY';

export interface CreateRegistrationParams {
  name: string;
  email: string;
  passwordHash: string;
  orgName: string;
  orgSlug: string;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
}

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;
  createRegistration(params: CreateRegistrationParams): Promise<{
    user: User;
    organization: Organization;
  }>;
  getUserMemberships(userId: string): Promise<MembershipSummary[]>;
  createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findActiveRefreshToken(tokenHash: string): Promise<RefreshToken | null>;
  rotateRefreshToken(
    oldTokenId: string,
    userId: string,
    newTokenHash: string,
    expiresAt: Date,
  ): Promise<void>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  createPasswordReset(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findActivePasswordReset(tokenHash: string): Promise<PasswordReset | null>;
  confirmPasswordReset(resetId: string, userId: string, newPasswordHash: string): Promise<void>;
}
