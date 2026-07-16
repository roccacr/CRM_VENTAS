// ============================================================================
// IMPORTS
// ============================================================================

import { registerAs } from "@nestjs/config";

// ============================================================================
// HELPERS DE CONFIGURACION
// ============================================================================

/** Elimina barras finales para evitar URLs duplicadas al concatenar paths. */
const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, "");

/**
 * Intenta parsear un mapa `project.id -> apiKey`.
 * Si el JSON es invalido, devuelve un objeto vacio para no romper el arranque.
 */
const parseProjectApiKeys = (rawValue: string | undefined): Record<string, string> => {
  if (!rawValue?.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;
    return Object.entries(parsed).reduce<Record<string, string>>((accumulator, [projectId, apiKey]) => {
      if (typeof apiKey === "string" && apiKey.trim()) {
        accumulator[projectId] = apiKey.trim();
      }

      return accumulator;
    }, {});
  } catch {
    return {};
  }
};

// ============================================================================
// CONFIGURACION KAPSO
// ============================================================================

/**
 * Namespace `kapso`.
 *
 * Agrupa toda la configuracion de integracion contra Kapso Platform:
 * - base URL de la API;
 * - API key por defecto y opcionalmente por proyecto;
 * - URLs publicas para webhooks y redirects;
 * - secrets de verificacion;
 * - parametros del worker de reintentos.
 */
export default registerAs("kapso", () => {
  const publicBaseUrl = normalizeBaseUrl(process.env.KAPSO_PUBLIC_BASE_URL ?? "");
  const defaultApiKey = process.env.KAPSO_API_KEY ?? process.env.KAPSO_TEST_API_KEY ?? "";
  const setupRedirectBaseUrl = normalizeBaseUrl(process.env.KAPSO_SETUP_REDIRECT_BASE_URL ?? publicBaseUrl);

  return {
    // URL base de Kapso Platform API.
    apiBaseUrl: process.env.KAPSO_API_BASE_URL ?? "https://api.kapso.ai/platform/v1",

    // API key principal del proyecto activo; mantiene compatibilidad con alias legacy.
    apiKey: defaultApiKey,

    // Mapa opcional para resolver API keys distintas por `project.id`.
    projectApiKeys: parseProjectApiKeys(process.env.KAPSO_PROJECT_API_KEYS_JSON),

    // Base publica del API local para webhooks y callbacks.
    publicBaseUrl,

    // Base usada en redirects del setup OAuth / embedded signup.
    setupRedirectBaseUrl,

    // Secret del webhook de plataforma.
    platformWebhookSecret: process.env.KAPSO_PLATFORM_WEBHOOK_SECRET ?? "",

    // Secret del webhook de eventos WhatsApp / Meta relay.
    whatsappWebhookSecret: process.env.KAPSO_WHATSAPP_WEBHOOK_SECRET ?? "",

    // Intervalo del worker de `pending_remote_sync`.
    pendingSyncIntervalMs: Number(process.env.KAPSO_PENDING_SYNC_INTERVAL_MS ?? 30000),

    // Limite de registros procesados por corrida del worker.
    pendingSyncBatchSize: Number(process.env.KAPSO_PENDING_SYNC_BATCH_SIZE ?? 10),

    // Intervalo y limite del diagnostico de leads nuevos; el envio se implementara despues.
    leadTemplateIntervalMs: Number(process.env.KAPSO_LEAD_TEMPLATE_INTERVAL_MS ?? 60000),
    leadTemplateBatchSize: Number(process.env.KAPSO_LEAD_TEMPLATE_BATCH_SIZE ?? 100),
  };
});
