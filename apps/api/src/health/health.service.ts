import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface HealthIndicatorResult {
  status: 'up' | 'down';
  latencyMs?: number;
  message?: string;
}

export interface ReadinessCheckResponse {
  status: 'ok' | 'error';
  timestamp: string;
  checks: {
    database: HealthIndicatorResult;
    [key: string]: HealthIndicatorResult;
  };
}

export interface LivenessCheckResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  getLiveness(): LivenessCheckResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  async getReadiness(): Promise<{
    isHealthy: boolean;
    response: ReadinessCheckResponse;
  }> {
    const checks: ReadinessCheckResponse['checks'] = {
      database: { status: 'down' },
    };

    let isHealthy = true;

    // Database check
    try {
      const dbResult = await this.databaseService.checkHealth();
      checks.database = {
        status: 'up',
        latencyMs: dbResult.latencyMs,
      };
    } catch (error) {
      isHealthy = false;
      this.logger.warn(
        `Database readiness check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      checks.database = {
        status: 'down',
      };
    }

    return {
      isHealthy,
      response: {
        status: isHealthy ? 'ok' : 'error',
        timestamp: new Date().toISOString(),
        checks,
      },
    };
  }
}
