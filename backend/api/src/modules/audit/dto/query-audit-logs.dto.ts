import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class QueryAuditLogsDto {
  @ApiPropertyOptional({
    description: 'Filter by specific audit action (e.g. RECONCILIATION_RUN_CREATED, EXCEPTION_RESOLVED)',
    example: 'EXCEPTION_RESOLVED',
  })
  @IsString()
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({
    description: 'Filter by entity type (e.g. TRANSACTION, RECONCILIATION_RUN, EXCEPTION)',
    example: 'EXCEPTION',
  })
  @IsString()
  @IsOptional()
  entityType?: string;

  @ApiPropertyOptional({
    description: 'Filter by specific entity ID (UUID or external string)',
    example: 'd9b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6a',
  })
  @IsString()
  @IsOptional()
  entityId?: string;

  @ApiPropertyOptional({
    description: 'Filter by actor user UUID',
    example: 'c1b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6b',
  })
  @IsUUID()
  @IsOptional()
  actorId?: string;

  @ApiPropertyOptional({
    description: 'Filter logs created on or after date (inclusive, ISO 8601)',
    example: '2026-10-01T00:00:00.000Z',
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter logs created on or before date (inclusive, ISO 8601)',
    example: '2026-10-31T23:59:59.999Z',
  })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination (starts at 1)',
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of records per page (max 100)',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    enum: ['createdAt'],
    default: 'createdAt',
  })
  @IsIn(['createdAt'])
  @IsOptional()
  sortBy?: 'createdAt' = 'createdAt' as const;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
