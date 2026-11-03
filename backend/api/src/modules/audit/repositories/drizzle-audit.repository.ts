import { Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  auditLogs,
  count,
  DatabaseClient,
  desc,
  eq,
  gte,
  lte,
  NewAuditLog,
  users,
} from '@reconcilex/db';
import { SQL } from 'drizzle-orm';
import { DATABASE_CLIENT } from '../../../database/database.constants';
import { QueryAuditLogsDto } from '../dto/query-audit-logs.dto';
import {
  AuditLogWithActor,
  IAuditRepository,
} from './audit.repository.interface';

@Injectable()
export class DrizzleAuditRepository implements IAuditRepository {
  constructor(
    @Inject(DATABASE_CLIENT)
    private readonly db: DatabaseClient,
  ) {}

  async create(log: NewAuditLog) {
    const [created] = await this.db.insert(auditLogs).values(log).returning();
    return created;
  }

  async createMany(logs: NewAuditLog[]) {
    if (logs.length === 0) return [];
    return this.db.insert(auditLogs).values(logs).returning();
  }

  async findById(orgId: string, id: string): Promise<AuditLogWithActor | null> {
    const [row] = await this.db
      .select({
        log: auditLogs,
        actor: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(and(eq(auditLogs.organizationId, orgId), eq(auditLogs.id, id)));

    if (!row) return null;

    return {
      ...row.log,
      actor: row.actor?.id ? row.actor : null,
    };
  }

  async findMany(
    orgId: string,
    query: QueryAuditLogsDto,
  ): Promise<{ data: AuditLogWithActor[]; total: number }> {
    const conditions: SQL[] = [eq(auditLogs.organizationId, orgId)];

    if (query.action) {
      conditions.push(eq(auditLogs.action, query.action));
    }
    if (query.entityType) {
      conditions.push(eq(auditLogs.entityType, query.entityType));
    }
    if (query.entityId) {
      conditions.push(eq(auditLogs.entityId, query.entityId));
    }
    if (query.actorId) {
      conditions.push(eq(auditLogs.actorId, query.actorId));
    }
    if (query.startDate) {
      conditions.push(gte(auditLogs.createdAt, new Date(query.startDate)));
    }
    if (query.endDate) {
      conditions.push(lte(auditLogs.createdAt, new Date(query.endDate)));
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ value: count() })
      .from(auditLogs)
      .where(whereClause);

    const total = Number(countResult?.value || 0);

    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;

    const orderFn = query.sortOrder === 'asc' ? asc : desc;

    const rows = await this.db
      .select({
        log: auditLogs,
        actor: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(whereClause)
      .orderBy(orderFn(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const data: AuditLogWithActor[] = rows.map((r) => ({
      ...r.log,
      actor: r.actor?.id ? r.actor : null,
    }));

    return { data, total };
  }
}
