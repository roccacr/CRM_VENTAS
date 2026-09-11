import { APP_ENV_KEYS } from "../config/app-config.constants";

/**
 * Headers que Kapso manda en cada webhook.
 * Express los lowercasetiza; estos literales son los que leen guards y `@Headers()`.
 */
export const KAPSO_WEBHOOK_HEADERS = {
    EVENT: "x-webhook-event",
    IDEMPOTENCY_KEY: "x-idempotency-key",
    SIGNATURE: "x-webhook-signature",
} as const;

export const KAPSO_PLATFORM_WEBHOOK_GUARD = {
    envKey: APP_ENV_KEYS.KAPSO_PLATFORM_WEBHOOK_SECRET,
    headerName: KAPSO_WEBHOOK_HEADERS.SIGNATURE,
    serviceLabel: "Kapso",
} as const;

export const KAPSO_WHATSAPP_WEBHOOK_GUARD = {
    envKey: APP_ENV_KEYS.KAPSO_WHATSAPP_WEBHOOK_SECRET,
    headerName: KAPSO_WEBHOOK_HEADERS.SIGNATURE,
    serviceLabel: "Kapso WhatsApp",
} as const;

export const KAPSO_PLATFORM_EVENTS = {
    PHONE_NUMBER_CREATED: "whatsapp.phone_number.created",
    PHONE_NUMBER_DELETED: "whatsapp.phone_number.deleted",
} as const;

export const KAPSO_WHATSAPP_EVENTS = {
    MESSAGE_RECEIVED: "whatsapp.message.received",
} as const;

export const WHATSAPP_RESPONSE_CAIDA = {
    ACCEPTED_INFO: 69,
    REJECTED_INFO: 67,
} as const;

export const BITACORA_DOCUMENT_TYPE = "WhatsApp Kapso";
export const WHATSAPP_RESPONSE_EVENT = "kapso.whatsapp.response.processed";
