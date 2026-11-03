import { Injectable } from '@nestjs/common';
import { ActorType, AuditLog, NewAuditLog } from '@reconcilex/db';
import { randomUUID } from 'crypto';
import { InMemoryAuthRepository } from '../../auth/repositories/in-memory-auth.repository';
import { QueryAuditLogsDto } from '../dto/query-audit-logs.dto';
import {
  ActorSummary,
  AuditLogWithActor,
  IAuditRepository,
} from './audit.repository.interface';

@Injectable()
export class InMemoryAuditRepository implements IAuditRepository {
  public logs: AuditLog[] = [];

  constructor(private readonly authRepo?: InMemoryAuthRepository) {}

  clear(): void {
    this.logs = [];
  }

  private getActorSummary(actorId: string | null): ActorSummary | null {
    if (!actorId) return null;
    if (this.authRepo) {
      const user = this.authRepo.users.get(actorId);
      if (user) {
        return { id: user.id, name: user.name, email: user.email };
      }
    }
    return {
      id: actorId,
      name: `User ${actorId.slice(0, 6)}`,
      email: `user-${actorId.slice(0, 6)}@example.com`,
    };
  }

  async create(newLog: NewAuditLog): Promise<AuditLog> {
    const now = new Date();
    const log: AuditLog = {
      id: newLog.id || randomUUID(),
      organizationId: newLog.organizationId,
      actorId: newLog.actorId ?? null,
      actorType: newLog.actorType || ActorType.USER,
      action: newLog.action,
      entityType: newLog.entityType,
      entityId: newLog.entityId,
      metadata: (newLog.metadata as Record<string, unknown>) || null,
      ipAddress: newLog.ipAddress ?? null,
      userAgent: newLog.userAgent ?? null,
      createdAt: newLog.createdAt instanceof Date ? newLog.createdAt : now,
    };

    this.logs.push(log);
    return { ...log };
  }

  async createMany(newLogs: NewAuditLog[]): Promise<AuditLog[]> {
    const created: AuditLog[] = [];
    for (const log of newLogs) {
      created.push(await this.create(log));
    }
    return created;
  }

  async findById(orgId: string, id: string): Promise<AuditLogWithActor | null> {
    const log = this.logs.find((l) => l.organizationId === orgId && l.id === id);
    if (!log) return null;

    return {
      ...log,
      actor: this.getActorSummary(log.actorId),
    };
  }

  async findMany(
    orgId: string,
    query: QueryAuditLogsDto,
  ): Promise<{ data: AuditLogWithActor[]; total: number }> {
    let filtered = this.logs.filter((l) => l.organizationId === orgId);

    if (query.action) {
      filtered = filtered.filter((l) => l.action === query.action);
    }
    if (query.entityType) {
      filtered = filtered.filter((l) => l.entityType === query.entityType);
    }
    if (query.entityId) {
      filtered = filtered.filter((l) => l.entityId === query.entityId);
    }
    if (query.actorId) {
      filtered = filtered.filter((l) => l.actorId === query.actorId);
    }
    if (query.startDate) {
      const fromTime = new Date(query.startDate).getTime();
      filtered = filtered.filter((l) => new Date(l.createdAt).getTime() >= fromTime);
    }
    if (query.endDate) {
      const toTime = new Date(query.endDate).getTime();
      filtered = filtered.filter((l) => new Date(l.createdAt).getTime() <= toTime);
    }

    const total = filtered.length;

    // Sorting
    const sortOrder = query.sortOrder || 'desc';
    const indexed = filtered.map((item, idx) => ({ item, idx }));
    indexed.sort((a, b) => {
      const timeA = new Date(a.item.createdAt).getTime();
      const timeB = new Date(b.item.createdAt).getTime();
      if (timeA !== timeB) {
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }
      return sortOrder === 'asc' ? a.idx - b.idx : b.idx - a.idx;
    });
    filtered = indexed.map((x) => x.item);

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const offset = (page - 1) * limit;
    const paged = filtered.slice(offset, offset + limit);

    const data: AuditLogWithActor[] = paged.map((l) => ({
      ...l,
      actor: this.getActorSummary(l.actorId),
    }));

    return { data, total };
  }
}
