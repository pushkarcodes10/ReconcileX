import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  count,
  DatabaseClient,
  desc,
  eq,
  Exception,
  exceptionComments,
  exceptions,
  ExceptionStatus,
  gte,
  ilike,
  inArray,
  lte,
  NewException,
  or,
  reconciliationRuns,
  ResolutionAction,
  transactions,
  users,
} from '@reconcilex/db';
import { SQL } from 'drizzle-orm';
import { DATABASE_CLIENT } from '../../../database/database.constants';
import { QueryExceptionsDto } from '../dto/query-exceptions.dto';
import {
  ExceptionCommentWithAuthor,
  ExceptionDetailWithComments,
  ExceptionWithDetails,
  IExceptionsRepository,
  TransactionSummary,
  UserSummary,
} from './exceptions.repository.interface';

@Injectable()
export class DrizzleExceptionsRepository implements IExceptionsRepository {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: DatabaseClient,
  ) {}

  async createMany(items: NewException[]): Promise<Exception[]> {
    if (items.length === 0) return [];
    return this.db
      .insert(exceptions)
      .values(items)
      .onConflictDoNothing()
      .returning();
  }

  async findById(orgId: string, id: string): Promise<Exception | null> {
    const [record] = await this.db
      .select()
      .from(exceptions)
      .where(and(eq(exceptions.organizationId, orgId), eq(exceptions.id, id)));

    return record || null;
  }

  async findDetailById(orgId: string, id: string): Promise<ExceptionDetailWithComments | null> {
    const [rec] = await this.db
      .select()
      .from(exceptions)
      .where(and(eq(exceptions.organizationId, orgId), eq(exceptions.id, id)));

    if (!rec) return null;

    const [run] = await this.db
      .select({
        id: reconciliationRuns.id,
        displayId: reconciliationRuns.displayId,
        status: reconciliationRuns.status,
      })
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.id, rec.runId));

    let txn: TransactionSummary | null = null;
    if (rec.transactionId) {
      const [t] = await this.db
        .select({
          id: transactions.id,
          externalId: transactions.externalId,
          amountMinor: transactions.amountMinor,
          currency: transactions.currency,
          transactionDate: transactions.transactionDate,
          reference: transactions.reference,
        })
        .from(transactions)
        .where(eq(transactions.id, rec.transactionId));
      if (t) txn = t;
    }

    let assignee: UserSummary | null = null;
    if (rec.assigneeId) {
      const [u] = await this.db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, rec.assigneeId));
      if (u) assignee = u;
    }

    let resolver: UserSummary | null = null;
    if (rec.resolvedBy) {
      const [u] = await this.db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(eq(users.id, rec.resolvedBy));
      if (u) resolver = u;
    }

    const commentsList = await this.findComments(orgId, id);

    return {
      ...rec,
      status: rec.status as ExceptionStatus,
      resolutionAction: rec.resolutionAction as ResolutionAction | null,
      run: run || null,
      transaction: txn,
      assignee,
      resolver,
      commentsCount: commentsList.length,
      comments: commentsList,
    };
  }

  async findMany(
    orgId: string,
    query: QueryExceptionsDto,
  ): Promise<{ data: ExceptionWithDetails[]; total: number }> {
    const conditions: SQL[] = [eq(exceptions.organizationId, orgId)];

    if (query.status) {
      conditions.push(eq(exceptions.status, query.status));
    }

    if (query.assigneeId) {
      conditions.push(eq(exceptions.assigneeId, query.assigneeId));
    }

    if (query.runId) {
      conditions.push(eq(exceptions.runId, query.runId));
    }

    if (query.createdFrom) {
      conditions.push(gte(exceptions.createdAt, new Date(query.createdFrom)));
    }

    if (query.createdTo) {
      conditions.push(lte(exceptions.createdAt, new Date(query.createdTo)));
    }

    if (query.q && query.q.trim()) {
      const searchPattern = `%${query.q.trim()}%`;
      const matchingTxns = await this.db
        .select({ id: transactions.id })
        .from(transactions)
        .where(
          and(
            eq(transactions.organizationId, orgId),
            or(
              ilike(transactions.externalId, searchPattern),
              ilike(transactions.reference, searchPattern),
            ),
          ),
        );

      const txnIds = matchingTxns.map((t) => t.id);
      if (txnIds.length === 0) {
        return { data: [], total: 0 };
      }
      conditions.push(inArray(exceptions.transactionId, txnIds));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ value: count() })
      .from(exceptions)
      .where(whereClause);

    const total = Number(countResult?.value || 0);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const orderFn = query.sortOrder === 'asc' ? asc : desc;
    let orderExpression: SQL;
    if (query.sortBy === 'updatedAt') {
      orderExpression = orderFn(exceptions.updatedAt);
    } else if (query.sortBy === 'status') {
      orderExpression = orderFn(exceptions.status);
    } else {
      orderExpression = orderFn(exceptions.createdAt);
    }

    const records = await this.db
      .select()
      .from(exceptions)
      .where(whereClause)
      .orderBy(orderExpression)
      .limit(limit)
      .offset(offset);

    const data: ExceptionWithDetails[] = [];

    for (const rec of records) {
      const [run] = await this.db
        .select({
          id: reconciliationRuns.id,
          displayId: reconciliationRuns.displayId,
          status: reconciliationRuns.status,
        })
        .from(reconciliationRuns)
        .where(eq(reconciliationRuns.id, rec.runId));

      let txn: TransactionSummary | null = null;
      if (rec.transactionId) {
        const [t] = await this.db
          .select({
            id: transactions.id,
            externalId: transactions.externalId,
            amountMinor: transactions.amountMinor,
            currency: transactions.currency,
            transactionDate: transactions.transactionDate,
            reference: transactions.reference,
          })
          .from(transactions)
          .where(eq(transactions.id, rec.transactionId));
        if (t) txn = t;
      }

      let assignee: UserSummary | null = null;
      if (rec.assigneeId) {
        const [u] = await this.db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, rec.assigneeId));
        if (u) assignee = u;
      }

      let resolver: UserSummary | null = null;
      if (rec.resolvedBy) {
        const [u] = await this.db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, rec.resolvedBy));
        if (u) resolver = u;
      }

      const [commCount] = await this.db
        .select({ value: count() })
        .from(exceptionComments)
        .where(eq(exceptionComments.exceptionId, rec.id));

      data.push({
        ...rec,
        status: rec.status as ExceptionStatus,
        resolutionAction: rec.resolutionAction as ResolutionAction | null,
        run: run || null,
        transaction: txn,
        assignee,
        resolver,
        commentsCount: Number(commCount?.value || 0),
      });
    }

    return { data, total };
  }

  async assign(
    orgId: string,
    id: string,
    assigneeId: string,
    nextStatus: ExceptionStatus,
  ): Promise<ExceptionWithDetails> {
    const [updated] = await this.db
      .update(exceptions)
      .set({
        assigneeId,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(and(eq(exceptions.organizationId, orgId), eq(exceptions.id, id)))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Exception with ID ${id} not found`);
    }

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
    const updatePayload: Record<string, unknown> = {
      status: nextStatus,
      updatedAt: new Date(),
    };

    if (nextStatus === ExceptionStatus.RESOLVED && resolution) {
      updatePayload.resolutionReason = resolution.reason ?? null;
      updatePayload.resolutionAction = resolution.action ?? null;
      updatePayload.resolvedBy = resolution.resolvedBy ?? null;
      updatePayload.resolvedAt = resolution.resolvedAt ?? new Date();
    } else if (nextStatus === ExceptionStatus.OPEN) {
      // Reopened - clear resolution metadata
      updatePayload.resolutionReason = null;
      updatePayload.resolutionAction = null;
      updatePayload.resolvedBy = null;
      updatePayload.resolvedAt = null;
    }

    const [updated] = await this.db
      .update(exceptions)
      .set(updatePayload)
      .where(and(eq(exceptions.organizationId, orgId), eq(exceptions.id, id)))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Exception with ID ${id} not found`);
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
    const [created] = await this.db
      .insert(exceptionComments)
      .values({
        organizationId: orgId,
        exceptionId,
        authorId,
        body,
      })
      .returning();

    const [author] = await this.db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, authorId));

    return {
      ...created,
      author: author || null,
    };
  }

  async findComments(orgId: string, exceptionId: string): Promise<ExceptionCommentWithAuthor[]> {
    const rows = await this.db
      .select({
        comment: exceptionComments,
        author: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(exceptionComments)
      .leftJoin(users, eq(exceptionComments.authorId, users.id))
      .where(
        and(
          eq(exceptionComments.organizationId, orgId),
          eq(exceptionComments.exceptionId, exceptionId),
        ),
      )
      .orderBy(asc(exceptionComments.createdAt));

    return rows.map((r) => ({
      ...r.comment,
      author: r.author?.id ? r.author : null,
    }));
  }
}
