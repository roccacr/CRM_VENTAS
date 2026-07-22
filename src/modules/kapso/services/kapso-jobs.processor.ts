/**
 * Worker BullMQ que ejecuta los jobs periódicos del módulo Kapso.
 *
 * `concurrency: 1` serializa corridas en esta instancia para no solapar
 * reintentos de sync ni envíos de plantillas dentro del mismo proceso;
 * los services además mantienen locks en memoria y reservas en BD.
 */

import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";

import { KAPSO_JOB_NAMES, KAPSO_JOBS_QUEUE } from "../common/kapso-jobs.constants";
import { KapsoLeadAutomationService } from "./kapso-lead-automation.service";
import { KapsoPhoneNumberSyncService } from "./kapso-phone-number-sync.service";

/**
 * Despacha jobs conocidos a los orquestadores de sync / automatización de leads.
 * Jobs con nombre desconocido se ignoran (no fallan) para tolerar leftovers en Redis.
 */
@Processor(KAPSO_JOBS_QUEUE, { concurrency: 1 })
export class KapsoJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(KapsoJobsProcessor.name);

  constructor(
    private readonly phoneNumberSyncService: KapsoPhoneNumberSyncService,
    private readonly leadAutomationService: KapsoLeadAutomationService,
  ) {
    super();
  }

  /**
   * Punto de entrada BullMQ: enruta por `job.name` hacia el servicio correspondiente.
   *
   * @param job - Job de la cola `KAPSO_JOBS_QUEUE`.
   * @returns Resumen del worker o `{ ignored: true }` si el nombre no está mapeado.
   */
  async process(job: Job): Promise<unknown> {
    if (job.name === KAPSO_JOB_NAMES.pendingRemoteSync) {
      return this.phoneNumberSyncService.processPendingRemoteSyncs();
    }

    if (job.name === KAPSO_JOB_NAMES.leadTemplateCandidates) {
      return this.leadAutomationService.processLeadTemplateCandidates();
    }

    this.logger.warn(`Ignoring unknown Kapso job name=${job.name} jobId=${job.id ?? "n/a"}`);
    return { ignored: true };
  }
}
