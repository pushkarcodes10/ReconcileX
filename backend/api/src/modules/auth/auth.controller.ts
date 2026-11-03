import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { clearAuthCookies, setAuthCookies } from './cookie.helper';
import { AuthService } from './auth.service';
import {
  LoginDto,
  PasswordResetConfirmDto,
  PasswordResetRequestDto,
  RegisterDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    this.isProduction = this.configService.get<string>('app.nodeEnv') === 'production';
  }

  @Post('register')
  @ApiOperation({ summary: 'Register new user, organization, and ADMIN membership' })
  @ApiResponse({ status: 201, description: 'Organization and user created' })
  @ApiResponse({ status: 409, description: 'Email already exists' })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken, this.isProduction);
    return {
      user: result.user,
      organization: result.organization,
    };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user with email and password' })
  @ApiResponse({ status: 200, description: 'Authenticated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid email or password' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    setAuthCookies(res, result.tokens.accessToken, result.tokens.refreshToken, this.isProduction);
    return {
      user: result.user,
      memberships: result.memberships,
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out current user and revoke session' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    clearAuthCookies(res);
    return this.authService.logout(refreshToken);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate and refresh access token via refresh token cookie' })
  @ApiResponse({ status: 200, description: 'Token refreshed' })
  @ApiResponse({ status: 401, description: 'Invalid or missing refresh token' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    const tokens = await this.authService.refresh(refreshToken);
    setAuthCookies(res, tokens.accessToken, tokens.refreshToken, this.isProduction);
    return { success: true };
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request password reset instructions (always returns 202)' })
  @ApiResponse({ status: 202, description: 'Password reset request accepted' })
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm password reset with token' })
  @ApiResponse({ status: 200, description: 'Password reset completed' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    return this.authService.confirmPasswordReset(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user profile and memberships' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }
}
