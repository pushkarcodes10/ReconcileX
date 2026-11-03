import {
  DashboardExceptionsResponseDto,
  DashboardReconciliationResponseDto,
  DashboardSummaryResponseDto,
  QueryDashboardReconciliationDto,
} from '../dto';

export const DASHBOARD_REPOSITORY = 'DASHBOARD_REPOSITORY';

export interface IDashboardRepository {
  getSummary(orgId: string): Promise<DashboardSummaryResponseDto>;
  getReconciliationOverview(
    orgId: string,
    query?: QueryDashboardReconciliationDto,
  ): Promise<DashboardReconciliationResponseDto>;
  getExceptionsOverview(orgId: string): Promise<DashboardExceptionsResponseDto>;
}
