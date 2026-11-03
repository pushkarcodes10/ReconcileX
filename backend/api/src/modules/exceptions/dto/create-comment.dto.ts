import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateExceptionCommentDto {
  @ApiProperty({
    description: 'Investigation note or comment body (non-empty, up to 5000 chars)',
    example: 'Contacted vendor regarding missing reference. Awaiting statement update.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty({ message: 'Comment body must not be empty' })
  @MaxLength(5000, { message: 'Comment body cannot exceed 5000 characters' })
  body!: string;
}
