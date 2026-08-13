import { Injectable } from '@nestjs/common';

const SERVICE_NAME = 'api-kapso-git' as const;

/** Payload fijo de liveness. */
export type HealthStatus = {
  readonly status: 'ok';
  readonly service: typeof SERVICE_NAME;
  readonly timestamp: string;
};

/**
 * Construye el status de salud.
 * Sin I/O: no toca DB ni red (ver HealthModule para el porqué).
 */
@Injectable()
export class HealthService {
  getStatus(): HealthStatus {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      timestamp: new Date().toISOString(),
    };
  }
}
