import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@reconcilex/db';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgGuard } from '../../common/guards/org.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';
import {
  DashboardExceptionsResponseDto,
  DashboardReconciliationResponseDto,
  DashboardSummaryResponseDto,
  QueryDashboardActivityDto,
  QueryDashboardReconciliationDto,
} from './dto';

@ApiTags('Dashboard')
@Controller(['orgs/:orgId/dashboard', 'organizations/:orgId/dashboard'])
@UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
@ApiCookieAuth('access_token')
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'Get dashboard summary metrics',
    description:
      'Retrieve high-level aggregate metrics for the organization: transaction counts, run statuses, and exception breakdown.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiResponse({
    status: 200,
    description: 'Dashboard summary metrics',
    type: DashboardSummaryResponseDto,
  })
  async getSummary(@Param('orgId') orgId: string): Promise<DashboardSummaryResponseDto> {
    return this.dashboardService.getSummary(orgId);
  }

  @Get('reconciliation')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'Get reconciliation overview metrics',
    description:
      'Retrieve reconciliation run statistics, match classification counts, and recent run history with optional date range filters.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiResponse({
    status: 200,
    description: 'Reconciliation overview data',
    type: DashboardReconciliationResponseDto,
  })
  async getReconciliation(
    @Param('orgId') orgId: string,
    @Query() query: QueryDashboardReconciliationDto,
  ): Promise<DashboardReconciliationResponseDto> {
    return this.dashboardService.getReconciliation(orgId, query);
  }

  @Get('exceptions')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'Get exception overview metrics',
    description:
      'Retrieve exception counts grouped by status, breakdown by assignee, unassigned count, and recent created/resolved exceptions.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiResponse({
    status: 200,
    description: 'Exceptions overview data',
    type: DashboardExceptionsResponseDto,
  })
  async getExceptions(@Param('orgId') orgId: string): Promise<DashboardExceptionsResponseDto> {
    return this.dashboardService.getExceptions(orgId);
  }

  @Get('activity')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'Get organization activity feed',
    description:
      'Retrieve recent organization activity feed derived from immutable audit logs with optional action filter and pagination.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  async getActivity(
    @Param('orgId') orgId: string,
    @Query() query: QueryDashboardActivityDto,
  ) {
    return this.dashboardService.getActivity(orgId, query);
  }
}
