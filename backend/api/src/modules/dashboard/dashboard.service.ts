import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import {
  DashboardExceptionsResponseDto,
  DashboardReconciliationResponseDto,
  DashboardSummaryResponseDto,
  QueryDashboardActivityDto,
  QueryDashboardReconciliationDto,
} from './dto';
import {
  DASHBOARD_REPOSITORY,
  IDashboardRepository,
} from './repositories/dashboard.repository.interface';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DASHBOARD_REPOSITORY)
    private readonly dashboardRepo: IDashboardRepository,
    private readonly auditService: AuditService,
  ) {}

  async getSummary(orgId: string): Promise<DashboardSummaryResponseDto> {
    return this.dashboardRepo.getSummary(orgId);
  }

  async getReconciliation(
    orgId: string,
    query?: QueryDashboardReconciliationDto,
  ): Promise<DashboardReconciliationResponseDto> {
    return this.dashboardRepo.getReconciliationOverview(orgId, query);
  }

  async getExceptions(orgId: string): Promise<DashboardExceptionsResponseDto> {
    return this.dashboardRepo.getExceptionsOverview(orgId);
  }

  async getActivity(orgId: string, query: QueryDashboardActivityDto) {
    return this.auditService.getAuditLogs(orgId, {
      action: query.action,
      page: query.page,
      limit: query.limit,
    });
  }
}
