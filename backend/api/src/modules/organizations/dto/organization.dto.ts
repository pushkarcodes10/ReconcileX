import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@reconcilex/db';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateOrgDto {
  @ApiPropertyOptional({ example: 'Acme Global Operations' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  name?: string;
}

export class CreateInvitationDto {
  @ApiProperty({ example: 'analyst@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ enum: Role, example: Role.ANALYST })
  @IsEnum(Role)
  @IsNotEmpty()
  role!: Role;
}

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Invitation token received via email/link' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiPropertyOptional({
    example: 'Alice Smith',
    description: 'Required for new user registration',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    example: 'SecurePassword123',
    description: 'Required for new user registration',
  })
  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;
}

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: Role, example: Role.FINANCE_MANAGER })
  @IsEnum(Role)
  @IsNotEmpty()
  role!: Role;
}
