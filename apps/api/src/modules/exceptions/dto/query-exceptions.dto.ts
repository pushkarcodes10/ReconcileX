import { ApiPropertyOptional } from '@nestjs/swagger';
import { ExceptionStatus } from '@reconcilex/db';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class QueryExceptionsDto {
  @ApiPropertyOptional({
    description: 'Filter by exception status',
    enum: ExceptionStatus,
  })
  @IsEnum(ExceptionStatus)
  @IsOptional()
  status?: ExceptionStatus;

  @ApiPropertyOptional({
    description: 'Filter by assignee UUID',
    example: 'd9b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6a',
  })
  @IsUUID()
  @IsOptional()
  assigneeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by reconciliation run UUID',
    example: 'c1b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6b',
  })
  @IsUUID()
  @IsOptional()
  runId?: string;

  @ApiPropertyOptional({
    description: 'Filter exceptions created on or after date (inclusive, ISO 8601)',
    example: '2026-10-01T00:00:00.000Z',
  })
  @IsString()
  @IsOptional()
  createdFrom?: string;

  @ApiPropertyOptional({
    description: 'Filter exceptions created on or before date (inclusive, ISO 8601)',
    example: '2026-10-31T23:59:59.999Z',
  })
  @IsString()
  @IsOptional()
  createdTo?: string;

  @ApiPropertyOptional({
    description: 'Search string matching external transaction ID or reference',
    example: 'TXN-9843',
  })
  @IsString()
  @IsOptional()
  q?: string;

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
    enum: ['createdAt', 'updatedAt', 'status'],
    default: 'createdAt',
  })
  @IsIn(['createdAt', 'updatedAt', 'status'])
  @IsOptional()
  sortBy?: 'createdAt' | 'updatedAt' | 'status' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
