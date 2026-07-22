/**
 * Tipos compartidos del módulo Kapso (payloads, resúmenes de sync y API).
 *
 * Contratos internos entre clientes HTTP, servicios de sincronización
 * y repositorios, sin acoplarlos a entidades TypeORM.
 */

// ============================================================================
// TIPOS COMPARTIDOS DEL DOMINIO KAPSO
// ============================================================================

/**
 * Tipos compartidos del módulo Kapso.
 * Reúnen payloads normalizados, estados del flujo y contratos internos del sync.
 */

/** Objeto JSON genérico proveniente de respuestas o webhooks de Kapso. */
export type JsonRecord = Record<string, unknown>;

/**
 * Contexto mínimo del proyecto Kapso necesario para resolver la API key correcta
 * cuando el endpoint remoto depende del proyecto dueño del número.
 */
export type KapsoProjectContext = {
  projectId: string | null;
};

/**
 * Opciones adicionales de una llamada saliente hacia Kapso.
 * Se usan cuando el request debe salir con API key específica de proyecto o con
 * un override explícito.
 */
export type KapsoApiRequestOptions = {
  projectId?: string | null;
  apiKeyOverride?: string | null;
};

/** Vista resumida de un customer Kapso usada en listados y bootstrap sync. */
export type KapsoCustomerSummary = {
  id: string;
  name: string | null;
  externalId: string | null;
  raw: JsonRecord;
};

/** Vista resumida de un número WhatsApp usada en listados remotos. */
export type KapsoPhoneNumberSummary = {
  phoneNumberId: string;
  name: string | null;
  displayPhoneNumber: string | null;
  customerId: string | null;
  projectId: string | null;
  raw: JsonRecord;
};

/**
 * Detalle completo de un número WhatsApp cuando Kapso ya expone el recurso remoto.
 * Incluye datos básicos del número y snapshots de proyecto / customer asociados.
 */
export type KapsoPhoneNumberDetail = {
  phoneNumberId: string;
  name: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  businessAccountId: string | null;
  status: string | null;
  qualityRating: string | null;
  throughputTier: string | null;
  connectionType: string | null;
  customerId: string | null;
  customerName: string | null;
  customerExternalId: string | null;
  projectId: string | null;
  projectName: string | null;
  projectPayload: JsonRecord | null;
  customerPayload: JsonRecord | null;
  raw: JsonRecord;
};

/**
 * Configuración de webhook remoto, ya sea de tipo `kapso` o `meta`.
 * No incluye `secret_key`: se elimina al mapear para no persistir ni loguear secretos.
 */
export type KapsoWebhookSummary = {
  webhookId: string;
  kind: "kapso" | "meta";
  url: string;
  active: boolean;
  events: string[];
  payloadVersion: string | null;
  raw: JsonRecord;
};

/** Resultado resumido de un `POST /kapso/bootstrap/sync`. */
export type BootstrapSyncSummary = {
  projectWebhookEnsured: boolean;
  phoneNumbersSynced: number;
  perNumberWebhooksEnsured: number;
};

/** Resultado agregado de una corrida del worker `processPendingRemoteSyncs`. */
export type PendingRemoteSyncSummary = {
  scanned: number;
  recovered: number;
  stillPending: number;
  failed: number;
};

/**
 * Resultado interno al validar o crear los webhooks requeridos por número.
 * `warnings` acumula fallos no terminales para no abortar el sync completo.
 */
export type EnsurePerNumberWebhooksResult = {
  webhooks: KapsoWebhookSummary[];
  warnings: string[];
};
