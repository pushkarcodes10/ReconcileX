import { HttpStatus, INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@reconcilex/db';
import cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as path from 'path';
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
import { ImportsController } from '../src/modules/imports/imports.controller';
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

const DUMMY_DATA_DIR = path.resolve('C:/Users/Pushkar Raj/Downloads/ReconcileX_Dummy_Test_Data');
const hasDummyData = fs.existsSync(DUMMY_DATA_DIR);

describe.skipIf(!hasDummyData)('Dummy Dataset End-to-End Import Pipeline', () => {
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
      password: 'StrongPassword123!',
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
    name: string,
    type: string,
    columnMapping: Record<string, string>,
  ) => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/orgs/${orgId}/data-sources`)
      .set('Cookie', cookies)
      .send({
        name,
        type,
        columnMapping,
      });

    return res.body;
  };

  const standardMapping = {
    external_id: 'external_id',
    amount: 'amount',
    date: 'transaction_date',
    currency: 'currency',
    reference: 'reference',
    external_txn_id: 'external_txn_id',
    merchant_or_order_id: 'merchant_or_order_id',
    txn_type: 'txn_type',
  };

  it('1. should import 01_internal_orders.csv with exact counts, errors, and duplicates', async () => {
    const filePath = path.join(DUMMY_DATA_DIR, '01_internal_orders.csv');
    const fileBuffer = fs.readFileSync(filePath);

    const user = await registerUser('lead@northstar.com', 'Northstar Retail');
    const dataSource = await createDataSource(
      user.cookies,
      user.orgId,
      'Internal Orders',
      'INTERNAL_ORDERS',
      standardMapping,
    );

    const uploadRes = await request(app.getHttpServer())
      .post(`/api/v1/orgs/${user.orgId}/data-sources/${dataSource.id}/imports`)
      .set('Cookie', user.cookies)
      .attach('file', fileBuffer, '01_internal_orders.csv')
      .expect(HttpStatus.ACCEPTED);

    expect(uploadRes.body.status).toBe('COMPLETED');
    expect(uploadRes.body.duplicateFile).toBe(false);
    expect(uploadRes.body.rowCount).toBe(1215);
    expect(uploadRes.body.validCount).toBe(1200);
    expect(uploadRes.body.invalidCount).toBe(3);
    expect(uploadRes.body.duplicateCount).toBe(12);

    // Verify error detail API surfaces row numbers and reasons
    const errorsRes = await request(app.getHttpServer())
      .get(`/api/v1/orgs/${user.orgId}/imports/${uploadRes.body.importId}/errors`)
      .set('Cookie', user.cookies)
      .expect(HttpStatus.OK);

    const errorsList = errorsRes.body.data || errorsRes.body.items;
    expect(errorsList).toHaveLength(3);
    const rowNumbers = errorsList.map((e: any) => e.rowNumber).sort();
    expect(rowNumbers).toEqual([1214, 1215, 1216]);

    // Verify database transactions created
    const txnsRes = await request(app.getHttpServer())
      .get(`/api/v1/orgs/${user.orgId}/transactions?sourceId=${dataSource.id}&limit=100`)
      .set('Cookie', user.cookies)
      .expect(HttpStatus.OK);

    expect(txnsRes.body.total).toBe(1200);
  });

  it('2. should import 02_payment_gateway.csv with exact counts, errors, and duplicates', async () => {
    const filePath = path.join(DUMMY_DATA_DIR, '02_payment_gateway.csv');
    const fileBuffer = fs.readFileSync(filePath);

    const user = await registerUser('finance@gateway.com', 'Gateway Org');
    const dataSource = await createDataSource(
      user.cookies,
      user.orgId,
      'Payment Gateway',
      'PAYMENT_GATEWAY',
      standardMapping,
    );

    const uploadRes = await request(app.getHttpServer())
      .post(`/api/v1/orgs/${user.orgId}/data-sources/${dataSource.id}/imports`)
      .set('Cookie', user.cookies)
      .attach('file', fileBuffer, '02_payment_gateway.csv')
      .expect(HttpStatus.ACCEPTED);

    expect(uploadRes.body.status).toBe('COMPLETED');
    expect(uploadRes.body.rowCount).toBe(1214);
    expect(uploadRes.body.validCount).toBe(1200);
    expect(uploadRes.body.invalidCount).toBe(2);
    expect(uploadRes.body.duplicateCount).toBe(12);

    const errorsRes = await request(app.getHttpServer())
      .get(`/api/v1/orgs/${user.orgId}/imports/${uploadRes.body.importId}/errors`)
      .set('Cookie', user.cookies)
      .expect(HttpStatus.OK);

    const errorsList = errorsRes.body.data || errorsRes.body.items;
    expect(errorsList).toHaveLength(2);
    const rowNumbers = errorsList.map((e: any) => e.rowNumber).sort();
    expect(rowNumbers).toEqual([1214, 1215]);
  });

  it('3. should import 03_bank_statement.csv cleanly with 1400 valid rows', async () => {
    const filePath = path.join(DUMMY_DATA_DIR, '03_bank_statement.csv');
    const fileBuffer = fs.readFileSync(filePath);

    const user = await registerUser('treasury@bank.com', 'Treasury Corp');
    const dataSource = await createDataSource(
      user.cookies,
      user.orgId,
      'Bank Statement',
      'BANK',
      standardMapping,
    );

    const uploadRes = await request(app.getHttpServer())
      .post(`/api/v1/orgs/${user.orgId}/data-sources/${dataSource.id}/imports`)
      .set('Cookie', user.cookies)
      .attach('file', fileBuffer, '03_bank_statement.csv')
      .expect(HttpStatus.ACCEPTED);

    expect(uploadRes.body.status).toBe('COMPLETED');
    expect(uploadRes.body.rowCount).toBe(1400);
    expect(uploadRes.body.validCount).toBe(1400);
    expect(uploadRes.body.invalidCount).toBe(0);
    expect(uploadRes.body.duplicateCount).toBe(0);
  });

  it('4. should detect 04_duplicate_upload_test.csv as duplicate file in same org', async () => {
    const file01 = fs.readFileSync(path.join(DUMMY_DATA_DIR, '01_internal_orders.csv'));
    const file04 = fs.readFileSync(path.join(DUMMY_DATA_DIR, '04_duplicate_upload_test.csv'));

    const user = await registerUser('dup@test.com', 'Duplicate Test Org');
    const dataSource = await createDataSource(
      user.cookies,
      user.orgId,
      'Internal Orders',
      'INTERNAL_ORDERS',
      standardMapping,
    );

    // Initial upload
    const firstUpload = await request(app.getHttpServer())
      .post(`/api/v1/orgs/${user.orgId}/data-sources/${dataSource.id}/imports`)
      .set('Cookie', user.cookies)
      .attach('file', file01, '01_internal_orders.csv')
      .expect(HttpStatus.ACCEPTED);

    expect(firstUpload.body.duplicateFile).toBe(false);

    // Duplicate upload with different filename (file04)
    const duplicateUpload = await request(app.getHttpServer())
      .post(`/api/v1/orgs/${user.orgId}/data-sources/${dataSource.id}/imports`)
      .set('Cookie', user.cookies)
      .attach('file', file04, '04_duplicate_upload_test.csv')
      .expect(HttpStatus.ACCEPTED);

    expect(duplicateUpload.body.duplicateFile).toBe(true);
    expect(duplicateUpload.body.importId).toBe(firstUpload.body.importId);

    // Verify transaction count remained 1200 (no duplicate transactions inserted)
    const txnsRes = await request(app.getHttpServer())
      .get(`/api/v1/orgs/${user.orgId}/transactions?sourceId=${dataSource.id}&limit=10`)
      .set('Cookie', user.cookies)
      .expect(HttpStatus.OK);

    expect(txnsRes.body.total).toBe(1200);
  });

  it('5. should respect tenant isolation when uploading the exact same file to Org B', async () => {
    const file01 = fs.readFileSync(path.join(DUMMY_DATA_DIR, '01_internal_orders.csv'));

    const userA = await registerUser('user_a@org-a.com', 'Organization A');
    const dsA = await createDataSource(
      userA.cookies,
      userA.orgId,
      'Internal Orders A',
      'INTERNAL_ORDERS',
      standardMapping,
    );

    // Upload to Org A
    await request(app.getHttpServer())
      .post(`/api/v1/orgs/${userA.orgId}/data-sources/${dsA.id}/imports`)
      .set('Cookie', userA.cookies)
      .attach('file', file01, '01_internal_orders.csv')
      .expect(HttpStatus.ACCEPTED);

    // Register Org B
    const userB = await registerUser('user_b@org-b.com', 'Organization B');
    const dsB = await createDataSource(
      userB.cookies,
      userB.orgId,
      'Internal Orders B',
      'INTERNAL_ORDERS',
      standardMapping,
    );

    // Upload to Org B: MUST NOT be flagged as duplicate file
    const uploadB = await request(app.getHttpServer())
      .post(`/api/v1/orgs/${userB.orgId}/data-sources/${dsB.id}/imports`)
      .set('Cookie', userB.cookies)
      .attach('file', file01, '01_internal_orders.csv')
      .expect(HttpStatus.ACCEPTED);

    expect(uploadB.body.duplicateFile).toBe(false);
    expect(uploadB.body.validCount).toBe(1200);

    // Org B cannot access Org A transactions (returns 404 IDOR prevention)
    await request(app.getHttpServer())
      .get(`/api/v1/orgs/${userA.orgId}/transactions`)
      .set('Cookie', userB.cookies)
      .expect(HttpStatus.NOT_FOUND);
  });
});
