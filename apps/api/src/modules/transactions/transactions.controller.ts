import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role, TransactionStatus } from '@reconcilex/db';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgGuard } from '../../common/guards/org.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  QueryTransactionsDto,
  TransactionDetailDto,
  TransactionListItemDto,
} from './dto/transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@Controller(['orgs/:orgId/transactions', 'organizations/:orgId/transactions'])
@UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
@ApiCookieAuth('access_token')
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'Query and filter organization transactions with pagination',
    description:
      'Returns a paginated list of financial transactions scoped to the organization. Supports filtering by sourceId, date range, amount, status, and search query (q). Supports both offset and cursor pagination.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiQuery({
    name: 'sourceId',
    required: false,
    description: 'Filter by data source UUID',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Start date filter (inclusive, ISO 8601)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'End date filter (inclusive, ISO 8601)',
  })
  @ApiQuery({
    name: 'amount',
    required: false,
    type: Number,
    description: 'Filter exact amount in minor integer units',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: TransactionStatus,
    description: 'Filter by transaction status',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search external_id or reference by prefix/substring',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'Opaque pagination cursor',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (starts at 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (max 100)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['transactionDate', 'createdAt', 'amountMinor'],
    description: 'Sort field',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort direction',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated transactions list',
    type: [TransactionListItemDto],
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async findMany(@Param('orgId') orgId: string, @Query() query: QueryTransactionsDto) {
    return this.transactionsService.findMany(orgId, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'Get details of a specific transaction',
    description:
      'Retrieves complete transaction details including normalized payload and fingerprint for a specific transaction in the organization.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Transaction UUID' })
  @ApiResponse({
    status: 200,
    description: 'Transaction details retrieved',
    type: TransactionDetailDto,
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({
    status: 404,
    description: 'Transaction not found in organization',
  })
  async findById(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.transactionsService.findById(orgId, id);
  }
}
