import { registerAs } from '@nestjs/config';

export interface AppConfig {
  nodeEnv: string;
  port: number;
  apiPrefix: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  logging: {
    level: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  database: {
    host: string;
    port: number;
    user: string;
    password?: string;
    database: string;
    url?: string;
  };
}

export default registerAs('app', (): AppConfig => {
  const databaseUrl =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'reconcilex'}`;

  const corsOrigin = process.env.CORS_ORIGIN || '*';
  const origins = corsOrigin.includes(',')
    ? corsOrigin.split(',').map((origin) => origin.trim())
    : corsOrigin;

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    apiPrefix: process.env.API_PREFIX || 'api/v1',
    cors: {
      origin: origins,
      credentials: process.env.CORS_CREDENTIALS !== 'false',
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
    },
    jwt: {
      secret: process.env.JWT_SECRET || 'reconcilex-super-secret-jwt-key-minimum-32-chars-long',
      expiresIn: process.env.JWT_EXPIRES_IN || '15m',
      refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
    },
    database: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DB || 'reconcilex',
      url: databaseUrl,
    },
  };
});
