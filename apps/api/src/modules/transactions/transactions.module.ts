import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { DrizzleTransactionsRepository } from './repositories/drizzle-transactions.repository';
import { TRANSACTIONS_REPOSITORY } from './repositories/transactions.repository.interface';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    {
      provide: TRANSACTIONS_REPOSITORY,
      useClass: DrizzleTransactionsRepository,
    },
  ],
  exports: [TransactionsService, TRANSACTIONS_REPOSITORY],
})
export class TransactionsModule {}
