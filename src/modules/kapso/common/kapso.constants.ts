/**
 * Constantes de eventos webhook Kapso (por número y de plataforma).
 *
 * Listas centralizadas para registrar suscripciones y tipar nombres de evento.
 */

// ============================================================================
// EVENTOS KAPSO
// ============================================================================

/**
 * Constantes de eventos webhook registrados en Kapso Platform API.
 * Se centralizan aquí para evitar arrays hardcodeados en cada servicio.
 */

/**
 * Eventos de mensajería WhatsApp que el CRM espera recibir en el webhook por número
 * de tipo `kind: kapso`.
 */
export const KAPSO_DEFAULT_EVENTS = [
  "whatsapp.message.received",
  "whatsapp.message.sent",
  "whatsapp.conversation.started",
  "whatsapp.conversation.inactive",
  "whatsapp.conversation.ended",
  "whatsapp.message.delivered",
  "whatsapp.message.read",
  "whatsapp.message.failed",
] as const;

/**
 * Eventos globales a nivel de proyecto usados para enterarse de altas y bajas
 * de números conectados en Kapso.
 */
export const KAPSO_PLATFORM_EVENTS = ["whatsapp.phone_number.created", "whatsapp.phone_number.deleted"] as const;

/** Alias tipado de cada evento permitido dentro de `KAPSO_DEFAULT_EVENTS`. */
export type KapsoDefaultEvent = (typeof KAPSO_DEFAULT_EVENTS)[number];

/** Alias tipado de cada evento permitido dentro de `KAPSO_PLATFORM_EVENTS`. */
export type KapsoPlatformEvent = (typeof KAPSO_PLATFORM_EVENTS)[number];
