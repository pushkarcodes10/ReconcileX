import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResolutionAction } from '@reconcilex/db';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export const StatusUpdateAction = {
  START_REVIEW: 'START_REVIEW',
  ESCALATE: 'ESCALATE',
  RESOLVE: 'RESOLVE',
  REOPEN: 'REOPEN',
} as const;

export type StatusUpdateAction = (typeof StatusUpdateAction)[keyof typeof StatusUpdateAction];

export class UpdateExceptionStatusDto {
  @ApiProperty({
    description: 'Transition action to apply to the exception',
    enum: StatusUpdateAction,
    example: 'START_REVIEW',
  })
  @IsEnum(StatusUpdateAction)
  @IsNotEmpty()
  action!: StatusUpdateAction;

  @ApiPropertyOptional({
    description: 'Detailed explanation for resolving the exception (required when action is RESOLVE)',
    example: 'Transaction was settled offline via bank wire reference BW-9921.',
  })
  @ValidateIf((o) => o.action === StatusUpdateAction.RESOLVE)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'resolutionReason is required when resolving an exception' })
  @MinLength(5, { message: 'resolutionReason must be at least 5 characters long' })
  @MaxLength(2000, { message: 'resolutionReason cannot exceed 2000 characters' })
  @IsOptional()
  resolutionReason?: string;

  @ApiPropertyOptional({
    description: 'Categorized resolution action (required when action is RESOLVE)',
    enum: ResolutionAction,
    example: ResolutionAction.MANUALLY_RECONCILED,
  })
  @ValidateIf((o) => o.action === StatusUpdateAction.RESOLVE)
  @IsEnum(ResolutionAction, { message: 'Invalid resolutionAction enum value' })
  @IsNotEmpty({ message: 'resolutionAction is required when resolving an exception' })
  @IsOptional()
  resolutionAction?: ResolutionAction;
}
