import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Role } from '@reconcilex/db';
import {
  LoginDto,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
  RegisterDto,
} from './dto/auth.dto';
import { AuthTokens, MembershipSummary, UserSummary } from './interfaces/jwt-payload.interface';
import { PasswordService } from './password.service';
import { AUTH_REPOSITORY, IAuthRepository } from './repositories/auth.repository.interface';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepo: IAuthRepository,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<{
    user: UserSummary;
    organization: { id: string; name: string; slug: string; role: string };
    tokens: AuthTokens;
  }> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const existingUser = await this.authRepo.findUserByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    let baseSlug = dto.orgName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    if (!baseSlug) baseSlug = 'org';

    const slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;

    const { plainToken: refreshToken, tokenHash } = this.tokenService.generateOpaqueToken();

    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const result = await this.authRepo.createRegistration({
      name: dto.name.trim(),
      email: normalizedEmail,
      passwordHash,
      orgName: dto.orgName.trim(),
      orgSlug: slug,
      refreshTokenHash: tokenHash,
      refreshTokenExpiresAt: refreshExpiresAt,
    });

    const accessToken = await this.tokenService.generateAccessToken({
      sub: result.user.id,
      email: result.user.email,
      name: result.user.name,
    });

    this.logger.log(`New organization registered: ${slug} by ${normalizedEmail}`);

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      organization: {
        id: result.organization.id,
        name: result.organization.name,
        slug: result.organization.slug,
        role: Role.ADMIN,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  async login(dto: LoginDto): Promise<{
    user: UserSummary;
    memberships: MembershipSummary[];
    tokens: AuthTokens;
  }> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const user = await this.authRepo.findUserByEmail(normalizedEmail);
    // Generic error message to prevent account enumeration
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await this.passwordService.verify(user.passwordHash, dto.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const memberships = await this.authRepo.getUserMemberships(user.id);

    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    const { plainToken: refreshToken, tokenHash } = this.tokenService.generateOpaqueToken();

    await this.authRepo.createRefreshToken(
      user.id,
      tokenHash,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      memberships,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  async refresh(incomingToken?: string): Promise<AuthTokens> {
    if (!incomingToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.tokenService.hashToken(incomingToken);

    const record = await this.authRepo.findActiveRefreshToken(tokenHash);
    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.authRepo.findUserById(record.userId);
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive');
    }

    const { plainToken: newRefreshToken, tokenHash: newTokenHash } =
      this.tokenService.generateOpaqueToken();

    await this.authRepo.rotateRefreshToken(
      record.id,
      user.id,
      newTokenHash,
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    );

    const accessToken = await this.tokenService.generateAccessToken({
      sub: user.id,
      email: user.email,
      name: user.name,
    });

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(incomingToken?: string): Promise<{ success: boolean; message: string }> {
    if (incomingToken) {
      const tokenHash = this.tokenService.hashToken(incomingToken);
      await this.authRepo.revokeRefreshToken(tokenHash);
    }
    return { success: true, message: 'Logged out successfully' };
  }

  async requestPasswordReset(
    dto: PasswordResetRequestDto,
  ): Promise<{ message: string; resetToken?: string }> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.authRepo.findUserByEmail(normalizedEmail);

    let plainToken: string | undefined;

    if (user) {
      const tokenData = this.tokenService.generateOpaqueToken();
      plainToken = tokenData.plainToken;

      await this.authRepo.createPasswordReset(
        user.id,
        tokenData.tokenHash,
        new Date(Date.now() + 60 * 60 * 1000),
      );

      this.logger.log(`Password reset requested for ${normalizedEmail}`);
    }

    return {
      message: 'If this email is registered, password reset instructions will be sent.',
      resetToken: plainToken,
    };
  }

  async confirmPasswordReset(
    dto: PasswordResetConfirmDto,
  ): Promise<{ success: boolean; message: string }> {
    const tokenHash = this.tokenService.hashToken(dto.token);

    const record = await this.authRepo.findActivePasswordReset(tokenHash);
    if (!record || record.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const newPasswordHash = await this.passwordService.hash(dto.newPassword);

    await this.authRepo.confirmPasswordReset(record.id, record.userId, newPasswordHash);

    return { success: true, message: 'Password has been reset successfully' };
  }

  async getMe(userId: string): Promise<{
    user: UserSummary;
    memberships: MembershipSummary[];
  }> {
    const user = await this.authRepo.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const memberships = await this.authRepo.getUserMemberships(user.id);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        status: user.status,
      },
      memberships,
    };
  }
}
