import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { HealthService, HealthStatus } from './health.service';

/** `GET /api/v1/health` — indica si el proceso Nest está vivo. */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({
    description: 'API health status.',
    schema: {
      example: {
        status: 'ok',
        service: 'api-kapso-git',
        timestamp: '2026-08-13T18:00:00.000Z',
      },
    },
  })
  getHealth(): HealthStatus {
    return this.healthService.getStatus();
  }
}
