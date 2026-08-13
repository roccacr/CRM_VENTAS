import { Injectable } from '@nestjs/common';

/** Payload de liveness. */
export type HealthStatus = {
  readonly status: 'ok';
  readonly service: 'api-kapso-git';
  readonly timestamp: string;
};

/** Estado de salud sin dependencias externas (DB/Kapso). */
@Injectable()
export class HealthService {
  getStatus(): HealthStatus {
    return {
      status: 'ok',
      service: 'api-kapso-git',
      timestamp: new Date().toISOString(),
    };
  }
}
