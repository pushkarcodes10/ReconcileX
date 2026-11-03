import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActorType,
  AuditAction,
  AuditEntityType,
  AuditLog,
} from '@reconcilex/db';
import {
  AuditLogResponseDto,
  PaginatedAuditLogsResponseDto,
  QueryAuditLogsDto,
} from './dto';
import {
  AUDIT_REPOSITORY,
  IAuditRepository,
} from './repositories/audit.repository.interface';

const SENSITIVE_KEYS = [
  'password',
  'passwordhash',
  'token',
  'tokenhash',
  'refreshtoken',
  'secret',
  'credentials',
  'authorization',
  'cookie',
  'key',
];

@Injectable()
export class AuditService {
  constructor(
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepo: IAuditRepository,
  ) {}

  private sanitizeMetadata(metadata?: Record<string, unknown>): Record<string, unknown> | null {
    if (!metadata || typeof metadata !== 'object') return null;

    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive));
      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeMetadata(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  async log(params: {
    organizationId: string;
    actorId?: string | null;
    actorType?: ActorType;
    action: AuditAction | string;
    entityType: AuditEntityType | string;
    entityId: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<AuditLog> {
    const sanitizedMetadata = this.sanitizeMetadata(params.metadata);

    return this.auditRepo.create({
      organizationId: params.organizationId,
      actorId: params.actorId ?? null,
      actorType: params.actorType || (params.actorId ? ActorType.USER : ActorType.SYSTEM),
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: sanitizedMetadata,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });
  }

  async logUserAction(
    orgId: string,
    actorId: string,
    action: AuditAction | string,
    entityType: AuditEntityType | string,
    entityId: string,
    metadata?: Record<string, unknown>,
    reqInfo?: { ipAddress?: string | null; userAgent?: string | null },
  ): Promise<AuditLog> {
    return this.log({
      organizationId: orgId,
      actorId,
      actorType: ActorType.USER,
      action,
      entityType,
      entityId,
      metadata,
      ipAddress: reqInfo?.ipAddress,
      userAgent: reqInfo?.userAgent,
    });
  }

  async logSystemAction(
    orgId: string,
    action: AuditAction | string,
    entityType: AuditEntityType | string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): Promise<AuditLog> {
    return this.log({
      organizationId: orgId,
      actorId: null,
      actorType: ActorType.SYSTEM,
      action,
      entityType,
      entityId,
      metadata,
    });
  }

  async getAuditLogs(
    orgId: string,
    query: QueryAuditLogsDto,
  ): Promise<PaginatedAuditLogsResponseDto> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const { data, total } = await this.auditRepo.findMany(orgId, query);
    const totalPages = Math.ceil(total / limit) || (total === 0 ? 0 : 1);

    const formattedData: AuditLogResponseDto[] = data.map((item) => ({
      id: item.id,
      organizationId: item.organizationId,
      actorId: item.actorId,
      actorType: item.actorType,
      actor: item.actor || null,
      action: item.action,
      entityType: item.entityType,
      entityId: item.entityId,
      metadata: (item.metadata as Record<string, unknown>) || null,
      ipAddress: item.ipAddress,
      userAgent: item.userAgent,
      createdAt: item.createdAt.toISOString(),
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

  async getAuditLogById(orgId: string, id: string): Promise<AuditLogResponseDto> {
    const record = await this.auditRepo.findById(orgId, id);
    if (!record) {
      throw new NotFoundException({
        code: 'AUDIT_LOG_NOT_FOUND',
        message: `Audit log with ID ${id} not found`,
      });
    }

    return {
      id: record.id,
      organizationId: record.organizationId,
      actorId: record.actorId,
      actorType: record.actorType,
      actor: record.actor || null,
      action: record.action,
      entityType: record.entityType,
      entityId: record.entityId,
      metadata: (record.metadata as Record<string, unknown>) || null,
      ipAddress: record.ipAddress,
      userAgent: record.userAgent,
      createdAt: record.createdAt.toISOString(),
    };
  }
}
