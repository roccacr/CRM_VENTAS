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

/**
 * Entero positivo para limites operativos configurables.
 */
const positiveIntegerSchema = z.coerce.number().int().positive();

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
        FRONTEND_ORIGIN: frontendOriginSchema,
        COOKIE_SECRET: z.string().min(MIN_RUNTIME_SECRET_LENGTH),
        AUDIT_HASH_SECRET: z.string().min(MIN_RUNTIME_SECRET_LENGTH),
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
        LOCAL_LOGIN_RATE_LIMIT_EMAIL_MAX: positiveIntegerSchema.default(5),
        LOCAL_LOGIN_RATE_LIMIT_IP_MAX: positiveIntegerSchema.default(30),
        LOCAL_LOGIN_RATE_LIMIT_WINDOW_MS: positiveIntegerSchema.default(60_000),
        LOCAL_LOGIN_RATE_LIMIT_CACHE: positiveIntegerSchema.default(5_000),
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
    })
    .superRefine((config, context) => {
        if (config.AUDIT_HASH_SECRET === config.COOKIE_SECRET) {
            context.addIssue({
                code: "custom",
                message: "AUDIT_HASH_SECRET debe ser distinto de COOKIE_SECRET.",
                path: ["AUDIT_HASH_SECRET"],
            });
        }

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
