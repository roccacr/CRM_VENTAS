/**
 * Namespace de configuración de la integración Kapso / Meta WhatsApp.
 *
 * Agrupa URLs, secretos de webhook/media, API keys por proyecto y parámetros
 * de jobs de sincronización bajo la clave `kapso` consumida por el módulo Kapso.
 */
import { registerAs } from "@nestjs/config";

/**
 * Elimina barras finales de una URL base.
 *
 * Evita dobles `//` al concatenar paths de callbacks y endpoints Meta/Kapso.
 */
const normalizeBaseUrl = (url: string): string => url.replace(/\/+$/, "");

/**
 * Intenta parsear un mapa `project.id -> apiKey`.
 *
 * Si el JSON es inválido, devuelve un objeto vacío para no romper el arranque;
 * las claves faltantes se resuelven en runtime con la API key por defecto.
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

/**
 * Registra el bloque `kapso` en ConfigModule.
 *
 * Unifica secretos de firma, URLs públicas de setup y cadencias de sync para
 * que servicios de webhook, media y colas compartan la misma fuente tipada.
 */
export default registerAs("kapso", () => {
  const publicBaseUrl = normalizeBaseUrl(process.env.KAPSO_PUBLIC_BASE_URL ?? "");
  const defaultApiKey = process.env.KAPSO_API_KEY ?? process.env.KAPSO_TEST_API_KEY ?? "";
  const setupRedirectBaseUrl = normalizeBaseUrl(process.env.KAPSO_SETUP_REDIRECT_BASE_URL ?? publicBaseUrl);

  return {
    apiBaseUrl: process.env.KAPSO_API_BASE_URL ?? "https://api.kapso.ai/platform/v1",

    metaApiBaseUrl: normalizeBaseUrl(process.env.KAPSO_META_API_BASE_URL ?? "https://api.kapso.ai/meta/whatsapp/v24.0"),

    // API key principal del proyecto activo; mantiene compatibilidad con alias legacy.
    apiKey: defaultApiKey,

    projectApiKeys: parseProjectApiKeys(process.env.KAPSO_PROJECT_API_KEYS_JSON),

    publicBaseUrl,

    setupRedirectBaseUrl,

    mediaStoragePath: process.env.KAPSO_MEDIA_STORAGE_PATH ?? "archivos",

    mediaMaxFileSizeBytes: Number(process.env.KAPSO_MEDIA_MAX_FILE_SIZE_MB ?? 50) * 1024 * 1024,

    mediaSigningSecret: process.env.KAPSO_MEDIA_SIGNING_SECRET ?? "",
    mediaSignedUrlTtlSeconds: Number(process.env.KAPSO_MEDIA_SIGNED_URL_TTL_SECONDS ?? 3600),

    platformWebhookSecret: process.env.KAPSO_PLATFORM_WEBHOOK_SECRET ?? "",

    whatsappWebhookSecret: process.env.KAPSO_WHATSAPP_WEBHOOK_SECRET ?? "",

    // El relay Meta puede tener un secret distinto al webhook Kapso Events.
    metaWebhookSecret: process.env.KAPSO_META_WEBHOOK_SECRET ?? process.env.KAPSO_WHATSAPP_WEBHOOK_SECRET ?? "",

    pendingSyncIntervalMs: Number(process.env.KAPSO_PENDING_SYNC_INTERVAL_MS ?? 30000),

    pendingSyncBatchSize: Number(process.env.KAPSO_PENDING_SYNC_BATCH_SIZE ?? 10),

    jobsDriver: (process.env.KAPSO_JOBS_DRIVER ?? "local").trim().toLowerCase(),

    leadTemplateIntervalMs: Number(process.env.KAPSO_LEAD_TEMPLATE_INTERVAL_MS ?? 60000),
    leadTemplateBatchSize: Number(process.env.KAPSO_LEAD_TEMPLATE_BATCH_SIZE ?? 100),
  };
});
