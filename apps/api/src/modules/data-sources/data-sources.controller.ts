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
import { DataSourcesService } from './data-sources.service';
import { CreateDataSourceDto, UpdateDataSourceDto } from './dto/data-source.dto';

@ApiTags('Data Sources')
@Controller(['organizations/:orgId/data-sources', 'orgs/:orgId/data-sources'])
@UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
@ApiCookieAuth('access_token')
@ApiBearerAuth()
export class DataSourcesController {
  constructor(private readonly dataSourcesService: DataSourcesService) {}

  @Post()
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER)
  @ApiOperation({ summary: 'Create a new data source with canonical column mappings' })
  @ApiResponse({ status: 201, description: 'Data source created' })
  @ApiResponse({ status: 400, description: 'Invalid column mapping' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'Data source name already exists in organization' })
  async create(
    @Param('orgId') orgId: string,
    @Body() dto: CreateDataSourceDto,
  ) {
    return this.dataSourcesService.create(orgId, dto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({ summary: 'List all data sources in the organization' })
  @ApiResponse({ status: 200, description: 'Data sources retrieved' })
  async findAll(@Param('orgId') orgId: string) {
    return this.dataSourcesService.findAll(orgId);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({ summary: 'Get details of a specific data source' })
  @ApiResponse({ status: 200, description: 'Data source retrieved' })
  @ApiResponse({ status: 404, description: 'Data source not found in organization' })
  async findOne(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.dataSourcesService.findOne(orgId, id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER)
  @ApiOperation({ summary: 'Update data source configuration or column mappings' })
  @ApiResponse({ status: 200, description: 'Data source updated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Data source not found' })
  @ApiResponse({ status: 409, description: 'Data source name collision' })
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
  @ApiOperation({ summary: 'Archive data source (blocked if transactions exist)' })
  @ApiResponse({ status: 200, description: 'Data source archived' })
  @ApiResponse({ status: 400, description: 'Cannot delete data source with existing transactions' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Data source not found' })
  async remove(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.dataSourcesService.remove(orgId, id);
  }
}
