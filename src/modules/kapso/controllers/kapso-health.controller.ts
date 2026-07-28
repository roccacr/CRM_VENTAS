/**
 * Endpoints de salud del proceso Kapso para orquestadores (K8s, load balancers, monitores).
 *
 * Son `@Public` y `@SkipThrottle` porque los probes no autentican y deben poder
 * ejecutarse con alta frecuencia sin consumir cupo de rate-limit de la API de negocio.
 */

import { getQueueToken } from "@nestjs/bullmq";
import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";
import { HealthCheck, HealthCheckService, HealthIndicatorResult, HealthIndicatorService, TypeOrmHealthIndicator } from "@nestjs/terminus";
import { SkipThrottle } from "@nestjs/throttler";
import { Queue } from "bullmq";

import { Public } from "../../../common/auth/auth.decorators";
import { KAPSO_JOBS_QUEUE } from "../common/kapso-jobs.constants";

/**
 * Distingue liveness (proceso vivo) de readiness (dependencias listas para trafico).
 *
 * Readiness valida MySQL y el driver de jobs activo. En modo local no exige Redis;
 * Redis/BullMQ solo se valida cuando `KAPSO_JOBS_DRIVER=bullmq`.
 */
@Controller("health")
@Public()
@SkipThrottle()
export class KapsoHealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly indicatorService: HealthIndicatorService,
    private readonly configService: ConfigService,
    private readonly moduleRef: ModuleRef,
  ) {}

  /**
   * Liveness: confirma que el proceso Nest responde.
   * No inspecciona dependencias externas a proposito (un DB caido no debe matar el pod
   * si el orquestador usa este endpoint como liveness).
   */
  @Get("live")
  liveness() {
    return { status: "ok" };
  }

  /**
   * Readiness: MySQL + jobs. Si falla, el balanceador deja de enviar trafico.
   */
  @Get("ready")
  @HealthCheck()
  readiness() {
    return this.health.check([() => this.database.pingCheck("mysql"), () => this.checkJobs()]);
  }

  /**
   * Comprueba que el driver de jobs actual esta listo.
   *
   * En `local`, los jobs viven dentro del mismo proceso API y no hay dependencia
   * externa que validar. En `bullmq`, se valida Redis con timeout corto (2s).
   */
  private async checkJobs(): Promise<HealthIndicatorResult> {
    const indicator = this.indicatorService.check("jobs");
    const jobsDriver = this.configService.get<string>("kapso.jobsDriver", "local");

    if (jobsDriver !== "bullmq") {
      return indicator.up({ driver: "local" });
    }

    let timeout: NodeJS.Timeout | undefined;

    try {
      const jobsQueue = this.moduleRef.get<Queue>(getQueueToken(KAPSO_JOBS_QUEUE), { strict: false });

      await Promise.race([
        jobsQueue.waitUntilReady(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("BullMQ readiness timeout")), 2_000);
        }),
      ]);

      return indicator.up({ driver: "bullmq" });
    } catch {
      return indicator.down({ driver: "bullmq", reason: "BullMQ/Redis no disponible" });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}
