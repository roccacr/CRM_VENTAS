import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { HealthService } from './health.service';

/** Health-check (liveness) de la API. */
@Module({
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
