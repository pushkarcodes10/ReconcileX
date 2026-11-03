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
import {
  JobResponseDto,
  PaginatedJobsResponseDto,
  QueryJobsDto,
} from './dto';
import { JobsService } from './jobs.service';

@ApiTags('Jobs')
@Controller(['orgs/:orgId/jobs', 'organizations/:orgId/jobs'])
@UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
@ApiCookieAuth('access_token')
@ApiBearerAuth()
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'List organization background jobs',
    description:
      'Retrieve paginated background jobs (reconciliation runs, CSV imports) with status, type, and date filters.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of jobs',
    type: PaginatedJobsResponseDto,
  })
  async listJobs(
    @Param('orgId') orgId: string,
    @Query() query: QueryJobsDto,
  ): Promise<PaginatedJobsResponseDto> {
    return this.jobsService.listJobs(orgId, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'Get job status and progress',
    description:
      'Retrieve detailed execution state, percentage progress, sanitized error information, and result metadata for an asynchronous job.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiResponse({
    status: 200,
    description: 'Detailed job record',
    type: JobResponseDto,
  })
  async getJob(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ): Promise<JobResponseDto> {
    return this.jobsService.getJob(orgId, id);
  }
}
