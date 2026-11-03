import { Module } from '@nestjs/common';
import { OrgGuard } from '../../common/guards/org.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuditModule } from '../audit/audit.module';
import { DataSourcesModule } from '../data-sources/data-sources.module';
import { JobsModule } from '../jobs/jobs.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { StorageModule } from '../storage/storage.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { JOB_SERVICE } from './job/job.service.interface';
import { SyncJobService } from './job/sync-job.service';
import { DrizzleImportsRepository } from './repositories/drizzle-imports.repository';
import { IMPORTS_REPOSITORY } from './repositories/imports.repository.interface';

@Module({
  imports: [
    OrganizationsModule,
    DataSourcesModule,
    TransactionsModule,
    StorageModule,
    AuditModule,
    JobsModule,
  ],
  controllers: [ImportsController],
  providers: [
    ImportsService,
    OrgGuard,
    RolesGuard,
    {
      provide: IMPORTS_REPOSITORY,
      useClass: DrizzleImportsRepository,
    },
    {
      provide: JOB_SERVICE,
      useClass: SyncJobService,
    },
  ],
  exports: [ImportsService, IMPORTS_REPOSITORY, JOB_SERVICE],
})
export class ImportsModule {}
