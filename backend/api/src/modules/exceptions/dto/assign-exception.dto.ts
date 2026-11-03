import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignExceptionDto {
  @ApiProperty({
    description: 'UUID of the user (who must belong to the organization) to assign this exception to',
    example: 'd9b9a6b1-4f1b-4f9e-9d2a-1b2c3d4e5f6a',
  })
  @IsUUID()
  @IsNotEmpty()
  assigneeId!: string;
}
