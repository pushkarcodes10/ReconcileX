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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@reconcilex/db';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgGuard } from '../../common/guards/org.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QueryTransactionsDto } from './dto/transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@Controller([
  'organizations/:orgId/transactions',
  'orgs/:orgId/transactions',
])
@UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
@ApiCookieAuth('access_token')
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({ summary: 'Query and filter organization transactions with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated transactions list' })
  async findMany(
    @Param('orgId') orgId: string,
    @Query() query: QueryTransactionsDto,
  ) {
    return this.transactionsService.findMany(orgId, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({ summary: 'Get details of a specific transaction' })
  @ApiResponse({ status: 200, description: 'Transaction details retrieved' })
  @ApiResponse({ status: 404, description: 'Transaction not found in organization' })
  async findById(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.transactionsService.findById(orgId, id);
  }
}

@ApiTags('Duplicate Candidates')
@Controller([
  'organizations/:orgId/duplicate-candidates',
  'orgs/:orgId/duplicate-candidates',
])
@UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
@ApiCookieAuth('access_token')
@ApiBearerAuth()
export class DuplicateCandidatesController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({ summary: 'List flagged duplicate transaction candidates for quarantine inspection' })
  @ApiResponse({ status: 200, description: 'Duplicate candidates retrieved' })
  async findDuplicateCandidates(@Param('orgId') orgId: string) {
    return this.transactionsService.findDuplicateCandidates(orgId);
  }
}
