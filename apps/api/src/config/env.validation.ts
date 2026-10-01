import { BlockList, isIP } from "node:net";

import { z } from "zod";

import { addDatabaseTlsIssues, booleanEnvSchema, tcpPortSchema } from "./database-env.schema.js";
import { APPROVED_DATABASE_NAME } from "./product.constants.js";

// ============================================================================
// Contrato de variables de entorno para el runtime minimo de identidad.
//
// Este archivo es una frontera de seguridad: cualquier config critica debe
// fallar durante bootstrap, no durante el primer request. No se agregan defaults
// silenciosos para secretos, origenes CORS ni nombre de base de datos.
// ============================================================================

/** Longitud minima para evitar secretos triviales. */
const MIN_RUNTIME_SECRET_LENGTH = 32;
const MICROSOFT_CACHE_KEY_BYTES = 32;
const TRUST_ALL_PROXY_VALUES = new Set(["*", "0.0.0.0/0", "::/0"]);
const IPV4_VERSION = 4;
const IPV6_VERSION = 6;
const MAX_IPV4_CIDR_PREFIX = 32;
const MAX_IPV6_CIDR_PREFIX = 128;
const MIN_IPV4_TRUSTED_PROXY_PREFIX = 8;
const MIN_IPV6_TRUSTED_PROXY_PREFIX = 32;
const IPV4_MAPPED_PREFIX_OFFSET = 96;
const IPV4_MAPPED_SPACE = new BlockList();
IPV4_MAPPED_SPACE.addSubnet("::ffff:0:0", IPV4_MAPPED_PREFIX_OFFSET, "ipv6");
const REQUIRED_MICROSOFT_OIDC_KEYS = ["MICROSOFT_TENANT_ID", "MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET", "MICROSOFT_REDIRECT_URI", "MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY"] as const;

type MicrosoftOidcConfig = {
    AUDIT_HASH_SECRET: string;
    AUTH_TOKEN_HASH_SECRET: string;
    COOKIE_SECRET: string;
    MICROSOFT_CLIENT_ID?: string | undefined;
    MICROSOFT_CLIENT_SECRET?: string | undefined;
    MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY?: string | undefined;
    MICROSOFT_REDIRECT_URI?: string | undefined;
    MICROSOFT_TENANT_ID?: string | undefined;
};

/**
 * Entero positivo para limites operativos configurables.
 */
const positiveIntegerSchema = z.coerce.number().int().positive();

/**
 * Valida claves base64 que se convierten exactamente en 32 bytes.
 *
 * La cache MSAL puede contener refresh tokens Microsoft. Aunque MSAL no expone
 * esos tokens a nuestra app, el blob serializado debe persistirse cifrado con
 * una llave de servidor fuerte y distinta de los secretos de cookies/HMAC.
 */
const microsoftCacheEncryptionKeySchema = z
    .string()
    .optional()
    .superRefine((value, context) => {
        if (!value) {
            return;
        }

        const key = Buffer.from(value, "base64");

        if (key.length !== MICROSOFT_CACHE_KEY_BYTES || key.toString("base64") !== value) {
            context.addIssue({
                code: "custom",
                message: "MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY debe ser base64 de 32 bytes.",
            });
        }
    });

/**
 * Microsoft debe configurarse completo o no configurarse.
 */
const addMicrosoftOidcIssues = (config: MicrosoftOidcConfig, context: z.RefinementCtx): void => {
    const microsoftValues = [config.MICROSOFT_TENANT_ID, config.MICROSOFT_CLIENT_ID, config.MICROSOFT_CLIENT_SECRET, config.MICROSOFT_REDIRECT_URI];

    if (microsoftValues.some(Boolean)) {
        addMissingMicrosoftConfigIssues(config, context);
    }

    addMicrosoftSecretSeparationIssue(config, context);
};

/**
 * Evita arrancar con una app registration a medias.
 */
const addMissingMicrosoftConfigIssues = (config: MicrosoftOidcConfig, context: z.RefinementCtx): void => {
    for (const key of REQUIRED_MICROSOFT_OIDC_KEYS) {
        if (!config[key]) {
            context.addIssue({
                code: "custom",
                message: `${key} es requerido cuando se configura Microsoft OIDC.`,
                path: [key],
            });
        }
    }
};

/**
 * La llave que cifra cache MSAL no puede reutilizar secretos BFF/HMAC.
 */
const addMicrosoftSecretSeparationIssue = (config: MicrosoftOidcConfig, context: z.RefinementCtx): void => {
    if (config.MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY && [config.COOKIE_SECRET, config.AUDIT_HASH_SECRET, config.AUTH_TOKEN_HASH_SECRET].includes(config.MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY)) {
        context.addIssue({
            code: "custom",
            message: "MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY debe ser distinto de los secretos BFF/HMAC.",
            path: ["MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY"],
        });
    }
};

/**
 * Valida que FRONTEND_ORIGIN sea un origin puro, sin path, query ni slash final.
 */
const frontendOriginSchema = z.url().superRefine((value, context) => {
    const parsed = new URL(value);

    if (parsed.origin !== value) {
        context.addIssue({
            code: "custom",
            message: "FRONTEND_ORIGIN debe ser un origin exacto, sin path, query ni slash final.",
        });
    }
});

/**
 * Allowlist extra de origins, separada por comas.
 *
 * Cada origen pasa por la misma regla que `FRONTEND_ORIGIN`: sin path, query
 * ni slash final. Un valor inválido rechaza toda la variable. Un hueco entre
 * comas se ignora. No admite `*`.
 */
const frontendAllowedOriginsSchema = z.string().superRefine((value, context) => {
    for (const origin of value.split(",")) {
        const normalizedOrigin = origin.trim();

        if (!normalizedOrigin) {
            continue;
        }

        const result = frontendOriginSchema.safeParse(normalizedOrigin);

        if (!result.success) {
            context.addIssue({
                code: "custom",
                message: "FRONTEND_ALLOWED_ORIGINS debe listar origins exactos separados por coma, sin path, query ni slash final.",
            });
            return;
        }
    }
});

/**
 * Divide TRUSTED_PROXY_IPS preservando una sola regla para Zod y main.ts.
 */
const splitTrustedProxyEntries = (value: string): string[] =>
    value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

/**
 * Separa una entrada de proxy entre IP y prefijo CIDR opcional.
 */
const splitProxyCidrEntry = (entry: string): { address: string; prefix: number | null } | null => {
    const parts = entry.split("/");

    if (parts.length > 2) {
        return null;
    }

    const [address, rawPrefix] = parts;

    if (!address) {
        return null;
    }

    if (rawPrefix === undefined) {
        return { address, prefix: null };
    }

    if (!/^\d+$/.test(rawPrefix)) {
        return null;
    }

    return { address, prefix: Number(rawPrefix) };
};

/**
 * Indica si una direccion IPv6 usa notacion IPv4-mapped.
 *
 * Fastify/proxy-addr puede tratar `::ffff:x.x.x.x/96+` como rango IPv4. Por
 * eso no basta con aplicar reglas IPv6 normales: el prefijo debe convertirse a
 * su equivalente IPv4 para evitar trust-all encubierto.
 */
const isIpv4MappedAddress = (address: string): boolean => IPV4_MAPPED_SPACE.check(address, "ipv6");

/**
 * Valida el prefijo efectivo de una subred IPv4-mapped.
 */
const hasValidIpv4MappedPrefix = (prefix: number | null): boolean => {
    if (prefix === null) {
        return true;
    }

    const effectiveIpv4Prefix = prefix - IPV4_MAPPED_PREFIX_OFFSET;
    return effectiveIpv4Prefix >= MIN_IPV4_TRUSTED_PROXY_PREFIX && effectiveIpv4Prefix <= MAX_IPV4_CIDR_PREFIX;
};

/**
 * Valida que el prefijo CIDR sea coherente con IPv4/IPv6 y no demasiado amplio.
 */
const hasValidTrustedProxyPrefix = (ipVersion: number, prefix: number | null): boolean => {
    if (prefix === null) {
        return true;
    }

    if (ipVersion === IPV4_VERSION) {
        return prefix >= MIN_IPV4_TRUSTED_PROXY_PREFIX && prefix <= MAX_IPV4_CIDR_PREFIX;
    }

    if (ipVersion === IPV6_VERSION) {
        return prefix >= MIN_IPV6_TRUSTED_PROXY_PREFIX && prefix <= MAX_IPV6_CIDR_PREFIX;
    }

    return false;
};

/**
 * Indica si una entrada de proxy es concreta y no equivale a trust-all.
 */
const isValidTrustedProxyEntry = (entry: string): boolean => {
    if (TRUST_ALL_PROXY_VALUES.has(entry)) {
        return false;
    }

    const parsed = splitProxyCidrEntry(entry);

    if (!parsed) {
        return false;
    }

    const ipVersion = isIP(parsed.address);

    if (ipVersion === IPV6_VERSION && isIpv4MappedAddress(parsed.address)) {
        return hasValidIpv4MappedPrefix(parsed.prefix);
    }

    return ipVersion !== 0 && hasValidTrustedProxyPrefix(ipVersion, parsed.prefix);
};

/**
 * Retorna la razon de invalidez para proxies confiables, si existe.
 */
const readTrustedProxyValidationError = (entries: string[]): string | null => {
    if (entries.length === 0) {
        return null;
    }

    for (const entry of entries) {
        if (!isValidTrustedProxyEntry(entry)) {
            return "TRUSTED_PROXY_IPS debe listar IPs/CIDRs concretos; no se permite confiar en todo el trafico.";
        }
    }

    return null;
};

/**
 * Valida entradas de proxies confiables sin permitir configuraciones trust-all.
 */
const validateTrustedProxyEntries = (value: string, context: z.RefinementCtx): void => {
    const validationError = readTrustedProxyValidationError(splitTrustedProxyEntries(value));

    if (validationError) {
        context.addIssue({
            code: "custom",
            message: validationError,
        });
    }
};

/**
 * Contrato de configuracion del runtime de identidad aprobado.
 *
 * Zod es la frontera unica para validar variables de entorno. Los valores
 * criticos de seguridad fallan durante arranque, no en el primer request.
 */
const envSchema = z
    .object({
        NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
        API_BIND_HOST: z.string().min(1).default("127.0.0.1"),
        PORT: tcpPortSchema.default(3000),
        LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
        FRONTEND_ORIGIN: frontendOriginSchema,
        FRONTEND_ALLOWED_ORIGINS: frontendAllowedOriginsSchema.optional(),
        COOKIE_SECRET: z.string().min(MIN_RUNTIME_SECRET_LENGTH),
        AUDIT_HASH_SECRET: z.string().min(MIN_RUNTIME_SECRET_LENGTH),
        AUTH_TOKEN_HASH_SECRET: z.string().min(MIN_RUNTIME_SECRET_LENGTH),
        OPENAPI_ENABLED: booleanEnvSchema("false"),
        TRUSTED_PROXY_IPS: z
            .string()
            .optional()
            .superRefine((value, context) => {
                if (value) {
                    validateTrustedProxyEntries(value, context);
                }
            }),
        LOCAL_RESET_RATE_LIMIT_EMAIL_MAX: positiveIntegerSchema.default(5),
        LOCAL_RESET_RATE_LIMIT_IP_MAX: positiveIntegerSchema.default(30),
        LOCAL_RESET_RATE_LIMIT_WINDOW_MS: positiveIntegerSchema.default(60_000),
        LOCAL_RESET_RATE_LIMIT_CACHE: positiveIntegerSchema.default(5_000),
        LOCAL_COMPLETE_RESET_RATE_LIMIT_TOKEN_MAX: positiveIntegerSchema.default(5),
        LOCAL_COMPLETE_RESET_RATE_LIMIT_IP_MAX: positiveIntegerSchema.default(30),
        LOCAL_COMPLETE_RESET_RATE_LIMIT_WINDOW_MS: positiveIntegerSchema.default(60_000),
        LOCAL_COMPLETE_RESET_RATE_LIMIT_CACHE: positiveIntegerSchema.default(5_000),
        LOCAL_LOGIN_RATE_LIMIT_EMAIL_MAX: positiveIntegerSchema.default(5),
        LOCAL_LOGIN_RATE_LIMIT_IP_MAX: positiveIntegerSchema.default(30),
        LOCAL_LOGIN_RATE_LIMIT_WINDOW_MS: positiveIntegerSchema.default(60_000),
        LOCAL_LOGIN_RATE_LIMIT_CACHE: positiveIntegerSchema.default(5_000),
        MICROSOFT_START_RATE_LIMIT_IP_MAX: positiveIntegerSchema.default(30),
        MICROSOFT_START_RATE_LIMIT_WINDOW_MS: positiveIntegerSchema.default(60_000),
        MICROSOFT_START_RATE_LIMIT_CACHE: positiveIntegerSchema.default(5_000),
        REFRESH_RATE_LIMIT_TOKEN_MAX: positiveIntegerSchema.default(3),
        REFRESH_RATE_LIMIT_IP_MAX: positiveIntegerSchema.default(60),
        REFRESH_RATE_LIMIT_WINDOW_MS: positiveIntegerSchema.default(60_000),
        REFRESH_RATE_LIMIT_CACHE: positiveIntegerSchema.default(5_000),
        DB_HOST: z.string().min(1),
        DB_PORT: tcpPortSchema.default(3306),
        DB_USER: z.string().min(1),
        DB_PASSWORD: z.string().default(""),
        DB_NAME: z.literal(APPROVED_DATABASE_NAME),
        DB_SSL: booleanEnvSchema("false"),
        DB_SSL_CA: z.string().min(1).optional(),
        MICROSOFT_TENANT_ID: z.string().optional(),
        MICROSOFT_CLIENT_ID: z.string().optional(),
        MICROSOFT_CLIENT_SECRET: z.string().optional(),
        MICROSOFT_REDIRECT_URI: z.string().optional(),
        MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY: microsoftCacheEncryptionKeySchema,
        MICROSOFT_SCOPES: z.string().default("openid profile email offline_access User.Read"),
    })
    .superRefine((config, context) => {
        if (config.AUDIT_HASH_SECRET === config.COOKIE_SECRET) {
            context.addIssue({
                code: "custom",
                message: "AUDIT_HASH_SECRET debe ser distinto de COOKIE_SECRET.",
                path: ["AUDIT_HASH_SECRET"],
            });
        }

        if (config.AUTH_TOKEN_HASH_SECRET === config.COOKIE_SECRET || config.AUTH_TOKEN_HASH_SECRET === config.AUDIT_HASH_SECRET) {
            context.addIssue({
                code: "custom",
                message: "AUTH_TOKEN_HASH_SECRET debe ser distinto de COOKIE_SECRET y AUDIT_HASH_SECRET.",
                path: ["AUTH_TOKEN_HASH_SECRET"],
            });
        }

        addMicrosoftOidcIssues(config, context);
        addDatabaseTlsIssues(config, context);
    });

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Traduce TRUSTED_PROXY_IPS validado por Zod al formato que Fastify espera.
 */
export const parseTrustedProxyIps = (value: string | undefined): string[] | false => {
    if (!value) {
        return false;
    }

    const entries = splitTrustedProxyEntries(value);
    const validationError = readTrustedProxyValidationError(entries);

    if (validationError) {
        throw new Error(validationError);
    }

    return entries.length > 0 ? entries : false;
};

/**
 * Valida `process.env` para Nest ConfigModule.
 *
 * El error detiene el bootstrap a proposito. Ejecutar identidad sin cookies,
 * base o CORS configurados seria menos seguro que fallar rapido con un mensaje
 * claro de configuracion.
 */
export const validateEnv = (config: Record<string, unknown>): EnvConfig => {
    const result = envSchema.safeParse(config);

    if (!result.success) {
        throw new Error(`Configuracion de entorno invalida: ${result.error.message}`);
    }

    return result.data;
};
