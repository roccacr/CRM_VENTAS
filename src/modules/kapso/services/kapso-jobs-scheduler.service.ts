/**
 * Registra los jobs periodicos del modulo Kapso al arrancar Nest.
 *
 * Por defecto corre dentro del mismo proceso API con `setInterval` y bloqueo
 * anti-solape. BullMQ queda disponible solo si `KAPSO_JOBS_DRIVER=bullmq`.
 */

import { getQueueToken } from "@nestjs/bullmq";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";
import { Queue } from "bullmq";

import { KAPSO_JOB_NAMES, KAPSO_JOB_SCHEDULERS, KAPSO_JOBS_QUEUE } from "../common/kapso-jobs.constants";
import { KapsoLeadAutomationService } from "./kapso-lead-automation.service";
import { KapsoPhoneNumberSyncService } from "./kapso-phone-number-sync.service";

/**
 * Inicializa los jobs recurrentes: reintento de sync remoto y envio de plantillas de lead.
 */
@Injectable()
export class KapsoJobsSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KapsoJobsSchedulerService.name);
  private readonly localTimers: NodeJS.Timeout[] = [];
  private readonly runningLocalJobs = new Set<string>();

  constructor(
    private readonly configService: ConfigService,
    private readonly moduleRef: ModuleRef,
    private readonly phoneNumberSyncService: KapsoPhoneNumberSyncService,
    private readonly leadAutomationService: KapsoLeadAutomationService,
  ) {}

  async onModuleInit(): Promise<void> {
    const jobsDriver = this.configService.get<string>("kapso.jobsDriver", "local");
    const pendingSyncIntervalMs = this.configService.get<number>("kapso.pendingSyncIntervalMs", 30_000);
    const leadTemplateIntervalMs = this.configService.get<number>("kapso.leadTemplateIntervalMs", 60_000);

    if (jobsDriver === "bullmq") {
      const queue = this.moduleRef.get<Queue>(getQueueToken(KAPSO_JOBS_QUEUE), { strict: false });

      await Promise.all([
        this.upsertIntervalJob(queue, KAPSO_JOB_SCHEDULERS.pendingRemoteSync, KAPSO_JOB_NAMES.pendingRemoteSync, pendingSyncIntervalMs),
        this.upsertIntervalJob(queue, KAPSO_JOB_SCHEDULERS.leadTemplateCandidates, KAPSO_JOB_NAMES.leadTemplateCandidates, leadTemplateIntervalMs),
      ]);

      return;
    }

    this.scheduleLocalInterval(KAPSO_JOB_NAMES.pendingRemoteSync, pendingSyncIntervalMs, () => this.phoneNumberSyncService.processPendingRemoteSyncs());
    this.scheduleLocalInterval(KAPSO_JOB_NAMES.leadTemplateCandidates, leadTemplateIntervalMs, () => this.leadAutomationService.processLeadTemplateCandidates());
  }

  onModuleDestroy(): void {
    for (const timer of this.localTimers) {
      clearInterval(timer);
    }
  }

  /**
   * Crea o actualiza un scheduler BullMQ, o lo elimina si el intervalo es invalido.
   */
  private async upsertIntervalJob(queue: Queue, schedulerId: string, jobName: string, intervalMs: number): Promise<void> {
    if (intervalMs <= 0) {
      await queue.removeJobScheduler(schedulerId);
      return;
    }

    await queue.upsertJobScheduler(
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

  /**
   * Ejecuta jobs dentro del mismo API sin Redis y sin solapar un mismo job.
   */
  private scheduleLocalInterval(jobName: string, intervalMs: number, handler: () => Promise<unknown>): void {
    if (intervalMs <= 0) {
      this.logger.log(`Local job disabled job=${jobName}`);
      return;
    }

    const runJob = async () => {
      if (this.runningLocalJobs.has(jobName)) {
        this.logger.warn(`Local job skipped because previous execution is still running job=${jobName}`);
        return;
      }

      this.runningLocalJobs.add(jobName);

      try {
        await handler();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.error(`Local job failed job=${jobName}: ${message}`);
      } finally {
        this.runningLocalJobs.delete(jobName);
      }
    };

    const timer = setInterval(() => {
      void runJob();
    }, intervalMs);

    if (typeof timer.unref === "function") {
      timer.unref();
    }

    this.localTimers.push(timer);
    this.logger.log(`Local job scheduled job=${jobName} everyMs=${intervalMs}`);
  }
}
