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
import { DataSourcesController } from '../src/modules/data-sources/data-sources.controller';
import { DataSourcesService } from '../src/modules/data-sources/data-sources.service';
import { DATA_SOURCES_REPOSITORY } from '../src/modules/data-sources/repositories/data-sources.repository.interface';
import { InMemoryDataSourcesRepository } from '../src/modules/data-sources/repositories/in-memory-data-sources.repository';
import { DuplicateCandidateDto, ImportRowErrorDto } from '../src/modules/imports/dto/import.dto';
import { ImportsController } from '../src/modules/imports/imports.controller';
import { TransactionListItemDto } from '../src/modules/transactions/dto/transaction.dto';
import { ImportsService } from '../src/modules/imports/imports.service';
import { JOB_SERVICE } from '../src/modules/imports/job/job.service.interface';
import { SyncJobService } from '../src/modules/imports/job/sync-job.service';
import { IMPORTS_REPOSITORY } from '../src/modules/imports/repositories/imports.repository.interface';
import { InMemoryImportsRepository } from '../src/modules/imports/repositories/in-memory-imports.repository';
import { OrganizationsService } from '../src/modules/organizations/organizations.service';
import { InMemoryOrganizationsRepository } from '../src/modules/organizations/repositories/in-memory-organizations.repository';
import { ORGANIZATIONS_REPOSITORY } from '../src/modules/organizations/repositories/organizations.repository.interface';
import { InMemoryStorageService } from '../src/modules/storage/in-memory-storage.service';
import { STORAGE_SERVICE } from '../src/modules/storage/storage.constants';
import { InMemoryTransactionsRepository } from '../src/modules/transactions/repositories/in-memory-transactions.repository';
import { TRANSACTIONS_REPOSITORY } from '../src/modules/transactions/repositories/transactions.repository.interface';
import { TransactionsController } from '../src/modules/transactions/transactions.controller';
import { TransactionsService } from '../src/modules/transactions/transactions.service';

describe('Imports & CSV Ingestion (Phase A4)', () => {
  let app: INestApplication;
  let authRepo: InMemoryAuthRepository;
  let orgRepo: InMemoryOrganizationsRepository;
  let dataSourcesRepo: InMemoryDataSourcesRepository;
  let txnRepo: InMemoryTransactionsRepository;
  let importsRepo: InMemoryImportsRepository;
  let storageService: InMemoryStorageService;

  beforeAll(async () => {
    authRepo = new InMemoryAuthRepository();
    orgRepo = new InMemoryOrganizationsRepository();
    dataSourcesRepo = new InMemoryDataSourcesRepository();
    txnRepo = new InMemoryTransactionsRepository();
    importsRepo = new InMemoryImportsRepository();
    storageService = new InMemoryStorageService();

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
        DataSourcesController,
        TransactionsController,
        ImportsController,
      ],
      providers: [
        AuthService,
        PasswordService,
        TokenService,
        JwtAuthGuard,
        OrganizationsService,
        DataSourcesService,
        TransactionsService,
        ImportsService,
        SyncJobService,
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
          provide: DATA_SOURCES_REPOSITORY,
          useValue: dataSourcesRepo,
        },
        {
          provide: TRANSACTIONS_REPOSITORY,
          useValue: txnRepo,
        },
        {
          provide: IMPORTS_REPOSITORY,
          useValue: importsRepo,
        },
        {
          provide: STORAGE_SERVICE,
          useValue: storageService,
        },
        {
          provide: JOB_SERVICE,
          useClass: SyncJobService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix('api/v1');
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
    authRepo.clear();
    orgRepo.clear();
    dataSourcesRepo.clear();
    txnRepo.clear();
    importsRepo.clear();
    storageService.clear();
  });

  const registerUser = async (email: string, orgName: string, name: string = 'Test User') => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email,
      password: 'Password123!',
      name,
      orgName,
    });

    const user = res.body.user;
    const organization = res.body.organization;
    const cookies = res.headers['set-cookie'] as unknown as string[];

    if (user && organization) {
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
    }

    return { cookies, orgId: organization.id, userId: user.id };
  };

  const createDataSource = async (
    cookies: string[],
    orgId: string,
    name: string = 'Stripe Payments',
    columnMapping = {
      external_id: 'Order ID',
      amount: 'Transaction Amount',
      date: 'Payment Date',
      currency: 'Currency',
      reference: 'Reference Number',
    },
  ) => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orgs/${orgId}/data-sources`)
      .set('Cookie', cookies)
      .send({
        name,
        type: 'PAYMENT_GATEWAY',
        columnMapping,
      });

    return res.body;
  };

  describe('CSV Upload and Ingestion Pipeline', () => {
    it('should successfully upload CSV, normalize money into integer minor units, and insert transactions', async () => {
      const user = await registerUser('fin_lead@acme.com', 'Acme Corp');
      const dataSource = await createDataSource(user.cookies, user.orgId);

      const csvContent = [
        'Order ID,Transaction Amount,Payment Date,Currency,Reference Number',
        'ORD-1001,"₹1,000.00",2026-03-01,INR,REF-1001',
        'ORD-1002,250.50,15-03-2026,USD,REF-1002',
      ].join('\n');

      const uploadRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/data-sources/${dataSource.id}/imports`)
        .set('Cookie', user.cookies)
        .attach('file', Buffer.from(csvContent), 'transactions.csv')
        .expect(HttpStatus.ACCEPTED);

      expect(uploadRes.body.importId).toBeDefined();
      expect(uploadRes.body.status).toBe('COMPLETED');
      expect(uploadRes.body.duplicateFile).toBe(false);

      const importId = uploadRes.body.importId;

      // Verify import details and counters
      const importRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/imports/${importId}`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      expect(importRes.body.status).toBe('COMPLETED');
      expect(importRes.body.rowCount).toBe(2);
      expect(importRes.body.validCount).toBe(2);
      expect(importRes.body.invalidCount).toBe(0);
      expect(importRes.body.duplicateCount).toBe(0);

      // Verify transactions read API has both rows with correct minor units
      const txnsRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/transactions`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      expect(txnsRes.body.data).toHaveLength(2);

      const ord1001 = txnsRes.body.data.find(
        (t: TransactionListItemDto) => t.externalId === 'ORD-1001',
      );
      expect(ord1001).toBeDefined();
      expect(ord1001.amountMinor).toBe(100000); // ₹1,000.00 -> 100000 paise
      expect(ord1001.currency).toBe('INR');
      expect(ord1001.reference).toBe('REF-1001');
      expect(ord1001.importId).toBe(importId);

      const ord1002 = txnsRes.body.data.find(
        (t: TransactionListItemDto) => t.externalId === 'ORD-1002',
      );
      expect(ord1002).toBeDefined();
      expect(ord1002.amountMinor).toBe(25050); // 250.50 -> 25050 cents
      expect(ord1002.currency).toBe('USD');
    });

    it('should short-circuit and return existing import when uploading an identical file (content SHA-256 deduplication)', async () => {
      const user = await registerUser('fin_ops@acme.com', 'Acme Corp');
      const dataSource = await createDataSource(user.cookies, user.orgId);

      const csvContent = [
        'Order ID,Transaction Amount,Payment Date,Currency,Reference Number',
        'ORD-DUPE-FILE-1,100.00,2026-03-01,INR,REF-1',
      ].join('\n');

      // First upload
      const upload1 = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/data-sources/${dataSource.id}/imports`)
        .set('Cookie', user.cookies)
        .attach('file', Buffer.from(csvContent), 'batch1.csv')
        .expect(HttpStatus.ACCEPTED);

      expect(upload1.body.duplicateFile).toBe(false);

      // Second upload with identical content
      const upload2 = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/data-sources/${dataSource.id}/imports`)
        .set('Cookie', user.cookies)
        .attach('file', Buffer.from(csvContent), 'batch1_retry.csv')
        .expect(HttpStatus.ACCEPTED);

      expect(upload2.body.duplicateFile).toBe(true);
      expect(upload2.body.importId).toBe(upload1.body.importId);

      // Only 1 transaction should exist
      const txnsRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/transactions`)
        .set('Cookie', user.cookies);
      expect(txnsRes.body.data).toHaveLength(1);
    });

    it('should collect row-level validation errors without aborting valid rows', async () => {
      const user = await registerUser('errors_test@acme.com', 'Acme Corp');
      const dataSource = await createDataSource(user.cookies, user.orgId);

      const csvContent = [
        'Order ID,Transaction Amount,Payment Date,Currency,Reference Number',
        'ORD-VALID,500.00,2026-03-01,INR,REF-VALID',
        'ORD-BAD-AMT,NOT_A_NUMBER,2026-03-01,INR,REF-ERR1',
        'ORD-BAD-DATE,100.00,32-01-2026,INR,REF-ERR2',
        ',200.00,2026-03-01,INR,REF-NO-ID',
      ].join('\n');

      const uploadRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/data-sources/${dataSource.id}/imports`)
        .set('Cookie', user.cookies)
        .attach('file', Buffer.from(csvContent), 'partial_errors.csv')
        .expect(HttpStatus.ACCEPTED);

      const importId = uploadRes.body.importId;

      const importRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/imports/${importId}`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      expect(importRes.body.rowCount).toBe(4);
      expect(importRes.body.validCount).toBe(1);
      expect(importRes.body.invalidCount).toBe(3);

      // Fetch row errors
      const errorsRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/imports/${importId}/errors`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      expect(errorsRes.body.data).toHaveLength(3);
      expect(
        errorsRes.body.data.some(
          (e: ImportRowErrorDto) => e.code === 'INVALID_AMOUNT' && e.rowNumber === 3,
        ),
      ).toBe(true);
      expect(
        errorsRes.body.data.some(
          (e: ImportRowErrorDto) => e.code === 'INVALID_DATE_DAY' && e.rowNumber === 4,
        ),
      ).toBe(true);
      expect(
        errorsRes.body.data.some(
          (e: ImportRowErrorDto) => e.code === 'MISSING_REQUIRED_FIELD' && e.rowNumber === 5,
        ),
      ).toBe(true);

      // Verify only valid transaction was saved
      const txnsRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/transactions`)
        .set('Cookie', user.cookies);
      expect(txnsRes.body.data).toHaveLength(1);
      expect(txnsRes.body.data[0].externalId).toBe('ORD-VALID');
    });

    it('should quarantine within-file and cross-file duplicate external_ids into duplicate_candidates table with FLAGGED status', async () => {
      const user = await registerUser('dupes_test@acme.com', 'Acme Corp');
      const dataSource = await createDataSource(user.cookies, user.orgId);

      // File 1: contains within-file duplicate external_id (ORD-A appears twice)
      const csvFile1 = [
        'Order ID,Transaction Amount,Payment Date,Currency,Reference Number',
        'ORD-A,100.00,2026-03-01,INR,REF-1',
        'ORD-B,200.00,2026-03-01,INR,REF-2',
        'ORD-A,100.00,2026-03-01,INR,REF-1-DUPE',
      ].join('\n');

      const upload1 = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/data-sources/${dataSource.id}/imports`)
        .set('Cookie', user.cookies)
        .attach('file', Buffer.from(csvFile1), 'within_file_dupes.csv')
        .expect(HttpStatus.ACCEPTED);

      expect(upload1.body.status).toBe('COMPLETED');

      // File 2: contains ORD-B which already exists in DB
      const csvFile2 = [
        'Order ID,Transaction Amount,Payment Date,Currency,Reference Number',
        'ORD-B,200.00,2026-03-01,INR,REF-2-AGAIN',
        'ORD-C,300.00,2026-03-01,INR,REF-3',
      ].join('\n');

      const upload2 = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/data-sources/${dataSource.id}/imports`)
        .set('Cookie', user.cookies)
        .attach('file', Buffer.from(csvFile2), 'cross_file_dupes.csv')
        .expect(HttpStatus.ACCEPTED);

      expect(upload2.body.status).toBe('COMPLETED');

      // Verify duplicate candidates list
      const dupesRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/duplicate-candidates`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      expect(dupesRes.body.data).toHaveLength(2);

      const withinFile = dupesRes.body.data.find(
        (d: DuplicateCandidateDto) => d.reason === 'WITHIN_FILE_DUPLICATE',
      );
      expect(withinFile).toBeDefined();
      expect(withinFile.externalId).toBe('ORD-A');
      expect(withinFile.status).toBe('FLAGGED');

      const existingInDb = dupesRes.body.data.find(
        (d: DuplicateCandidateDto) => d.reason === 'EXISTING_EXTERNAL_ID',
      );
      expect(existingInDb).toBeDefined();
      expect(existingInDb.externalId).toBe('ORD-B');
      expect(existingInDb.status).toBe('FLAGGED');
      expect(existingInDb.existingTransactionId).toBeDefined();
    });

    it('should fail import when CSV headers do not match data source column mapping', async () => {
      const user = await registerUser('mismatch@acme.com', 'Acme Corp');
      const dataSource = await createDataSource(user.cookies, user.orgId);

      const csvContent = ['Wrong Header 1,Wrong Header 2', 'Val 1,Val 2'].join('\n');

      const uploadRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/data-sources/${dataSource.id}/imports`)
        .set('Cookie', user.cookies)
        .attach('file', Buffer.from(csvContent), 'mismatched_headers.csv')
        .expect(HttpStatus.ACCEPTED);

      const importId = uploadRes.body.importId;

      const importRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/imports/${importId}`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      expect(importRes.body.status).toBe('FAILED');
      expect(importRes.body.validCount).toBe(0);

      // Verify header error in errors list
      const errorsRes = await request(app.getHttpServer())
        .get(`/api/v1/orgs/${user.orgId}/imports/${importId}/errors`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.OK);

      expect(errorsRes.body.data.length).toBeGreaterThan(0);
      expect(errorsRes.body.data[0].code).toBe('INVALID_HEADERS');
    });
  });

  describe('Tenant Isolation & Security', () => {
    it('should return 404 when user in Org A attempts to upload CSV to Org B data source (prevents IDOR)', async () => {
      const orgA = await registerUser('alice@orga.com', 'Org A');
      const orgB = await registerUser('bob@orgb.com', 'Org B');

      const dataSourceB = await createDataSource(orgB.cookies, orgB.orgId, 'Org B Source');

      const csvContent =
        'Order ID,Transaction Amount,Payment Date,Currency,Reference Number\nORD-1,100,2026-03-01,INR,REF-1';

      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgA.orgId}/data-sources/${dataSourceB.id}/imports`)
        .set('Cookie', orgA.cookies)
        .attach('file', Buffer.from(csvContent), 'test.csv')
        .expect(HttpStatus.NOT_FOUND);
    });

    it('should return 404 when user in Org A attempts to view Org B import or errors', async () => {
      const orgA = await registerUser('alice2@orga.com', 'Org A');
      const orgB = await registerUser('bob2@orgb.com', 'Org B');

      const dataSourceB = await createDataSource(orgB.cookies, orgB.orgId, 'Org B Source');

      const csvContent =
        'Order ID,Transaction Amount,Payment Date,Currency,Reference Number\nORD-1,100.00,2026-03-01,INR,REF-1';
      const uploadRes = await request(app.getHttpServer())
        .post(`/api/v1/orgs/${orgB.orgId}/data-sources/${dataSourceB.id}/imports`)
        .set('Cookie', orgB.cookies)
        .attach('file', Buffer.from(csvContent), 'test.csv')
        .expect(HttpStatus.ACCEPTED);

      const importId = uploadRes.body.importId;

      // Org A attempts to view Org B import
      await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgA.orgId}/imports/${importId}`)
        .set('Cookie', orgA.cookies)
        .expect(HttpStatus.NOT_FOUND);

      // Org A attempts to view Org B errors
      await request(app.getHttpServer())
        .get(`/api/v1/orgs/${orgA.orgId}/imports/${importId}/errors`)
        .set('Cookie', orgA.cookies)
        .expect(HttpStatus.NOT_FOUND);
    });
  });

  describe('RBAC & Role Protection', () => {
    it('should return 403 Forbidden when AUDITOR role attempts to upload CSV', async () => {
      const admin = await registerUser('admin@corp.com', 'Corp');
      const dataSource = await createDataSource(admin.cookies, admin.orgId);

      // Register auditor in second organization, then add membership in Corp with AUDITOR role
      const auditor = await registerUser('auditor@corp.com', 'Corp 2');
      const membershipId = `m-${auditor.userId}-${admin.orgId}`;
      orgRepo.memberships.set(membershipId, {
        id: membershipId,
        userId: auditor.userId,
        organizationId: admin.orgId,
        role: Role.AUDITOR,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const csvContent =
        'Order ID,Transaction Amount,Payment Date,Currency,Reference Number\nORD-1,100,2026-03-01,INR,REF-1';

      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${admin.orgId}/data-sources/${dataSource.id}/imports`)
        .set('Cookie', auditor.cookies)
        .attach('file', Buffer.from(csvContent), 'test.csv')
        .expect(HttpStatus.FORBIDDEN);
    });

    it('should return 401 Unauthorized when unauthenticated user uploads CSV', async () => {
      await request(app.getHttpServer())
        .post(
          '/api/v1/orgs/00000000-0000-0000-0000-000000000000/data-sources/00000000-0000-0000-0000-000000000000/imports',
        )
        .attach('file', Buffer.from('test'), 'test.csv')
        .expect(HttpStatus.UNAUTHORIZED);
    });
  });

  describe('File Validation Constraints', () => {
    it('should return 400 Bad Request when uploading non-CSV file', async () => {
      const user = await registerUser('files@acme.com', 'Acme Corp');
      const dataSource = await createDataSource(user.cookies, user.orgId);

      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/data-sources/${dataSource.id}/imports`)
        .set('Cookie', user.cookies)
        .attach('file', Buffer.from('executable binary code'), 'malicious.exe')
        .expect(HttpStatus.BAD_REQUEST);
    });

    it('should return 400 Bad Request when file is omitted', async () => {
      const user = await registerUser('nofile@acme.com', 'Acme Corp');
      const dataSource = await createDataSource(user.cookies, user.orgId);

      await request(app.getHttpServer())
        .post(`/api/v1/orgs/${user.orgId}/data-sources/${dataSource.id}/imports`)
        .set('Cookie', user.cookies)
        .expect(HttpStatus.BAD_REQUEST);
    });
  });
});
