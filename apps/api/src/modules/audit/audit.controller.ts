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
import { AuditService } from './audit.service';
import {
  AuditLogResponseDto,
  PaginatedAuditLogsResponseDto,
  QueryAuditLogsDto,
} from './dto';

@ApiTags('Audit Logs')
@Controller(['orgs/:orgId/audit-logs', 'organizations/:orgId/audit-logs'])
@UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
@ApiCookieAuth('access_token')
@ApiBearerAuth()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'List organization audit logs',
    description:
      'Retrieve paginated, immutable audit trail records for the organization with filters for action, entityType, entityId, actorId, and date range.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiResponse({
    status: 200,
    description: 'Paginated audit logs',
    type: PaginatedAuditLogsResponseDto,
  })
  async listAuditLogs(
    @Param('orgId') orgId: string,
    @Query() query: QueryAuditLogsDto,
  ): Promise<PaginatedAuditLogsResponseDto> {
    return this.auditService.getAuditLogs(orgId, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'Get single audit log entry',
    description:
      'Retrieve a single audit log record by ID with actor details and event metadata. Rejects cross-tenant access with 404.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Audit Log UUID' })
  @ApiResponse({
    status: 200,
    description: 'Detailed audit log record',
    type: AuditLogResponseDto,
  })
  async getAuditLog(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ): Promise<AuditLogResponseDto> {
    return this.auditService.getAuditLogById(orgId, id);
  }
}
