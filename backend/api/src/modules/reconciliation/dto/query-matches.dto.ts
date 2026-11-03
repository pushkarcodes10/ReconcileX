import { ApiPropertyOptional } from '@nestjs/swagger';
import { MatchClassification, MatchStatus } from '@reconcilex/db';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class QueryMatchesDto {
  @ApiPropertyOptional({
    description: 'Filter by match classification tier',
    enum: MatchClassification,
  })
  @IsEnum(MatchClassification)
  @IsOptional()
  classification?: MatchClassification;

  @ApiPropertyOptional({
    description: 'Filter by match review status',
    enum: MatchStatus,
  })
  @IsEnum(MatchStatus)
  @IsOptional()
  status?: MatchStatus;

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
}
