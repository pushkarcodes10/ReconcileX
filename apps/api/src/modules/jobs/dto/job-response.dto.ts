import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { JobStatus } from '@reconcilex/db';

export class JobResponseDto {
  @ApiProperty({ example: '85cfb8c3-3006-4b2a-89a3-5c2f0b7ec937' })
  id!: string;

  @ApiProperty({ example: 'f87a3e76-3aa6-4f40-84c1-4277b21dcbb1' })
  organizationId!: string;

  @ApiProperty({ example: 'RECONCILIATION_RUN' })
  jobType!: string;

  @ApiProperty({ enum: JobStatus, example: JobStatus.COMPLETED })
  status!: JobStatus;

  @ApiProperty({ example: 100 })
  progress!: number;

  @ApiPropertyOptional({ example: 'Reconciliation run completed successfully' })
  message?: string | null;

  @ApiPropertyOptional({ example: 'RECONCILIATION_RUN' })
  referenceType?: string | null;

  @ApiPropertyOptional({ example: '9a181b71-ee5a-4a94-a64a-4486d4a26b65' })
  referenceId?: string | null;

  @ApiPropertyOptional({ example: { exactMatchCount: 5, potentialMatchCount: 2 } })
  result?: Record<string, unknown> | null;

  @ApiPropertyOptional({ example: { code: 'SOURCE_NOT_FOUND', message: 'Data source missing' } })
  error?: Record<string, unknown> | null;

  @ApiProperty({ example: '2026-11-03T14:00:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({ example: '2026-11-03T14:00:01.000Z' })
  startedAt?: string | null;

  @ApiPropertyOptional({ example: '2026-11-03T14:00:05.000Z' })
  completedAt?: string | null;

  @ApiProperty({ example: '2026-11-03T14:00:05.000Z' })
  updatedAt!: string;
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

export class PaginatedJobsResponseDto {
  @ApiProperty({ type: [JobResponseDto] })
  data!: JobResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
