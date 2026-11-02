import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum LogLevel {
  Fatal = 'fatal',
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Trace = 'trace',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  API_PREFIX: string = 'api/v1';

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  CORS_ORIGIN: string = '*';

  @IsBoolean()
  @IsOptional()
  CORS_CREDENTIALS: boolean = true;

  @IsEnum(LogLevel)
  @IsOptional()
  LOG_LEVEL: LogLevel = LogLevel.Info;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  JWT_SECRET: string = 'reconcilex-super-secret-jwt-key-minimum-32-chars-long';

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  JWT_EXPIRES_IN: string = '15m';

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  REFRESH_TOKEN_EXPIRES_IN: string = '7d';

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  POSTGRES_HOST: string = 'localhost';

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  POSTGRES_PORT: number = 5432;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  POSTGRES_USER: string = 'postgres';

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  POSTGRES_PASSWORD: string = 'postgres';

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  POSTGRES_DB: string = 'reconcilex';

  @IsString()
  @IsOptional()
  DATABASE_URL?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  MINIO_ENDPOINT: string = 'localhost';

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  MINIO_PORT: number = 9000;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  MINIO_CONSOLE_PORT: number = 9001;

  @IsBoolean()
  @IsOptional()
  MINIO_USE_SSL: boolean = false;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  MINIO_ROOT_USER: string = 'minioadmin';

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  MINIO_ROOT_PASSWORD: string = 'minioadmin';

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  MINIO_BUCKET: string = 'reconcilex-imports';
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const transformedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(transformedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => Object.values(error.constraints || {}).join(', '))
      .join('; ');
    throw new Error(`Environment configuration validation failed: ${errorMessages}`);
  }

  return transformedConfig;
}
