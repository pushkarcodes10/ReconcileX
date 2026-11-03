import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { ExceptionsController } from './exceptions.controller';
import { ExceptionsService } from './exceptions.service';
import { DrizzleExceptionsRepository } from './repositories/drizzle-exceptions.repository';
import { EXCEPTIONS_REPOSITORY } from './repositories/exceptions.repository.interface';

@Module({
  imports: [DatabaseModule, OrganizationsModule],
  controllers: [ExceptionsController],
  providers: [
    ExceptionsService,
    {
      provide: EXCEPTIONS_REPOSITORY,
      useClass: DrizzleExceptionsRepository,
    },
  ],
  exports: [ExceptionsService, EXCEPTIONS_REPOSITORY],
})
export class ExceptionsModule {}
