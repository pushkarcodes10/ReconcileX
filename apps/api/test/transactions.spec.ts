import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Transaction, TransactionStatus } from '@reconcilex/db';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
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
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { InMemoryOrganizationsRepository } from '../src/modules/organizations/repositories/in-memory-organizations.repository';
import { ORGANIZATIONS_REPOSITORY } from '../src/modules/organizations/repositories/organizations.repository.interface';
import {
  DuplicateCandidatesController,
  TransactionsController,
} from '../src/modules/transactions/transactions.controller';
import { TransactionsService } from '../src/modules/transactions/transactions.service';
import { InMemoryTransactionsRepository } from '../src/modules/transactions/repositories/in-memory-transactions.repository';
import { TRANSACTIONS_REPOSITORY } from '../src/modules/transactions/repositories/transactions.repository.interface';

describe('Transactions & Duplicate Candidates Module (Phase A3)', () => {
  let app: INestApplication;
  let authRepo: InMemoryAuthRepository;
  let orgRepo: InMemoryOrganizationsRepository;
  let txnRepo: InMemoryTransactionsRepository;

  beforeAll(async () => {
    authRepo = new InMemoryAuthRepository();
    orgRepo = new InMemoryOrganizationsRepository();
    txnRepo = new InMemoryTransactionsRepository();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        JwtModule.register({}),
      ],
      controllers: [
        AuthController,
        TransactionsController,
        DuplicateCandidatesController,
      ],
      providers: [
        AuthService,
        PasswordService,
        TokenService,
        JwtAuthGuard,
        OrganizationsService,
        TransactionsService,
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
        {
          provide: TRANSACTIONS_REPOSITORY,
          useValue: txnRepo,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.use(new RequestIdMiddleware().use);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    authRepo.users = [];
    authRepo.organizations = [];
    authRepo.memberships = [];
    authRepo.refreshTokens = [];
    authRepo.invitations = [];
    orgRepo.organizations = authRepo.organizations;
    orgRepo.memberships = authRepo.memberships;
    orgRepo.users = authRepo.users;
    orgRepo.invitations = authRepo.invitations;
    txnRepo.transactions = [];
    txnRepo.duplicateCandidates = [];
  });

  const registerUser = async (
    email: string,
    orgName: string,
    name: string = 'Test User',
  ) => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'Password123!',
        name,
        organizationName: orgName,
      });

    return {
      body: res.body,
      cookie: res.headers['set-cookie'],
    };
  };

  const createDummyTxn = (
    organizationId: string,
    dataSourceId: string,
    externalId: string,
    amountMinor: number,
    currency: string = 'USD',
    reference?: string,
    date: Date = new Date(),
    status: TransactionStatus = TransactionStatus.IMPORTED,
  ): Transaction => ({
    id: randomUUID(),
    organizationId,
    dataSourceId,
    importId: null,
    externalId,
    amountMinor,
    currency,
    transactionDate: date,
    reference: reference || null,
    externalTxnId: null,
    merchantOrOrderId: null,
    txnType: 'CHARGE',
    status,
    normalizedPayload: null,
    fingerprint: 'sha256-dummy-fingerprint',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  describe('GET /organizations/:orgId/transactions', () => {
    it('should return empty paginated result on empty table', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;

      const res = await request(app.getHttpServer())
        .get(`/organizations/${orgId}/transactions`)
        .set('Cookie', cookie);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.data).toEqual([]);
      expect(res.body.total).toBe(0);
      expect(res.body.page).toBe(1);
      expect(res.body.limit).toBe(20);
      expect(res.body.totalPages).toBe(0);
    });

    it('should query transactions and apply filters correctly', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;
      const dsId = randomUUID();

      // Seed 3 transactions
      txnRepo.transactions.push(
        createDummyTxn(orgId, dsId, 'ORD-001', 10000, 'USD', 'INV-100', new Date('2026-01-10T10:00:00Z')),
        createDummyTxn(orgId, dsId, 'ORD-002', 25000, 'USD', 'INV-200', new Date('2026-01-15T10:00:00Z')),
        createDummyTxn(orgId, dsId, 'ORD-003', 50000, 'EUR', 'INV-300', new Date('2026-01-20T10:00:00Z')),
      );

      // Filter by minAmount
      const resAmount = await request(app.getHttpServer())
        .get(`/organizations/${orgId}/transactions?minAmount=20000`)
        .set('Cookie', cookie);

      expect(resAmount.status).toBe(HttpStatus.OK);
      expect(resAmount.body.total).toBe(2);

      // Filter by currency
      const resCurrency = await request(app.getHttpServer())
        .get(`/organizations/${orgId}/transactions?currency=EUR`)
        .set('Cookie', cookie);

      expect(resCurrency.status).toBe(HttpStatus.OK);
      expect(resCurrency.body.total).toBe(1);
      expect(resCurrency.body.data[0].externalId).toBe('ORD-003');

      // Search keyword `q`
      const resSearch = await request(app.getHttpServer())
        .get(`/organizations/${orgId}/transactions?q=INV-100`)
        .set('Cookie', cookie);

      expect(resSearch.status).toBe(HttpStatus.OK);
      expect(resSearch.body.total).toBe(1);
      expect(resSearch.body.data[0].externalId).toBe('ORD-001');

      // Date range filter
      const resDate = await request(app.getHttpServer())
        .get(`/organizations/${orgId}/transactions?startDate=2026-01-12T00:00:00Z&endDate=2026-01-18T00:00:00Z`)
        .set('Cookie', cookie);

      expect(resDate.status).toBe(HttpStatus.OK);
      expect(resDate.body.total).toBe(1);
      expect(resDate.body.data[0].externalId).toBe('ORD-002');
    });

    it('should paginate results properly', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;
      const dsId = randomUUID();

      for (let i = 1; i <= 5; i++) {
        txnRepo.transactions.push(
          createDummyTxn(orgId, dsId, `ORD-00${i}`, i * 1000, 'USD', `REF-${i}`),
        );
      }

      const res = await request(app.getHttpServer())
        .get(`/organizations/${orgId}/transactions?page=2&limit=2`)
        .set('Cookie', cookie);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.total).toBe(5);
      expect(res.body.data.length).toBe(2);
      expect(res.body.page).toBe(2);
      expect(res.body.limit).toBe(2);
      expect(res.body.totalPages).toBe(3);
    });
  });

  describe('GET /organizations/:orgId/transactions/:id', () => {
    it('should retrieve single transaction details', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;
      const dsId = randomUUID();

      const txn = createDummyTxn(orgId, dsId, 'ORD-999', 4200, 'USD', 'REF-999');
      txnRepo.transactions.push(txn);

      const res = await request(app.getHttpServer())
        .get(`/organizations/${orgId}/transactions/${txn.id}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(HttpStatus.OK);
      expect(res.body.id).toBe(txn.id);
      expect(res.body.externalId).toBe('ORD-999');
      expect(res.body.amountMinor).toBe(4200);
    });

    it('should return 404 when transaction is not found', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;
      const fakeId = randomUUID();

      const res = await request(app.getHttpServer())
        .get(`/organizations/${orgId}/transactions/${fakeId}`)
        .set('Cookie', cookie);

      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });

    it('should return 404 when user in Org A attempts to access transaction in Org B', async () => {
      const orgA = await registerUser('adminA@corp.com', 'Org A');
      const orgB = await registerUser('adminB@corp.com', 'Org B');

      const txnB = createDummyTxn(
        orgB.body.organization.id,
        randomUUID(),
        'ORG-B-TXN',
        50000,
      );
      txnRepo.transactions.push(txnB);

      // Org A user queries Org B's transaction
      const res = await request(app.getHttpServer())
        .get(`/organizations/${orgB.body.organization.id}/transactions/${txnB.id}`)
        .set('Cookie', orgA.cookie);

      // OrgGuard prevents IDOR: returns 404
      expect(res.status).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('GET /organizations/:orgId/duplicate-candidates', () => {
    it('should list flagged duplicate candidates', async () => {
      const { body, cookie } = await registerUser('admin@corp.com', 'Acme Corp');
      const orgId = body.organization.id;
      const dsId = randomUUID();

      txnRepo.duplicateCandidates.push({
        id: randomUUID(),
        organizationId: orgId,
        dataSourceId: dsId,
        existingTransactionId: randomUUID(),
        candidateTransactionId: null,
        externalId: 'ORD-DUP-1',
        reason: 'Duplicate external_id detected in batch',
        status: 'FLAGGED',
        metadata: { rawAmount: '100.00' },
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get(`/organizations/${orgId}/duplicate-candidates`)
        .set('Cookie', cookie);

      expect(res.status).toBe(HttpStatus.OK);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].externalId).toBe('ORD-DUP-1');
      expect(res.body[0].status).toBe('FLAGGED');
    });
  });
});
