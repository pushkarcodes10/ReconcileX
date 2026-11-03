import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DataSourceStatus, DataSourceType, Role } from '@reconcilex/db';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgGuard } from '../../common/guards/org.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DataSourcesService } from './data-sources.service';
import {
  CreateDataSourceDto,
  QueryDataSourcesDto,
  UpdateDataSourceDto,
} from './dto/data-source.dto';

@ApiTags('Data Sources')
@Controller(['orgs/:orgId/data-sources', 'organizations/:orgId/data-sources'])
@UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
@ApiCookieAuth('access_token')
@ApiBearerAuth()
export class DataSourcesController {
  constructor(private readonly dataSourcesService: DataSourcesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER)
  @ApiOperation({
    summary: 'Create a new data source with canonical column mappings',
    description:
      'Creates a new data source within an organization with canonical CSV column mappings. Enforces unique name per org.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiResponse({ status: 201, description: 'Data source created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or missing required mapping fields',
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({
    status: 409,
    description: 'Data source name already exists in this organization',
  })
  async create(@Param('orgId') orgId: string, @Body() dto: CreateDataSourceDto) {
    return this.dataSourcesService.create(orgId, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'List data sources in the organization',
    description:
      'Lists active data sources for the organization with optional filtering by type/status and pagination.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: DataSourceType,
    description: 'Filter by source type',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: DataSourceStatus,
    description: 'Filter by status',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiResponse({
    status: 200,
    description: 'List of data sources or paginated response',
  })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  async findAll(@Param('orgId') orgId: string, @Query() query: QueryDataSourcesDto) {
    return this.dataSourcesService.findAll(orgId, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'Get details of a specific data source',
    description: 'Retrieves configuration and column mapping of a specific active data source.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Data Source UUID' })
  @ApiResponse({ status: 200, description: 'Data source details retrieved' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({
    status: 404,
    description: 'Data source not found in organization',
  })
  async findOne(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.dataSourcesService.findOne(orgId, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER)
  @ApiOperation({
    summary: 'Update data source configuration or column mappings',
    description: 'Updates mutable fields (name, type, columnMapping, status) of a data source.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Data Source UUID' })
  @ApiResponse({ status: 200, description: 'Data source updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Data source not found' })
  @ApiResponse({
    status: 409,
    description: 'Data source name already in use by another source in org',
  })
  async update(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDataSourceDto,
  ) {
    return this.dataSourcesService.update(orgId, id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Safe deletion of a data source',
    description:
      'Soft-deletes a data source if no transactions exist. Blocks deletion with 409 Conflict if transactions exist.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Data Source UUID' })
  @ApiResponse({ status: 200, description: 'Data source safely deleted' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete data source with existing transactions (conflict)',
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Data source not found' })
  async remove(@Param('orgId') orgId: string, @Param('id') id: string) {
    return this.dataSourcesService.remove(orgId, id);
  }
}
