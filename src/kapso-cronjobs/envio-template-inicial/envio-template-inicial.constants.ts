import { APP_ENV_KEYS } from "../../config/app-config.constants";

/** Id funcional del flujo configurado en tabla `kapso_cronjob_configuracion`. */
export const ENVIO_TEMPLATE_INICIAL_CRONJOB_ID = "envio_template_inicial";

/** Template aprobado en Kapso: saludo, MARKETING, es_ES, 3 parametros. */
export const ENVIO_TEMPLATE_INICIAL_TEMPLATE_NAME = "saludo";
export const ENVIO_TEMPLATE_INICIAL_TEMPLATE_LANGUAGE = "es_ES";

/** Candidatos CRM que todavia necesitan intento de contacto por WhatsApp. */
export const LEAD_PENDING_TEMPLATE_SENT_STATUS = 2;
export const LEAD_INTERESADO_STATUS = 2;
export const LEAD_INTERESADO_SEGUIMIENTO = "01-LEAD-INTERESADO";

/** Estado CRM posterior a cualquier intento tecnico del template inicial. */
export const LEAD_TEMPLATE_PROCESSED_STATUS = 0;
export const LEAD_POST_TEMPLATE_SEGUIMIENTO = "08-LEAD-SEGUIMIENTO";
export const LEAD_POST_TEMPLATE_ACCION = 3;

/** Caidas CRM usadas por el flujo automatico de template inicial. */
export const CAIDA_NUMERO_TELEFONO_INVALIDO = 68;
export const CAIDA_TEMPLATE_INICIAL_ENTREGADO = 70;

/** Defaults conservadores: el runner queda controlado por env y lote pequeno. */
export const DEFAULT_ENVIO_TEMPLATE_INICIAL_INTERVAL_MS = 60_000;
export const DEFAULT_ENVIO_TEMPLATE_INICIAL_BATCH_SIZE = 10;

/**
 * Env vars del runner. Los nombres salen de `APP_ENV_KEYS` para no divergir
 * del catalogo de bootstrap (`src/config`).
 */
export const ENVIO_TEMPLATE_INICIAL_ENV_KEYS = {
    API_KEY: APP_ENV_KEYS.KAPSO_API_KEY,
    BATCH_SIZE: APP_ENV_KEYS.KAPSO_ENVIO_TEMPLATE_INICIAL_BATCH_SIZE,
    ENABLED: APP_ENV_KEYS.KAPSO_ENVIO_TEMPLATE_INICIAL_ENABLED,
    INTERVAL_MS: APP_ENV_KEYS.KAPSO_ENVIO_TEMPLATE_INICIAL_INTERVAL_MS,
} as const;

/** Tipo de documento en bitacora CRM. El webhook de respuesta usa el mismo literal. */
export const BITACORA_DOCUMENT_TYPE = "WhatsApp Kapso";

export const TEMPLATE_INITIAL_EVENTS = {
    FAILED: "kapso.template.initial.failed",
    INVALID_PHONE: "kapso.template.initial.invalid_phone",
    SENT: "kapso.template.initial.sent",
} as const;

export const TEMPLATE_DEFAULTS = {
    ADMIN_NAME: "asesor CRM",
    LEAD_NAME: "cliente",
} as const;

export const TEMPLATE_ATTEMPT_STATUS = {
    FAILED: "failed",
    INVALID_PHONE: "invalid_phone",
    PROCESSING: "processing",
    SENT: "sent",
} as const;
