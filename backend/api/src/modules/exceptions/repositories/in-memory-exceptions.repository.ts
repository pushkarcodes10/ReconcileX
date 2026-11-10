import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Exception,
  ExceptionComment,
  ExceptionStatus,
  NewException,
  ResolutionAction,
} from '@reconcilex/db';
import { randomUUID } from 'crypto';
import { InMemoryAuthRepository } from '../../auth/repositories/in-memory-auth.repository';
import { InMemoryReconciliationRepository } from '../../reconciliation/repositories/in-memory-reconciliation.repository';
import { InMemoryTransactionsRepository } from '../../transactions/repositories/in-memory-transactions.repository';
import { QueryExceptionsDto } from '../dto/query-exceptions.dto';
import {
  ExceptionCommentWithAuthor,
  ExceptionDetailWithComments,
  ExceptionWithDetails,
  IExceptionsRepository,
  RunSummary,
  TransactionSummary,
  UserSummary,
} from './exceptions.repository.interface';

@Injectable()
export class InMemoryExceptionsRepository implements IExceptionsRepository {
  public exceptions: Exception[] = [];
  public comments: ExceptionComment[] = [];

  clear(): void {
    this.exceptions = [];
    this.comments = [];
  }

  constructor(
    private readonly authRepo?: InMemoryAuthRepository,
    private readonly reconciliationRepo?: InMemoryReconciliationRepository,
    private readonly transactionsRepo?: InMemoryTransactionsRepository,
  ) {}

  async createMany(items: NewException[]): Promise<Exception[]> {
    const created: Exception[] = [];
    const now = new Date();

    for (const item of items) {
      // Check partial unique index: runId + transactionId when txnId is not null and status != RESOLVED
      if (item.transactionId) {
        const existing = this.exceptions.find(
          (e) =>
            e.runId === item.runId &&
            e.transactionId === item.transactionId &&
            e.status !== ExceptionStatus.RESOLVED,
        );
        if (existing) {
          continue; // ON CONFLICT DO NOTHING
        }
      }

      const exception: Exception = {
        id: item.id || randomUUID(),
        organizationId: item.organizationId,
        runId: item.runId,
        matchId: item.matchId ?? null,
        transactionId: item.transactionId ?? null,
        exceptionType: item.exceptionType || 'UNMATCHED',
        discrepancyDetails: (item.discrepancyDetails as Record<string, unknown> | Array<unknown>) ?? null,
        status: (item.status as ExceptionStatus) || ExceptionStatus.OPEN,
        assigneeId: item.assigneeId ?? null,
        resolutionReason: item.resolutionReason ?? null,
        resolutionAction: (item.resolutionAction as ResolutionAction) ?? null,
        resolvedBy: item.resolvedBy ?? null,
        resolvedAt: item.resolvedAt instanceof Date ? item.resolvedAt : null,
        createdAt: item.createdAt instanceof Date ? item.createdAt : now,
        updatedAt: item.updatedAt instanceof Date ? item.updatedAt : now,
      };

      this.exceptions.push(exception);
      created.push({ ...exception });
    }

    return created;
  }

  async findById(orgId: string, id: string): Promise<Exception | null> {
    const found = this.exceptions.find((e) => e.organizationId === orgId && e.id === id);
    return found ? { ...found } : null;
  }

  private getUserSummary(userId: string | null): UserSummary | null {
    if (!userId) return null;
    if (this.authRepo) {
      const user = this.authRepo.users.get(userId);
      if (user) {
        return { id: user.id, name: user.name, email: user.email };
      }
    }
    return {
      id: userId,
      name: `User ${userId.slice(0, 6)}`,
      email: `user-${userId.slice(0, 6)}@example.com`,
    };
  }

  private getRunSummary(runId: string): RunSummary | null {
    if (this.reconciliationRepo) {
      const run = this.reconciliationRepo.runs.find((r) => r.id === runId);
      if (run) {
        return { id: run.id, displayId: run.displayId, status: run.status };
      }
    }
    return { id: runId, displayId: `RUN-${runId.slice(0, 8)}`, status: 'COMPLETED' };
  }

  private getTransactionSummary(txnId: string | null): TransactionSummary | null {
    if (!txnId) return null;
    if (this.transactionsRepo) {
      const txn = this.transactionsRepo.transactions.find((t) => t.id === txnId);
      if (txn) {
        return {
          id: txn.id,
          externalId: txn.externalId,
          amountMinor: txn.amountMinor,
          currency: txn.currency,
          transactionDate: txn.transactionDate,
          reference: txn.reference,
        };
      }
    }
    return {
      id: txnId,
      externalId: `TXN-${txnId.slice(0, 6)}`,
      amountMinor: 10000,
      currency: 'USD',
      transactionDate: new Date(),
      reference: null,
    };
  }

  async findDetailById(orgId: string, id: string): Promise<ExceptionDetailWithComments | null> {
    const exc = this.exceptions.find((e) => e.organizationId === orgId && e.id === id);
    if (!exc) return null;

    const comments = await this.findComments(orgId, id);

    return {
      ...exc,
      run: this.getRunSummary(exc.runId),
      transaction: this.getTransactionSummary(exc.transactionId),
      assignee: this.getUserSummary(exc.assigneeId),
      resolver: this.getUserSummary(exc.resolvedBy),
      commentsCount: comments.length,
      comments,
    };
  }

  async findMany(
    orgId: string,
    query: QueryExceptionsDto,
  ): Promise<{ data: ExceptionWithDetails[]; total: number }> {
    let filtered = this.exceptions.filter((e) => e.organizationId === orgId);

    if (query.status) {
      filtered = filtered.filter((e) => e.status === query.status);
    }

    if (query.assigneeId) {
      filtered = filtered.filter((e) => e.assigneeId === query.assigneeId);
    }

    if (query.runId) {
      filtered = filtered.filter((e) => e.runId === query.runId);
    }

    if (query.createdFrom) {
      const fromDate = new Date(query.createdFrom).getTime();
      filtered = filtered.filter((e) => new Date(e.createdAt).getTime() >= fromDate);
    }

    if (query.createdTo) {
      const toDate = new Date(query.createdTo).getTime();
      filtered = filtered.filter((e) => new Date(e.createdAt).getTime() <= toDate);
    }

    if (query.q && query.q.trim()) {
      const term = query.q.trim().toLowerCase();
      filtered = filtered.filter((e) => {
        const txn = this.getTransactionSummary(e.transactionId);
        if (!txn) return false;
        return (
          txn.externalId.toLowerCase().includes(term) ||
          (txn.reference && txn.reference.toLowerCase().includes(term))
        );
      });
    }

    const total = filtered.length;

    // Sorting
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';

    filtered.sort((a, b) => {
      let valA: unknown = a[sortBy as keyof Exception];
      let valB: unknown = b[sortBy as keyof Exception];

      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();

      const numOrStrA = valA as number | string;
      const numOrStrB = valB as number | string;

      if (numOrStrA < numOrStrB) return sortOrder === 'asc' ? -1 : 1;
      if (numOrStrA > numOrStrB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;
    const paged = filtered.slice(offset, offset + limit);

    const data: ExceptionWithDetails[] = paged.map((e) => {
      const commentCount = this.comments.filter((c) => c.exceptionId === e.id).length;
      return {
        ...e,
        run: this.getRunSummary(e.runId),
        transaction: this.getTransactionSummary(e.transactionId),
        assignee: this.getUserSummary(e.assigneeId),
        resolver: this.getUserSummary(e.resolvedBy),
        commentsCount: commentCount,
      };
    });

    return { data, total };
  }

  async assign(
    orgId: string,
    id: string,
    assigneeId: string,
    nextStatus: ExceptionStatus,
  ): Promise<ExceptionWithDetails> {
    const exc = this.exceptions.find((e) => e.organizationId === orgId && e.id === id);
    if (!exc) {
      throw new NotFoundException(`Exception with ID ${id} not found`);
    }

    exc.assigneeId = assigneeId;
    exc.status = nextStatus;
    exc.updatedAt = new Date();

    const detail = await this.findDetailById(orgId, id);
    if (!detail) {
      throw new NotFoundException(`Exception with ID ${id} not found`);
    }
    return detail;
  }

  async updateStatus(
    orgId: string,
    id: string,
    nextStatus: ExceptionStatus,
    resolution?: {
      reason?: string | null;
      action?: ResolutionAction | null;
      resolvedBy?: string | null;
      resolvedAt?: Date | null;
    },
  ): Promise<ExceptionWithDetails> {
    const exc = this.exceptions.find((e) => e.organizationId === orgId && e.id === id);
    if (!exc) {
      throw new NotFoundException(`Exception with ID ${id} not found`);
    }

    exc.status = nextStatus;
    exc.updatedAt = new Date();

    if (nextStatus === ExceptionStatus.RESOLVED && resolution) {
      exc.resolutionReason = resolution.reason ?? null;
      exc.resolutionAction = resolution.action ?? null;
      exc.resolvedBy = resolution.resolvedBy ?? null;
      exc.resolvedAt = resolution.resolvedAt ?? new Date();
    } else if (nextStatus === ExceptionStatus.OPEN) {
      exc.resolutionReason = null;
      exc.resolutionAction = null;
      exc.resolvedBy = null;
      exc.resolvedAt = null;
    }

    const detail = await this.findDetailById(orgId, id);
    if (!detail) {
      throw new NotFoundException(`Exception with ID ${id} not found`);
    }
    return detail;
  }

  async addComment(
    orgId: string,
    exceptionId: string,
    authorId: string,
    body: string,
  ): Promise<ExceptionCommentWithAuthor> {
    const exc = this.exceptions.find((e) => e.organizationId === orgId && e.id === exceptionId);
    if (!exc) {
      throw new NotFoundException(`Exception with ID ${exceptionId} not found`);
    }

    const comment: ExceptionComment = {
      id: randomUUID(),
      organizationId: orgId,
      exceptionId,
      authorId,
      body,
      createdAt: new Date(),
    };

    this.comments.push(comment);

    return {
      ...comment,
      author: this.getUserSummary(authorId),
    };
  }

  async findComments(orgId: string, exceptionId: string): Promise<ExceptionCommentWithAuthor[]> {
    const excComments = this.comments
      .filter((c) => c.organizationId === orgId && c.exceptionId === exceptionId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return excComments.map((c) => ({
      ...c,
      author: this.getUserSummary(c.authorId),
    }));
  }
}
