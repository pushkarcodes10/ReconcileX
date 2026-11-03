import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@reconcilex/db';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { OrgGuard } from '../src/common/guards/org.guard';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { RequestIdMiddleware } from '../src/common/middleware/request-id.middleware';
import configuration from '../src/config/configuration';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { PasswordService } from '../src/modules/auth/password.service';
import { AUTH_REPOSITORY } from '../src/modules/auth/repositories/auth.repository.interface';
import { InMemoryAuthRepository } from '../src/modules/auth/repositories/in-memory-auth.repository';
import { TokenService } from '../src/modules/auth/token.service';
import { OrganizationsController } from '../src/modules/organizations/organizations.controller';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { InMemoryOrganizationsRepository } from '../src/modules/organizations/repositories/in-memory-organizations.repository';
import { ORGANIZATIONS_REPOSITORY } from '../src/modules/organizations/repositories/organizations.repository.interface';

describe('Organizations & RBAC (Phase A2)', () => {
  let app: INestApplication;
  let authRepo: InMemoryAuthRepository;
  let orgRepo: InMemoryOrganizationsRepository;

  beforeAll(async () => {
    authRepo = new InMemoryAuthRepository();
    orgRepo = new InMemoryOrganizationsRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        JwtModule.register({}),
      ],
      controllers: [AuthController, OrganizationsController],
      providers: [
        AuthService,
        PasswordService,
        TokenService,
        JwtAuthGuard,
        OrganizationsService,
        OrgGuard,
        RolesGuard,
        {
          provide: AUTH_REPOSITORY,
          useValue: authRepo,
        },
        {
          provide: ORGANIZATIONS_REPOSITORY,
          useValue: orgRepo,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
    app.use(new RequestIdMiddleware().use);
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();
  });

  beforeEach(() => {
    authRepo.clear();
    orgRepo.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper to register user and sync state between test repos
  async function registerAndSync(name: string, email: string, password: string, orgName: string) {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name, email, password, orgName });

    const cookies = res.headers['set-cookie'] as unknown as string[];
    const user = res.body.user;
    const organization = res.body.organization;

    // Sync into orgRepo for tests
    orgRepo.users.set(user.id, {
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: 'hash',
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    orgRepo.organizations.set(organization.id, {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    orgRepo.memberships.set(`m-${user.id}-${organization.id}`, {
      id: `m-${user.id}-${organization.id}`,
      userId: user.id,
      organizationId: organization.id,
      role: Role.ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { user, organization, cookies };
  }

  describe('GET /api/v1/organizations', () => {
    it('should list organizations the user belongs to', async () => {
      const { cookies, organization } = await registerAndSync(
        'Admin User',
        'admin1@reconcilex.test',
        'Password123!',
        'Apex Capital',
      );

      const response = await request(app.getHttpServer())
        .get('/api/v1/organizations')
        .set('Cookie', cookies)
        .expect(HttpStatus.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(organization.id);
      expect(response.body[0].name).toBe('Apex Capital');
      expect(response.body[0].role).toBe(Role.ADMIN);
    });
  });

  describe('Tenant Isolation', () => {
    it('should return 404 when user in Org A attempts to access Org B members (prevents IDOR)', async () => {
      // User 1 creates Org A
      const userA = await registerAndSync(
        'User A',
        'usera@reconcilex.test',
        'Password123!',
        'Organization Alpha',
      );

      // User 2 creates Org B
      const userB = await registerAndSync(
        'User B',
        'userb@reconcilex.test',
        'Password123!',
        'Organization Beta',
      );

      // User A attempts to list members of Org B
      const response = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${userB.organization.id}/members`)
        .set('Cookie', userA.cookies)
        .expect(HttpStatus.NOT_FOUND);

      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('Organization not found');
    });
  });

  describe('RBAC Guards', () => {
    it('should forbid an ANALYST from updating organization settings (403 Forbidden)', async () => {
      const { cookies, user, organization } = await registerAndSync(
        'Analyst User',
        'analyst@reconcilex.test',
        'Password123!',
        'Data Org',
      );

      // Demote user to ANALYST in orgRepo
      orgRepo.memberships.set(`m-${user.id}-${organization.id}`, {
        id: `m-${user.id}-${organization.id}`,
        userId: user.id,
        organizationId: organization.id,
        role: Role.ANALYST,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${organization.id}`)
        .set('Cookie', cookies)
        .send({ name: 'Hacked Name' })
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toContain('Insufficient permissions');
    });

    it('should forbid an ANALYST from creating member invitations (403 Forbidden)', async () => {
      const { cookies, user, organization } = await registerAndSync(
        'Analyst 2',
        'analyst2@reconcilex.test',
        'Password123!',
        'Data Org 2',
      );

      // Demote user to ANALYST in orgRepo
      orgRepo.memberships.set(`m-${user.id}-${organization.id}`, {
        id: `m-${user.id}-${organization.id}`,
        userId: user.id,
        organizationId: organization.id,
        role: Role.ANALYST,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${organization.id}/invitations`)
        .set('Cookie', cookies)
        .send({
          email: 'newuser@reconcilex.test',
          role: Role.AUDITOR,
        })
        .expect(HttpStatus.FORBIDDEN);

      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow an ADMIN to update organization settings', async () => {
      const { cookies, organization } = await registerAndSync(
        'Admin User',
        'admin_patch@reconcilex.test',
        'Password123!',
        'Old Org Name',
      );

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${organization.id}`)
        .set('Cookie', cookies)
        .send({ name: 'Updated Org Name' })
        .expect(HttpStatus.OK);

      expect(response.body.name).toBe('Updated Org Name');
    });
  });

  describe('Last-Admin Protection', () => {
    it('should reject demoting the last ADMIN in an organization (400 Bad Request)', async () => {
      const { cookies, user, organization } = await registerAndSync(
        'Solo Admin',
        'solo_admin@reconcilex.test',
        'Password123!',
        'Solo Org',
      );

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${organization.id}/members/${user.id}`)
        .set('Cookie', cookies)
        .send({ role: Role.ANALYST })
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.error.code).toBe('BAD_REQUEST');
      expect(response.body.error.message).toContain(
        'Cannot demote the last organization administrator',
      );
    });

    it('should reject deleting the last ADMIN in an organization (400 Bad Request)', async () => {
      const { cookies, user, organization } = await registerAndSync(
        'Solo Admin 2',
        'solo_admin2@reconcilex.test',
        'Password123!',
        'Solo Org 2',
      );

      const response = await request(app.getHttpServer())
        .delete(`/api/v1/organizations/${organization.id}/members/${user.id}`)
        .set('Cookie', cookies)
        .expect(HttpStatus.BAD_REQUEST);

      expect(response.body.error.code).toBe('BAD_REQUEST');
      expect(response.body.error.message).toContain(
        'Cannot remove the last organization administrator',
      );
    });
  });

  describe('Member Invitation & Acceptance Flow', () => {
    it('should allow an ADMIN to invite a member and allow the member to accept', async () => {
      const { cookies, organization } = await registerAndSync(
        'Admin Inviter',
        'inviter@reconcilex.test',
        'Password123!',
        'Invites Corp',
      );

      // 1. Admin invites member
      const inviteResponse = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${organization.id}/invitations`)
        .set('Cookie', cookies)
        .send({
          email: 'invited_analyst@reconcilex.test',
          role: Role.ANALYST,
        })
        .expect(HttpStatus.CREATED);

      expect(inviteResponse.body.email).toBe('invited_analyst@reconcilex.test');
      expect(inviteResponse.body.role).toBe(Role.ANALYST);
      const inviteToken = inviteResponse.body.inviteToken;
      expect(inviteToken).toBeDefined();

      // 2. Invited member accepts invitation with name and password
      const acceptResponse = await request(app.getHttpServer())
        .post('/api/v1/invitations/accept')
        .send({
          token: inviteToken,
          name: 'Invited Analyst',
          password: 'SecurePassword123!',
        })
        .expect(HttpStatus.OK);

      expect(acceptResponse.body.success).toBe(true);
      expect(acceptResponse.body.role).toBe(Role.ANALYST);

      // 3. Admin lists members — both members should be present
      const membersResponse = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${organization.id}/members`)
        .set('Cookie', cookies)
        .expect(HttpStatus.OK);

      expect(membersResponse.body).toHaveLength(2);
      const analyst = membersResponse.body.find((m: { role: string }) => m.role === Role.ANALYST);
      expect(analyst).toBeDefined();
      expect(analyst.email).toBe('invited_analyst@reconcilex.test');
    });
  });
});
