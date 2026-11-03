import { AuditLog, NewAuditLog } from '@reconcilex/db';
import { QueryAuditLogsDto } from '../dto/query-audit-logs.dto';

export const AUDIT_REPOSITORY = 'AUDIT_REPOSITORY';

export interface ActorSummary {
  id: string;
  name: string;
  email: string;
}

export interface AuditLogWithActor extends AuditLog {
  actor?: ActorSummary | null;
}

export interface IAuditRepository {
  create(log: NewAuditLog): Promise<AuditLog>;
  createMany(logs: NewAuditLog[]): Promise<AuditLog[]>;
  findById(orgId: string, id: string): Promise<AuditLogWithActor | null>;
  findMany(
    orgId: string,
    query: QueryAuditLogsDto,
  ): Promise<{ data: AuditLogWithActor[]; total: number }>;
}
