import { z } from "zod";

import { CRM_INTERNAL_TOKEN_ENV_KEY } from "../auth/crm-internal-token.constants";
import { ConfigError } from "../common/errors/config-error";
import { isValidTcpPort } from "../common/net/is-valid-tcp-port";
import { APP_ENV_KEYS, DEFAULT_APP_PORT, LOG_LEVELS, NODE_ENVIRONMENTS } from "./app-config.constants";
import type { LogLevel, NodeEnvironment } from "./app-config.constants";

/**
 * Configuracion de aplicacion (variables de entorno).
 *
 * Responsabilidades de este modulo:
 *   1. Validar PORT / NODE_ENV / LOG_LEVEL (con defaults seguros).
 *   2. Detectar presencia de secretos opcionales (KAPSO_*, CRM_*) sin exponerlos.
 *   3. Exponer `AppConfig` tipado para bootstrap (Pino, puerto, flags).
 *
 * Los secretos NUNCA viajan en `AppConfig`: solo flags `*Configured`.
 * El valor crudo sigue en `process.env` / `ConfigService` para guards y HMAC.
 *
 * Cronjob (`KAPSO_ENVIO_TEMPLATE_INICIAL_*`) y CORS (`CRM_FRONTEND_ORIGINS`)
 * se listan en el schema para documentar el catalogo, pero no entran al
 * objeto publico: el runner y `createCorsOptions` los leen de ConfigService/env.
 */

/** Config tipada de runtime (sin secretos en claro). */
export type AppConfig = {
    readonly port: number;
    readonly nodeEnv: NodeEnvironment;
    readonly logLevel: LogLevel;
    readonly kapsoApiKeyConfigured: boolean;
    readonly kapsoPlatformWebhookSecretConfigured: boolean;
    readonly kapsoWhatsappWebhookSecretConfigured: boolean;
    readonly kapsoWhatsappWebhookUrlConfigured: boolean;
    readonly crmApiInternalTokenConfigured: boolean;
};

class AppConfigError extends ConfigError {
    constructor(message: string) {
        super(message, "AppConfigError");
    }
}

type RawEnvironment = {
    readonly PORT: number;
    readonly NODE_ENV: NodeEnvironment;
    readonly LOG_LEVEL: LogLevel;
    readonly KAPSO_API_KEY?: string | undefined;
    readonly KAPSO_PLATFORM_WEBHOOK_SECRET?: string | undefined;
    readonly KAPSO_WHATSAPP_WEBHOOK_SECRET?: string | undefined;
    readonly KAPSO_WHATSAPP_WEBHOOK_URL?: string | undefined;
    readonly CRM_API_INTERNAL_TOKEN?: string | undefined;
};

/**
 * Schema Zod: coerce + defaults + transform a `AppConfig`.
 *
 * PORT usa `isValidTcpPort` (misma regla que `MYSQL_PORT`).
 * `isEnvValueConfigured` trata `""` como no configurado — intencional:
 * un secreto vacio no debe prender el flag y dejar pasar un guard.
 */
const environmentSchema = z
    .object({
        [APP_ENV_KEYS.PORT]: z.coerce.number().refine(isValidTcpPort, { message: "PORT must be an integer between 1 and 65535" }).default(DEFAULT_APP_PORT),
        [APP_ENV_KEYS.NODE_ENV]: z.enum(NODE_ENVIRONMENTS).default("development"),
        [APP_ENV_KEYS.LOG_LEVEL]: z.enum(LOG_LEVELS).default("info"),
        [APP_ENV_KEYS.KAPSO_API_KEY]: z.string().optional(),
        [APP_ENV_KEYS.KAPSO_PLATFORM_WEBHOOK_SECRET]: z.string().optional(),
        [APP_ENV_KEYS.KAPSO_WHATSAPP_WEBHOOK_SECRET]: z.string().optional(),
        [APP_ENV_KEYS.KAPSO_WHATSAPP_WEBHOOK_URL]: z.string().optional(),
        [APP_ENV_KEYS.KAPSO_ENVIO_TEMPLATE_INICIAL_ENABLED]: z.string().optional(),
        [APP_ENV_KEYS.KAPSO_ENVIO_TEMPLATE_INICIAL_INTERVAL_MS]: z.string().optional(),
        [APP_ENV_KEYS.KAPSO_ENVIO_TEMPLATE_INICIAL_BATCH_SIZE]: z.string().optional(),
        [CRM_INTERNAL_TOKEN_ENV_KEY]: z.string().optional(),
        [APP_ENV_KEYS.CRM_FRONTEND_ORIGINS]: z.string().optional(),
    })
    .transform((env): AppConfig => toPublicAppConfig(env));

/**
 * Corta los secretos y deja solo flags booleanos + valores de bootstrap.
 * Esta funcion es el unico lugar que decide "esta configurado o no".
 */
function toPublicAppConfig(env: RawEnvironment): AppConfig {
    return {
        port: env.PORT,
        nodeEnv: env.NODE_ENV,
        logLevel: env.LOG_LEVEL,
        kapsoApiKeyConfigured: isEnvValueConfigured(env.KAPSO_API_KEY),
        kapsoPlatformWebhookSecretConfigured: isEnvValueConfigured(env.KAPSO_PLATFORM_WEBHOOK_SECRET),
        kapsoWhatsappWebhookSecretConfigured: isEnvValueConfigured(env.KAPSO_WHATSAPP_WEBHOOK_SECRET),
        kapsoWhatsappWebhookUrlConfigured: isEnvValueConfigured(env.KAPSO_WHATSAPP_WEBHOOK_URL),
        crmApiInternalTokenConfigured: isEnvValueConfigured(env.CRM_API_INTERNAL_TOKEN),
    };
}

/** `""` es falsy: un env seteado vacio no cuenta como secreto configurado. */
function isEnvValueConfigured(value: string | undefined): boolean {
    return Boolean(value);
}

/**
 * Parsea y valida el entorno.
 *
 * @param env - `process.env` o un stub de test
 * @returns Config publica (puerto, nivel de log, flags de secretos)
 * @throws {AppConfigError} Si PORT u otros campos no son usables
 */
export function parseAppConfig(env: NodeJS.ProcessEnv | Record<string, string | undefined>): AppConfig {
    const result = environmentSchema.safeParse(env);

    if (!result.success) {
        throw new AppConfigError(`Invalid environment configuration: ${result.error.message}`);
    }

    return result.data;
}

/**
 * Hook de Nest `ConfigModule.validate`.
 *
 * Valida el shape y DEVUELVE el env crudo: Nest tiene que seguir leyendo
 * `process.env` (guards, HMAC). Si devolvieramos `AppConfig`, ConfigService
 * perderia los secretos.
 */
export function validateEnvironment(env: Record<string, unknown>): Record<string, unknown> {
    parseAppConfig(env as NodeJS.ProcessEnv);
    return env;
}
