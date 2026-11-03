import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Exception, ExceptionStatus, NewException, ResolutionAction } from '@reconcilex/db';
import {
  IOrganizationsRepository,
  ORGANIZATIONS_REPOSITORY,
} from '../organizations/repositories/organizations.repository.interface';
import {
  AssignExceptionDto,
  CreateExceptionCommentDto,
  ExceptionCommentDto,
  ExceptionDetailResponseDto,
  ExceptionResponseDto,
  PaginatedExceptionsResponseDto,
  QueryExceptionsDto,
  StatusUpdateAction,
  UpdateExceptionStatusDto,
} from './dto';
import {
  canTransition,
  ExceptionAction,
  getNextStatus,
  InvalidExceptionTransitionError,
} from './exception-state-machine';
import {
  EXCEPTIONS_REPOSITORY,
  IExceptionsRepository,
} from './repositories/exceptions.repository.interface';

@Injectable()
export class ExceptionsService {
  constructor(
    @Inject(EXCEPTIONS_REPOSITORY)
    private readonly exceptionsRepo: IExceptionsRepository,
    @Inject(ORGANIZATIONS_REPOSITORY)
    private readonly orgRepo: IOrganizationsRepository,
  ) {}

  async createExceptionsForUnmatched(
    orgId: string,
    runId: string,
    transactionIds: string[],
  ): Promise<Exception[]> {
    if (!transactionIds || transactionIds.length === 0) {
      return [];
    }

    const items: NewException[] = transactionIds.map((txnId) => ({
      organizationId: orgId,
      runId,
      transactionId: txnId,
      status: ExceptionStatus.OPEN,
    }));

    return this.exceptionsRepo.createMany(items);
  }

  async getExceptions(
    orgId: string,
    query: QueryExceptionsDto,
  ): Promise<PaginatedExceptionsResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const { data, total } = await this.exceptionsRepo.findMany(orgId, query);
    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    const formattedData: ExceptionResponseDto[] = data.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      runId: item.runId,
      run: item.run || null,
      transactionId: item.transactionId,
      transaction: item.transaction
        ? {
            ...item.transaction,
            transactionDate: item.transaction.transactionDate.toISOString(),
          }
        : null,
      status: item.status as ExceptionStatus,
      assigneeId: item.assigneeId,
      assignee: item.assignee || null,
      resolutionReason: item.resolutionReason,
      resolutionAction: (item.resolutionAction as ResolutionAction) || null,
      resolvedBy: item.resolvedBy,
      resolver: item.resolver || null,
      resolvedAt: item.resolvedAt ? item.resolvedAt.toISOString() : null,
      commentsCount: item.commentsCount ?? 0,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    return {
      data: formattedData,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getExceptionDetail(orgId: string, exceptionId: string): Promise<ExceptionDetailResponseDto> {
    const detail = await this.exceptionsRepo.findDetailById(orgId, exceptionId);
    if (!detail) {
      throw new NotFoundException({
        code: 'EXCEPTION_NOT_FOUND',
        message: `Exception with ID ${exceptionId} not found`,
      });
    }

    return {
      id: detail.id,
      organizationId: detail.organizationId,
      runId: detail.runId,
      run: detail.run || null,
      transactionId: detail.transactionId,
      transaction: detail.transaction
        ? {
            ...detail.transaction,
            transactionDate: detail.transaction.transactionDate.toISOString(),
          }
        : null,
      status: detail.status as ExceptionStatus,
      assigneeId: detail.assigneeId,
      assignee: detail.assignee || null,
      resolutionReason: detail.resolutionReason,
      resolutionAction: (detail.resolutionAction as ResolutionAction) || null,
      resolvedBy: detail.resolvedBy,
      resolver: detail.resolver || null,
      resolvedAt: detail.resolvedAt ? detail.resolvedAt.toISOString() : null,
      commentsCount: detail.commentsCount ?? detail.comments.length,
      createdAt: detail.createdAt.toISOString(),
      updatedAt: detail.updatedAt.toISOString(),
      comments: detail.comments.map((c) => ({
        id: c.id,
        authorId: c.authorId,
        author: c.author || null,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }

  async assignException(
    orgId: string,
    exceptionId: string,
    dto: AssignExceptionDto,
    _currentUserId: string,
  ): Promise<ExceptionDetailResponseDto> {
    const exc = await this.exceptionsRepo.findById(orgId, exceptionId);
    if (!exc) {
      throw new NotFoundException({
        code: 'EXCEPTION_NOT_FOUND',
        message: `Exception with ID ${exceptionId} not found`,
      });
    }

    if (!canTransition(exc.status as ExceptionStatus, ExceptionAction.ASSIGN)) {
      throw new InvalidExceptionTransitionError(exc.status, ExceptionAction.ASSIGN);
    }

    // Validate that assignee is an active member of this organization
    const membership = await this.orgRepo.findMembership(orgId, dto.assigneeId);
    if (!membership) {
      throw new BadRequestException({
        code: 'INVALID_ASSIGNEE',
        message: 'Assignee must be an active member of the organization',
      });
    }

    const nextStatus = getNextStatus(exc.status as ExceptionStatus, ExceptionAction.ASSIGN);
    await this.exceptionsRepo.assign(orgId, exceptionId, dto.assigneeId, nextStatus);

    return this.getExceptionDetail(orgId, exceptionId);
  }

  async addComment(
    orgId: string,
    exceptionId: string,
    authorId: string,
    dto: CreateExceptionCommentDto,
  ): Promise<ExceptionCommentDto> {
    const exc = await this.exceptionsRepo.findById(orgId, exceptionId);
    if (!exc) {
      throw new NotFoundException({
        code: 'EXCEPTION_NOT_FOUND',
        message: `Exception with ID ${exceptionId} not found`,
      });
    }

    const trimmedBody = dto.body ? dto.body.trim() : '';
    if (!trimmedBody) {
      throw new BadRequestException({
        code: 'INVALID_COMMENT',
        message: 'Comment body cannot be empty',
      });
    }

    const created = await this.exceptionsRepo.addComment(orgId, exceptionId, authorId, trimmedBody);

    return {
      id: created.id,
      authorId: created.authorId,
      author: created.author || null,
      body: created.body,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async updateStatus(
    orgId: string,
    exceptionId: string,
    dto: UpdateExceptionStatusDto,
    userId: string,
  ): Promise<ExceptionDetailResponseDto> {
    const exc = await this.exceptionsRepo.findById(orgId, exceptionId);
    if (!exc) {
      throw new NotFoundException({
        code: 'EXCEPTION_NOT_FOUND',
        message: `Exception with ID ${exceptionId} not found`,
      });
    }

    const action = dto.action as unknown as ExceptionAction;
    if (!canTransition(exc.status as ExceptionStatus, action)) {
      throw new InvalidExceptionTransitionError(exc.status, action);
    }

    const nextStatus = getNextStatus(exc.status as ExceptionStatus, action);

    let resolution: {
      reason?: string | null;
      action?: ResolutionAction | null;
      resolvedBy?: string | null;
      resolvedAt?: Date | null;
    } | undefined = undefined;

    if (dto.action === StatusUpdateAction.RESOLVE) {
      if (!dto.resolutionReason || dto.resolutionReason.trim().length < 5 || !dto.resolutionAction) {
        throw new BadRequestException({
          code: 'RESOLUTION_REQUIRED',
          message:
            'resolutionReason (minimum 5 characters) and resolutionAction are required when resolving an exception',
        });
      }

      resolution = {
        reason: dto.resolutionReason.trim(),
        action: dto.resolutionAction,
        resolvedBy: userId,
        resolvedAt: new Date(),
      };
    } else if (dto.action === StatusUpdateAction.REOPEN) {
      resolution = {
        reason: null,
        action: null,
        resolvedBy: null,
        resolvedAt: null,
      };
    }

    await this.exceptionsRepo.updateStatus(orgId, exceptionId, nextStatus, resolution);

    return this.getExceptionDetail(orgId, exceptionId);
  }
}
