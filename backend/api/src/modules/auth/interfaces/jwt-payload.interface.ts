export interface JwtPayload {
  sub: string; // User ID
  email: string;
  name: string;
  type: 'access';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  status?: string;
}

export interface MembershipSummary {
  membershipId: string;
  organizationId: string;
  orgName: string;
  orgSlug: string;
  role: string;
}
