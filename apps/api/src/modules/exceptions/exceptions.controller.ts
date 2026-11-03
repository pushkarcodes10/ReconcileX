import {
  Body,
  Controller,
  Get,
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
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@reconcilex/db';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OrgGuard } from '../../common/guards/org.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  AssignExceptionDto,
  CreateExceptionCommentDto,
  ExceptionCommentDto,
  ExceptionDetailResponseDto,
  PaginatedExceptionsResponseDto,
  QueryExceptionsDto,
  UpdateExceptionStatusDto,
} from './dto';
import { ExceptionsService } from './exceptions.service';

@ApiTags('Exceptions')
@Controller(['orgs/:orgId/exceptions', 'organizations/:orgId/exceptions'])
@UseGuards(JwtAuthGuard, OrgGuard, RolesGuard)
@ApiCookieAuth('access_token')
@ApiBearerAuth()
export class ExceptionsController {
  constructor(private readonly exceptionsService: ExceptionsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'List reconciliation exceptions',
    description:
      'Retrieve paginated reconciliation exceptions for the organization with filters for status, assignee, run, dates, and search.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of exceptions',
    type: PaginatedExceptionsResponseDto,
  })
  async listExceptions(
    @Param('orgId') orgId: string,
    @Query() query: QueryExceptionsDto,
  ): Promise<PaginatedExceptionsResponseDto> {
    return this.exceptionsService.getExceptions(orgId, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST, Role.AUDITOR)
  @ApiOperation({
    summary: 'Get exception details',
    description:
      'Retrieve detailed information for a single exception, including run summary, transaction details, assignee, resolution metadata, and chronological comments.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Exception UUID' })
  @ApiResponse({
    status: 200,
    description: 'Detailed exception object',
    type: ExceptionDetailResponseDto,
  })
  async getException(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
  ): Promise<ExceptionDetailResponseDto> {
    return this.exceptionsService.getExceptionDetail(orgId, id);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST)
  @ApiOperation({
    summary: 'Assign or reassign an exception',
    description:
      'Assign an exception to an active organization member. Reassignments maintain current state machine positions. Assignment of resolved exceptions is forbidden.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Exception UUID' })
  @ApiResponse({
    status: 200,
    description: 'Updated exception detail',
    type: ExceptionDetailResponseDto,
  })
  async assignException(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: AssignExceptionDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ExceptionDetailResponseDto> {
    return this.exceptionsService.assignException(orgId, id, dto, user.sub);
  }

  @Post(':id/comments')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST)
  @ApiOperation({
    summary: 'Add an investigation comment',
    description:
      'Appends a note or comment to an exception investigation trail.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Exception UUID' })
  @ApiResponse({
    status: 201,
    description: 'Created exception comment',
    type: ExceptionCommentDto,
  })
  async addComment(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: CreateExceptionCommentDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ExceptionCommentDto> {
    return this.exceptionsService.addComment(orgId, id, user.sub, dto);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.FINANCE_MANAGER, Role.ANALYST)
  @ApiOperation({
    summary: 'Transition exception state',
    description:
      'Transitions an exception according to the Finite State Machine (START_REVIEW, ESCALATE, RESOLVE, REOPEN). Resolution requires reason and resolutionAction.',
  })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiParam({ name: 'id', description: 'Exception UUID' })
  @ApiResponse({
    status: 200,
    description: 'Updated exception detail',
    type: ExceptionDetailResponseDto,
  })
  async updateStatus(
    @Param('orgId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExceptionStatusDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ExceptionDetailResponseDto> {
    return this.exceptionsService.updateStatus(orgId, id, dto, user.sub);
  }
}
