/**
 * Constantes de la cola BullMQ y nombres de jobs/schedulers Kapso.
 *
 * Centraliza identificadores para registrar la cola, encolar trabajos y
 * referenciar schedulers de sync pendiente y candidatos de template de lead.
 */

/** Nombre de la cola BullMQ dedicada a trabajos Kapso. */
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
