import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { DataSourcesController } from './data-sources.controller';
import { DataSourcesService } from './data-sources.service';
import { DATA_SOURCES_REPOSITORY } from './repositories/data-sources.repository.interface';
import { DrizzleDataSourcesRepository } from './repositories/drizzle-data-sources.repository';

@Module({
  imports: [OrganizationsModule],
  controllers: [DataSourcesController],
  providers: [
    DataSourcesService,
    {
      provide: DATA_SOURCES_REPOSITORY,
      useClass: DrizzleDataSourcesRepository,
    },
  ],
  exports: [DataSourcesService, DATA_SOURCES_REPOSITORY],
})
export class DataSourcesModule {}
