import { forwardRef, Module } from '@nestjs/common';
import { DataSourcesModule } from '../data-sources/data-sources.module';
import { ExceptionsModule } from '../exceptions/exceptions.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { RECONCILIATION_JOB_SERVICE } from './job/reconciliation-job.interface';
import { SyncReconciliationJobService } from './job/sync-reconciliation-job.service';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';
import { DrizzleReconciliationRepository } from './repositories/drizzle-reconciliation.repository';
import { RECONCILIATION_REPOSITORY } from './repositories/reconciliation.repository.interface';

@Module({
  imports: [
    OrganizationsModule,
    DataSourcesModule,
    TransactionsModule,
    forwardRef(() => ExceptionsModule),
  ],
  controllers: [ReconciliationController],
  providers: [
    ReconciliationService,
    {
      provide: RECONCILIATION_REPOSITORY,
      useClass: DrizzleReconciliationRepository,
    },
    {
      provide: RECONCILIATION_JOB_SERVICE,
      useClass: SyncReconciliationJobService,
    },
  ],
  exports: [ReconciliationService, RECONCILIATION_REPOSITORY, RECONCILIATION_JOB_SERVICE],
})
export class ReconciliationModule {}
