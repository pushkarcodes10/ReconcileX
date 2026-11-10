import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReconciliationMatchingConfigDto {
  @ApiPropertyOptional({
    description: 'Date window tolerance in days for matching proximity',
    example: 3,
    default: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  dateWindowDays?: number;

  @ApiPropertyOptional({
    description: 'Date tolerance in days across sources (alias for dateWindowDays in three-source)',
    example: 3,
    default: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  dateToleranceDays?: number;

  @ApiPropertyOptional({
    description: 'Score threshold for potential matches (0-100)',
    example: 60,
    default: 60,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  potentialThreshold?: number;

  @ApiPropertyOptional({
    description: 'Score threshold for exact matches (0-100)',
    example: 100,
    default: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  exactThreshold?: number;
}

export class CreateReconciliationRunDto {
  @ApiPropertyOptional({
    description: 'Reconciliation run mode (TWO_SOURCE or THREE_SOURCE)',
    example: 'THREE_SOURCE',
    enum: ['TWO_SOURCE', 'THREE_SOURCE'],
    default: 'TWO_SOURCE',
  })
  @IsOptional()
  @IsString()
  reconciliationType?: 'TWO_SOURCE' | 'THREE_SOURCE';

  @ApiProperty({
    description: 'UUID of the first data source (Source A)',
    example: 'd9b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6a',
  })
  @IsUUID()
  @IsNotEmpty()
  sourceA!: string;

  @ApiProperty({
    description: 'UUID of the second data source (Source B)',
    example: 'e8c8b5a0-3e0a-3e8d-8c1b-0a1b2c3d4e5f',
  })
  @IsUUID()
  @IsNotEmpty()
  sourceB!: string;

  @ApiPropertyOptional({
    description: 'UUID of the third data source (Source C) for three-source reconciliation',
    example: 'a7b7c6d5-2e1f-4a3b-8c2d-9e8f7a6b5c4d',
  })
  @IsOptional()
  @IsUUID()
  sourceC?: string;

  @ApiProperty({
    description: 'Inclusive start date for eligible transactions (YYYY-MM-DD or ISO 8601)',
    example: '2026-10-01',
  })
  @IsString()
  @IsNotEmpty()
  dateFrom!: string;

  @ApiProperty({
    description: 'Inclusive end date for eligible transactions (YYYY-MM-DD or ISO 8601)',
    example: '2026-10-31',
  })
  @IsString()
  @IsNotEmpty()
  dateTo!: string;

  @ApiPropertyOptional({
    description: 'Custom matching configuration parameters',
    type: ReconciliationMatchingConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReconciliationMatchingConfigDto)
  config?: ReconciliationMatchingConfigDto;
}
