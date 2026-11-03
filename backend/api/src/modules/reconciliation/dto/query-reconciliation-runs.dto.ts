import { ApiPropertyOptional } from '@nestjs/swagger';
import { ReconciliationRunStatus } from '@reconcilex/db';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class QueryReconciliationRunsDto {
  @ApiPropertyOptional({
    description: 'Filter by run status',
    enum: ReconciliationRunStatus,
  })
  @IsEnum(ReconciliationRunStatus)
  @IsOptional()
  status?: ReconciliationRunStatus;

  @ApiPropertyOptional({
    description: 'Filter runs involving a specific data source ID (as Source A or B)',
    example: 'd9b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6a',
  })
  @IsUUID()
  @IsOptional()
  sourceId?: string;

  @ApiPropertyOptional({
    description: 'Filter run created on or after date (inclusive, ISO 8601 or YYYY-MM-DD)',
    example: '2026-10-01',
  })
  @IsString()
  @IsOptional()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter run created on or before date (inclusive, ISO 8601 or YYYY-MM-DD)',
    example: '2026-10-31',
  })
  @IsString()
  @IsOptional()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Page number for offset pagination (starts at 1)',
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
    enum: ['createdAt', 'startedAt'],
    default: 'createdAt',
  })
  @IsIn(['createdAt', 'startedAt'])
  @IsOptional()
  sortBy?: 'createdAt' | 'startedAt' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
