/**
 * Registra en BullMQ los schedulers periódicos del módulo Kapso al arrancar Nest.
 *
 * Usa `upsertJobScheduler` para ser idempotente entre reinicios: no duplica
 * schedulers si el proceso reinicia. Intervalo `<= 0` elimina el scheduler
 * (permite apagar un job por configuración sin redeploy de código).
 */

import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";

import { KAPSO_JOB_NAMES, KAPSO_JOB_SCHEDULERS, KAPSO_JOBS_QUEUE } from "../common/kapso-jobs.constants";

/**
 * Inicializa los jobs recurrentes: reintento de sync remoto y envío de plantillas de lead.
 */
@Injectable()
export class KapsoJobsSchedulerService implements OnModuleInit {
  constructor(
    @InjectQueue(KAPSO_JOBS_QUEUE) private readonly queue: Queue,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Hook de arranque: asegura ambos schedulers con intervalos de configuración.
   * Backoff exponencial y retención limitada de jobs evitan saturar Redis.
   */
  async onModuleInit(): Promise<void> {
    await Promise.all([
      this.upsertIntervalJob(
        KAPSO_JOB_SCHEDULERS.pendingRemoteSync,
        KAPSO_JOB_NAMES.pendingRemoteSync,
        this.configService.get<number>("kapso.pendingSyncIntervalMs", 30_000),
      ),
      this.upsertIntervalJob(
        KAPSO_JOB_SCHEDULERS.leadTemplateCandidates,
        KAPSO_JOB_NAMES.leadTemplateCandidates,
        this.configService.get<number>("kapso.leadTemplateIntervalMs", 60_000),
      ),
    ]);
  }

  /**
   * Crea o actualiza un scheduler cada `intervalMs`, o lo elimina si el intervalo es inválido.
   *
   * @param schedulerId - Id estable del scheduler BullMQ.
   * @param jobName - Nombre del job que procesará `KapsoJobsProcessor`.
   * @param intervalMs - Periodicidad en milisegundos.
   */
  private async upsertIntervalJob(schedulerId: string, jobName: string, intervalMs: number): Promise<void> {
    if (intervalMs <= 0) {
      await this.queue.removeJobScheduler(schedulerId);
      return;
    }

    await this.queue.upsertJobScheduler(
      schedulerId,
      { every: intervalMs },
      {
        name: jobName,
        data: {},
        opts: {
          attempts: 3,
          backoff: {
            delay: 5_000,
            type: "exponential",
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      },
    );
  }
}
