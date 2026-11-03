import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class TokenService {
  private readonly jwtSecret: string;
  private readonly accessExpiresIn: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('app.jwt.secret') ||
      'reconcilex-super-secret-jwt-key-minimum-32-chars-long';
    this.accessExpiresIn = this.configService.get<string>('app.jwt.expiresIn') || '15m';
  }

  async generateAccessToken(payload: Omit<JwtPayload, 'type'>): Promise<string> {
    const fullPayload: JwtPayload = {
      ...payload,
      type: 'access',
    };

    const options: JwtSignOptions = {
      secret: this.jwtSecret,
      expiresIn: this.accessExpiresIn as unknown as undefined,
    };

    return this.jwtService.signAsync(fullPayload, options);
  }

  async verifyAccessToken(token: string): Promise<JwtPayload> {
    const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.jwtSecret,
    });

    if (payload.type !== 'access') {
      throw new UnauthorizedException('Invalid token type: expected access token');
    }

    return payload;
  }

  generateOpaqueToken(): { plainToken: string; tokenHash: string } {
    const plainToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(plainToken);
    return { plainToken, tokenHash };
  }

  hashToken(plainToken: string): string {
    return crypto.createHash('sha256').update(plainToken).digest('hex');
  }
}
