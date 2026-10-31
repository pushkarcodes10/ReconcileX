import { Module } from '@nestjs/common';
import { OrgGuard } from '../../common/guards/org.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { DataSourcesController } from './data-sources.controller';
import { DataSourcesService } from './data-sources.service';
import { DATA_SOURCES_REPOSITORY } from './repositories/data-sources.repository.interface';
import { DrizzleDataSourcesRepository } from './repositories/drizzle-data-sources.repository';

@Module({
  controllers: [DataSourcesController],
  providers: [
    DataSourcesService,
    OrgGuard,
    RolesGuard,
    {
      provide: DATA_SOURCES_REPOSITORY,
      useClass: DrizzleDataSourcesRepository,
    },
  ],
  exports: [DataSourcesService, DATA_SOURCES_REPOSITORY],
})
export class DataSourcesModule {}
