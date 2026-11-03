import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class DashboardSummaryResponseDto {
  @ApiProperty({ example: 1250 })
  totalTransactions!: number;

  @ApiProperty({ example: 15 })
  totalReconciliationRuns!: number;

  @ApiProperty({ example: 12 })
  completedRuns!: number;

  @ApiProperty({ example: 1 })
  failedRuns!: number;

  @ApiProperty({ example: 2 })
  runningRuns!: number;

  @ApiProperty({ example: 1050 })
  totalMatchedTransactions!: number;

  @ApiProperty({ example: 150 })
  totalUnmatchedTransactions!: number;

  @ApiProperty({ example: 50 })
  totalPotentialMatches!: number;

  @ApiProperty({ example: 45 })
  totalOpenExceptions!: number;

  @ApiProperty({ example: 25 })
  totalAssignedExceptions!: number;

  @ApiProperty({ example: 15 })
  totalExceptionsUnderReview!: number;

  @ApiProperty({ example: 5 })
  totalEscalatedExceptions!: number;

  @ApiProperty({ example: 60 })
  totalResolvedExceptions!: number;
}

export class MatchCountsDto {
  @ApiProperty({ example: 120 })
  exact!: number;

  @ApiProperty({ example: 35 })
  potential!: number;

  @ApiProperty({ example: 20 })
  confirmed!: number;

  @ApiProperty({ example: 15 })
  rejected!: number;
}

export class RecentRunItemDto {
  @ApiProperty({ example: '9a181b71-ee5a-4a94-a64a-4486d4a26b65' })
  id!: string;

  @ApiProperty({ example: 'RUN-20261103-001' })
  displayId!: string;

  @ApiProperty({ example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ example: 'd9b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6a' })
  sourceAId!: string;

  @ApiProperty({ example: 'e8c8b5a0-3e0a-3e8d-8c1b-0a1b2c3d4e5f' })
  sourceBId!: string;

  @ApiProperty({ example: 100 })
  totalSourceA!: number;

  @ApiProperty({ example: 100 })
  totalSourceB!: number;

  @ApiProperty({ example: 85 })
  exactMatchCount!: number;

  @ApiProperty({ example: 10 })
  potentialMatchCount!: number;

  @ApiProperty({ example: 5 })
  unmatchedCount!: number;

  @ApiProperty({ example: '2026-11-03T10:00:00.000Z' })
  startedAt!: string;

  @ApiPropertyOptional({ example: '2026-11-03T10:05:00.000Z' })
  completedAt?: string | null;
}

export class DashboardReconciliationResponseDto {
  @ApiProperty({ example: 15 })
  totalRuns!: number;

  @ApiProperty({ example: 12 })
  completedRuns!: number;

  @ApiProperty({ example: 1 })
  failedRuns!: number;

  @ApiProperty({ example: 2 })
  runningRuns!: number;

  @ApiProperty({ type: MatchCountsDto })
  matchCounts!: MatchCountsDto;

  @ApiProperty({ type: [RecentRunItemDto] })
  recentRuns!: RecentRunItemDto[];
}

export class QueryDashboardReconciliationDto {
  @ApiPropertyOptional({
    description: 'Filter start date (inclusive, ISO 8601 or YYYY-MM-DD)',
    example: '2026-10-01',
  })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter end date (inclusive, ISO 8601 or YYYY-MM-DD)',
    example: '2026-10-31',
  })
  @IsString()
  @IsOptional()
  endDate?: string;
}

export class ExceptionStatusBreakdownDto {
  @ApiProperty({ example: 45 })
  OPEN!: number;

  @ApiProperty({ example: 25 })
  ASSIGNED!: number;

  @ApiProperty({ example: 15 })
  UNDER_REVIEW!: number;

  @ApiProperty({ example: 5 })
  ESCALATED!: number;

  @ApiProperty({ example: 60 })
  RESOLVED!: number;
}

export class AssigneeExceptionCountDto {
  @ApiPropertyOptional({ example: 'd9b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6a' })
  assigneeId?: string | null;

  @ApiProperty({ example: 'Jane Analyst' })
  assigneeName!: string;

  @ApiProperty({ example: 12 })
  count!: number;
}

export class DashboardExceptionsResponseDto {
  @ApiProperty({ type: ExceptionStatusBreakdownDto })
  byStatus!: ExceptionStatusBreakdownDto;

  @ApiProperty({ example: 30 })
  unassignedCount!: number;

  @ApiProperty({ type: [AssigneeExceptionCountDto] })
  byAssignee!: AssigneeExceptionCountDto[];

  @ApiProperty({ type: [Object] })
  recentCreated!: Record<string, unknown>[];

  @ApiProperty({ type: [Object] })
  recentResolved!: Record<string, unknown>[];
}

export class QueryDashboardActivityDto {
  @ApiPropertyOptional({
    description: 'Filter by specific audit action (e.g. EXCEPTION_RESOLVED, RECONCILIATION_RUN_COMPLETED)',
  })
  @IsString()
  @IsOptional()
  action?: string;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of records per page',
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
