import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DrizzleDashboardRepository } from './repositories/drizzle-dashboard.repository';
import { DASHBOARD_REPOSITORY } from './repositories/dashboard.repository.interface';

@Module({
  imports: [DatabaseModule, OrganizationsModule, AuditModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    {
      provide: DASHBOARD_REPOSITORY,
      useClass: DrizzleDashboardRepository,
    },
  ],
  exports: [DashboardService, DASHBOARD_REPOSITORY],
})
export class DashboardModule {}
