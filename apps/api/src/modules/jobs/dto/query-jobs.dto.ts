import { ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus, JobType } from '@reconcilex/db';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class QueryJobsDto {
  @ApiPropertyOptional({
    description: 'Filter by job execution status',
    enum: JobStatus,
  })
  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;

  @ApiPropertyOptional({
    description: 'Filter by job type',
    enum: JobType,
    example: 'RECONCILIATION_RUN',
  })
  @IsString()
  @IsOptional()
  jobType?: string;

  @ApiPropertyOptional({
    description: 'Filter by reference entity type (e.g., RECONCILIATION_RUN, IMPORT)',
    example: 'RECONCILIATION_RUN',
  })
  @IsString()
  @IsOptional()
  referenceType?: string;

  @ApiPropertyOptional({
    description: 'Filter by reference entity ID (e.g., runId, importId)',
    example: '9a181b71-ee5a-4a94-a64a-4486d4a26b65',
  })
  @IsString()
  @IsOptional()
  referenceId?: string;

  @ApiPropertyOptional({
    description: 'Filter jobs created on or after date (inclusive, ISO 8601)',
    example: '2026-10-01T00:00:00.000Z',
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter jobs created on or before date (inclusive, ISO 8601)',
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
    enum: ['createdAt', 'updatedAt'],
    default: 'createdAt',
  })
  @IsIn(['createdAt', 'updatedAt'])
  @IsOptional()
  sortBy?: 'createdAt' | 'updatedAt' = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsIn(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
