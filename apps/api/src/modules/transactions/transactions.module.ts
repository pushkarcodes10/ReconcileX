import { Module } from '@nestjs/common';
import { OrgGuard } from '../../common/guards/org.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DrizzleTransactionsRepository } from './repositories/drizzle-transactions.repository';
import { TRANSACTIONS_REPOSITORY } from './repositories/transactions.repository.interface';
import {
  DuplicateCandidatesController,
  TransactionsController,
} from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  controllers: [TransactionsController, DuplicateCandidatesController],
  providers: [
    TransactionsService,
    OrgGuard,
    RolesGuard,
    {
      provide: TRANSACTIONS_REPOSITORY,
      useClass: DrizzleTransactionsRepository,
    },
  ],
  exports: [TransactionsService, TRANSACTIONS_REPOSITORY],
})
export class TransactionsModule {}
