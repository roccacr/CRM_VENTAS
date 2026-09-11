import { APP_ENV_KEYS } from "../config/app-config.constants";

const KAPSO_PLATFORM_BASE_URL = "https://api.kapso.ai/platform/v1";
export const KAPSO_PHONE_NUMBERS_COLLECTION_URL = `${KAPSO_PLATFORM_BASE_URL}/whatsapp/phone_numbers?per_page=100&page=1`;
export const KAPSO_PHONE_NUMBER_URL = `${KAPSO_PLATFORM_BASE_URL}/whatsapp/phone_numbers`;
export const KAPSO_WHATSAPP_WEBHOOKS_URL = `${KAPSO_PLATFORM_BASE_URL}/whatsapp/webhooks`;

export const KAPSO_API_ENV_KEYS = {
    API_KEY: APP_ENV_KEYS.KAPSO_API_KEY,
    PLATFORM_WEBHOOK_SECRET: APP_ENV_KEYS.KAPSO_PLATFORM_WEBHOOK_SECRET,
    WHATSAPP_WEBHOOK_SECRET: APP_ENV_KEYS.KAPSO_WHATSAPP_WEBHOOK_SECRET,
    WHATSAPP_WEBHOOK_URL: APP_ENV_KEYS.KAPSO_WHATSAPP_WEBHOOK_URL,
} as const;

export const KAPSO_SYNC_STATUS_DEFAULT = "synced";
export const KAPSO_CREATED_STATUS = "created";

/** Header de autenticacion Platform/Meta de Kapso. El CRM usa otro esquema (Bearer / x-crm-api-token). */
export const KAPSO_API_KEY_HEADER = "X-API-Key";
