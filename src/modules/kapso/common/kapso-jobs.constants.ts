/**
 * Constantes compartidas por el scheduler local y el modo alternativo BullMQ.
 *
 * Centraliza identificadores para ejecutar sync pendiente y candidatos de
 * template de lead sin duplicar nombres entre modos de ejecucion.
 */

/** Nombre logico de la cola usada solo cuando `KAPSO_JOBS_DRIVER=bullmq`. */
export const KAPSO_JOBS_QUEUE = "kapso-jobs";

/** Nombres de jobs procesados por `KapsoJobsProcessor`. */
export const KAPSO_JOB_NAMES = {
  pendingRemoteSync: "pending-remote-sync",
  leadTemplateCandidates: "lead-template-candidates",
} as const;

/** Identificadores de schedulers repetitivos asociados a cada job. */
export const KAPSO_JOB_SCHEDULERS = {
  pendingRemoteSync: "kapso-pending-remote-sync-scheduler",
  leadTemplateCandidates: "kapso-lead-template-candidates-scheduler",
} as const;
