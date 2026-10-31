import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasswordService } from './password.service';
import { AUTH_REPOSITORY } from './repositories/auth.repository.interface';
import { DrizzleAuthRepository } from './repositories/drizzle-auth.repository';
import { TokenService } from './token.service';

@Global()
@Module({
  imports: [ConfigModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    JwtAuthGuard,
    {
      provide: AUTH_REPOSITORY,
      useClass: DrizzleAuthRepository,
    },
  ],
  exports: [AuthService, PasswordService, TokenService, JwtAuthGuard, JwtModule, AUTH_REPOSITORY],
})
export class AuthModule {}
