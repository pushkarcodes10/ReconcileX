import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExceptionStatus, ResolutionAction } from '@reconcilex/db';

export class UserSummaryDto {
  @ApiProperty({ example: 'd9b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6a' })
  id!: string;

  @ApiProperty({ example: 'Jane Doe' })
  name!: string;

  @ApiProperty({ example: 'analyst@reconcilex.io' })
  email!: string;
}

export class TransactionSummaryDto {
  @ApiProperty({ example: '85cfb8c3-3006-4b2a-89a3-5c2f0b7ec937' })
  id!: string;

  @ApiProperty({ example: 'TXN-98432' })
  externalId!: string;

  @ApiProperty({ example: 45000 })
  amountMinor!: number;

  @ApiProperty({ example: 'USD' })
  currency!: string;

  @ApiProperty({ example: '2026-10-15T12:00:00.000Z' })
  transactionDate!: string;

  @ApiPropertyOptional({ example: 'INV-48201' })
  reference?: string | null;
}

export class RunSummaryDto {
  @ApiProperty({ example: '9a181b71-ee5a-4a94-a64a-4486d4a26b65' })
  id!: string;

  @ApiProperty({ example: 'RUN-20261103-001' })
  displayId!: string;

  @ApiProperty({ example: 'COMPLETED' })
  status!: string;
}

export class ExceptionCommentDto {
  @ApiProperty({ example: '2cb3907c-941d-4008-8bc6-df06a0cae017' })
  id!: string;

  @ApiProperty({ example: 'd9b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6a' })
  authorId!: string;

  @ApiPropertyOptional({ type: UserSummaryDto })
  author?: UserSummaryDto | null;

  @ApiProperty({ example: 'Reaching out to internal treasury team.' })
  body!: string;

  @ApiProperty({ example: '2026-11-03T12:30:00.000Z' })
  createdAt!: string;
}

export class ExceptionResponseDto {
  @ApiProperty({ example: '7d55f019-35a9-4676-afbe-285623072fbc' })
  id!: string;

  @ApiProperty({ example: 'f87a3e76-3aa6-4f40-84c1-4277b21dcbb1' })
  organizationId!: string;

  @ApiProperty({ example: '9a181b71-ee5a-4a94-a64a-4486d4a26b65' })
  runId!: string;

  @ApiPropertyOptional({ type: RunSummaryDto })
  run?: RunSummaryDto | null;

  @ApiPropertyOptional({ example: '85cfb8c3-3006-4b2a-89a3-5c2f0b7ec937' })
  transactionId?: string | null;

  @ApiPropertyOptional({ type: TransactionSummaryDto })
  transaction?: TransactionSummaryDto | null;

  @ApiProperty({ enum: ExceptionStatus, example: ExceptionStatus.OPEN })
  status!: ExceptionStatus;

  @ApiPropertyOptional({ example: 'd9b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6a' })
  assigneeId?: string | null;

  @ApiPropertyOptional({ type: UserSummaryDto })
  assignee?: UserSummaryDto | null;

  @ApiPropertyOptional({ example: 'Manually verified bank transfer.' })
  resolutionReason?: string | null;

  @ApiPropertyOptional({ enum: ResolutionAction, example: ResolutionAction.MANUALLY_RECONCILED })
  resolutionAction?: ResolutionAction | null;

  @ApiPropertyOptional({ example: 'd9b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6a' })
  resolvedBy?: string | null;

  @ApiPropertyOptional({ type: UserSummaryDto })
  resolver?: UserSummaryDto | null;

  @ApiPropertyOptional({ example: '2026-11-03T13:00:00.000Z' })
  resolvedAt?: string | null;

  @ApiPropertyOptional({ example: 2 })
  commentsCount?: number;

  @ApiProperty({ example: '2026-11-03T10:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-11-03T10:00:00.000Z' })
  updatedAt!: string;
}

export class ExceptionDetailResponseDto extends ExceptionResponseDto {
  @ApiProperty({ type: [ExceptionCommentDto] })
  comments!: ExceptionCommentDto[];
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

export class PaginatedExceptionsResponseDto {
  @ApiProperty({ type: [ExceptionResponseDto] })
  data!: ExceptionResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
