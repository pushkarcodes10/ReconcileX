import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService, LivenessCheckResponse, ReadinessCheckResponse } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Application liveness health check' })
  @ApiResponse({
    status: 200,
    description: 'Application is running',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-10-31T07:50:00.000Z',
        uptime: 12.34,
      },
    },
  })
  getHealth(): LivenessCheckResponse {
    return this.healthService.getLiveness();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Application readiness check (verifies database connectivity)' })
  @ApiResponse({
    status: 200,
    description: 'Application and dependencies are healthy',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-10-31T07:50:00.000Z',
        checks: {
          database: {
            status: 'up',
            latencyMs: 4,
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'One or more dependencies are unavailable',
    schema: {
      example: {
        status: 'error',
        timestamp: '2026-10-31T07:50:00.000Z',
        checks: {
          database: {
            status: 'down',
          },
        },
      },
    },
  })
  async getReadiness(@Res({ passthrough: true }) res: Response): Promise<ReadinessCheckResponse> {
    const { isHealthy, response } = await this.healthService.getReadiness();

    if (!isHealthy) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return response;
  }
}
