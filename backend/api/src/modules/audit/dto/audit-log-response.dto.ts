import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ActorSummaryDto {
  @ApiProperty({ example: 'd9b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6a' })
  id!: string;

  @ApiProperty({ example: 'Jane Analyst' })
  name!: string;

  @ApiProperty({ example: 'jane@reconcilex.io' })
  email!: string;
}

export class AuditLogResponseDto {
  @ApiProperty({ example: '85cfb8c3-3006-4b2a-89a3-5c2f0b7ec937' })
  id!: string;

  @ApiProperty({ example: 'f87a3e76-3aa6-4f40-84c1-4277b21dcbb1' })
  organizationId!: string;

  @ApiPropertyOptional({ example: 'd9b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6a' })
  actorId?: string | null;

  @ApiProperty({ example: 'USER' })
  actorType!: string;

  @ApiPropertyOptional({ type: ActorSummaryDto })
  actor?: ActorSummaryDto | null;

  @ApiProperty({ example: 'EXCEPTION_RESOLVED' })
  action!: string;

  @ApiProperty({ example: 'EXCEPTION' })
  entityType!: string;

  @ApiProperty({ example: '7d55f019-35a9-4676-afbe-285623072fbc' })
  entityId!: string;

  @ApiPropertyOptional({ example: { resolutionAction: 'MANUALLY_RECONCILED' } })
  metadata?: Record<string, unknown> | null;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  ipAddress?: string | null;

  @ApiPropertyOptional({ example: 'Mozilla/5.0...' })
  userAgent?: string | null;

  @ApiProperty({ example: '2026-11-03T14:30:00.000Z' })
  createdAt!: string;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 42 })
  total!: number;

  @ApiProperty({ example: 3 })
  totalPages!: number;
}

export class PaginatedAuditLogsResponseDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  data!: AuditLogResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
