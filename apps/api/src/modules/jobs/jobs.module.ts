import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { DrizzleJobsRepository } from './repositories/drizzle-jobs.repository';
import { JOBS_REPOSITORY } from './repositories/jobs.repository.interface';

@Module({
  imports: [DatabaseModule, OrganizationsModule],
  controllers: [JobsController],
  providers: [
    JobsService,
    {
      provide: JOBS_REPOSITORY,
      useClass: DrizzleJobsRepository,
    },
  ],
  exports: [JobsService, JOBS_REPOSITORY],
})
export class JobsModule {}
