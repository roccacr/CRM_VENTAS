/**
 * Endpoints de salud del proceso Kapso para orquestadores (K8s, load balancers, monitores).
 *
 * Son `@Public` y `@SkipThrottle` porque los probes no autentican y deben poder
 * ejecutarse con alta frecuencia sin consumir cupo de rate-limit de la API de negocio.
 */

import { InjectQueue } from "@nestjs/bullmq";
import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService, HealthIndicatorResult, HealthIndicatorService, TypeOrmHealthIndicator } from "@nestjs/terminus";
import { SkipThrottle } from "@nestjs/throttler";
import { Queue } from "bullmq";

import { Public } from "../../../common/auth/auth.decorators";
import { KAPSO_JOBS_QUEUE } from "../common/kapso-jobs.constants";

/**
 * Distingue liveness (proceso vivo) de readiness (dependencias listas para tráfico).
 *
 * Readiness valida MySQL y Redis/BullMQ porque sin ellos no se pueden persistir
 * webhooks ni ejecutar jobs de reintento/plantillas.
 */
@Controller("health")
@Public()
@SkipThrottle()
export class KapsoHealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly indicatorService: HealthIndicatorService,
    @InjectQueue(KAPSO_JOBS_QUEUE) private readonly jobsQueue: Queue,
  ) {}

  /**
   * Liveness: confirma que el proceso Nest responde.
   * No inspecciona dependencias externas a propósito (un DB caído no debe matar el pod
   * si el orquestador usa este endpoint como liveness).
   */
  @Get("live")
  liveness() {
    return { status: "ok" };
  }

  /**
   * Readiness: MySQL + Redis (cola BullMQ). Si falla, el balanceador deja de enviar tráfico.
   */
  @Get("ready")
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.database.pingCheck("mysql"), () => this.checkRedis()]);
  }

  /**
   * Comprueba que la cola BullMQ puede conectar a Redis, con timeout corto (2s)
   * para no colgar el probe de readiness.
   */
  private async checkRedis(): Promise<HealthIndicatorResult> {
    const indicator = this.indicatorService.check("redis");
    let timeout: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        this.jobsQueue.waitUntilReady(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("Redis readiness timeout")), 2_000);
        }),
      ]);
      return indicator.up();
    } catch {
      return indicator.down({ reason: "Redis no disponible" });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
