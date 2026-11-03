import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectMatchDto {
  @ApiPropertyOptional({
    description: 'Human-readable justification for rejecting the potential match',
    example: 'Transaction references do not represent the same payment.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
