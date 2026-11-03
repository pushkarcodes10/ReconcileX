import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@reconcilex/db';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgGuard } from '../../common/guards/org.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateReconciliationRunDto } from './dto/create-reconciliation-run.dto';
import { QueryMatchesDto } from './dto/query-matches.dto';
import { QueryReconciliationRunsDto } from './dto/query-reconciliation-runs.dto';
import { QueryUnmatchedDto } from './dto/query-unmatched.dto';
import {
  CreateReconciliationRunResponseDto,
  MatchDetailDto,
  PaginatedResponse,
  ReconciliationRunDetailDto,
  ReconciliationRunItemDto,
  UnmatchedTransactionItemDto,
} from './dto/reconciliation-response.dto';
import { RejectMatchDto } from './dto/reject-match.dto';
import { ReconciliationService } from './reconciliation.service';

@ApiTags('Reconciliation')
@Controller(['orgs/:orgId', 'organizations/:orgId'])
@UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
@ApiCookieAuth('access_token')
@ApiBearerAuth()
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Post('reconciliation-runs')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create and execute a pairwise reconciliation run',
    description:
      'Initiates deterministic pairwise reconciliation between two data sources within an organization. Compares transactions, evaluates exact and potential matches, updates statuses, and outputs counters.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Unique client-generated idempotency key to prevent duplicate runs',
  })
  @ApiResponse({
    status: 201,
    description: 'Reconciliation run created and processed successfully',
    type: CreateReconciliationRunResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid date range or same source selected' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (Auditors forbidden)' })
  @ApiResponse({ status: 404, description: 'Data source not found in organization' })
  @ApiResponse({ status: 409, description: 'Run already processing or idempotency conflict' })
  async createRun(
    @CurrentOrg() org: { id: string },
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReconciliationRunDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ): Promise<CreateReconciliationRunResponseDto> {
    return this.reconciliationService.createRun(org.id, user.sub, dto, idempotencyKey);
  }

  @Get('reconciliation-runs')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'List reconciliation runs',
    description:
      'Retrieves a paginated list of reconciliation runs for the authenticated organization with optional status, source, and date range filters.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiResponse({ status: 200, description: 'List of reconciliation runs' })
  async getRuns(
    @CurrentOrg() org: { id: string },
    @Query() query: QueryReconciliationRunsDto,
  ): Promise<PaginatedResponse<ReconciliationRunItemDto>> {
    return this.reconciliationService.getRuns(org.id, query);
  }

  @Get('reconciliation-runs/:id')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'Get reconciliation run details and counters',
    description:
      'Retrieves detailed information, configuration snapshot, and transaction counters for a specific reconciliation run.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Reconciliation Run UUID' })
  @ApiResponse({
    status: 200,
    description: 'Reconciliation run details',
    type: ReconciliationRunDetailDto,
  })
  @ApiResponse({ status: 404, description: 'Reconciliation run not found' })
  async getRunDetail(
    @CurrentOrg() org: { id: string },
    @Param('id') runId: string,
  ): Promise<ReconciliationRunDetailDto> {
    return this.reconciliationService.getRunDetail(org.id, runId);
  }

  @Get('reconciliation-runs/:id/matches')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'List matches for a reconciliation run',
    description:
      'Retrieves paginated matches for a reconciliation run, filterable by classification (EXACT | POTENTIAL) and status (PENDING | CONFIRMED | REJECTED). Includes full transaction details for explainability.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Reconciliation Run UUID' })
  @ApiResponse({ status: 200, description: 'List of matches with transaction details' })
  @ApiResponse({ status: 404, description: 'Reconciliation run not found' })
  async getMatches(
    @CurrentOrg() org: { id: string },
    @Param('id') runId: string,
    @Query() query: QueryMatchesDto,
  ): Promise<PaginatedResponse<MatchDetailDto>> {
    return this.reconciliationService.getMatches(org.id, runId, query);
  }

  @Get('reconciliation-runs/:id/unmatched')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'List unmatched transactions for a reconciliation run',
    description:
      'Retrieves transactions evaluated during this run that did not receive a candidate match.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Reconciliation Run UUID' })
  @ApiResponse({ status: 200, description: 'List of unmatched transactions' })
  @ApiResponse({ status: 404, description: 'Reconciliation run not found' })
  async getUnmatched(
    @CurrentOrg() org: { id: string },
    @Param('id') runId: string,
    @Query() query: QueryUnmatchedDto,
  ): Promise<PaginatedResponse<UnmatchedTransactionItemDto>> {
    return this.reconciliationService.getUnmatched(org.id, runId, query);
  }

  @Post('matches/:id/confirm')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm a potential match',
    description:
      'Promotes a POTENTIAL match to CONFIRMED and updates both associated transactions to MATCHED. Uses row locking to prevent concurrent confirmation races.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Match UUID' })
  @ApiResponse({ status: 200, description: 'Match confirmed successfully', type: MatchDetailDto })
  @ApiResponse({ status: 400, description: 'Match is not in POTENTIAL classification' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (Auditors forbidden)' })
  @ApiResponse({ status: 404, description: 'Match not found' })
  @ApiResponse({
    status: 409,
    description: 'Match already confirmed/rejected or transactions already matched',
  })
  async confirmMatch(
    @CurrentOrg() org: { id: string },
    @CurrentUser() user: JwtPayload,
    @Param('id') matchId: string,
  ): Promise<MatchDetailDto> {
    return this.reconciliationService.confirmMatch(org.id, matchId, user.sub);
  }

  @Post('matches/:id/reject')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a potential match',
    description:
      'Marks a POTENTIAL match as REJECTED with an optional explanation. Recalculates transaction statuses based on other potential or confirmed matches in the run.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Match UUID' })
  @ApiResponse({ status: 200, description: 'Match rejected successfully', type: MatchDetailDto })
  @ApiResponse({ status: 400, description: 'Match is not in POTENTIAL classification' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (Auditors forbidden)' })
  @ApiResponse({ status: 404, description: 'Match not found' })
  @ApiResponse({ status: 409, description: 'Match already confirmed or rejected' })
  async rejectMatch(
    @CurrentOrg() org: { id: string },
    @CurrentUser() user: JwtPayload,
    @Param('id') matchId: string,
    @Body() dto: RejectMatchDto,
  ): Promise<MatchDetailDto> {
    return this.reconciliationService.rejectMatch(org.id, matchId, user.sub, dto);
  }
}
