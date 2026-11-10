import { BlockList, isIP } from "node:net";

import { z } from "zod";

import { addDatabaseTlsIssues, booleanEnvSchema, tcpPortSchema } from "./database-env.schema.js";
import { isNetsuiteRestletUrl, resolveNetsuiteEnvironment } from "./netsuite-environment.js";
import { APPROVED_DATABASE_NAME } from "./product.constants.js";

/**
 * Frontera de configuracion del runtime. Lo que es secreto, origen o nombre de
 * base falla aqui, durante el arranque, no en el primer request.
 *
 * No hay default para `COOKIE_SECRET`, los HMAC, `FRONTEND_ORIGIN` ni `DB_NAME`.
 * Los defaults que si existen son de cierre: escuchar en loopback, compuertas
 * en falso, cupos positivos y `NODE_ENV=development`. Un proceso sin `NODE_ENV`
 * no queda en produccion y por eso tampoco enciende el receptor de produccion.
 */

/** Atajo del RESTlet de sandbox. La regla completa vive en `isNetsuiteRestletUrl`: cuenta fija, sin credenciales y sin query extra. */
export function isNetsuiteSandboxRestletUrl(value: unknown): value is string {
    return isNetsuiteRestletUrl(value, "sandbox");
}

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

/** Campos que tienen que venir juntos para encender Microsoft. Un subconjunto no es una configuracion a medias aceptable. */
type MicrosoftOidcConfig = {
    ENABLE_ORDER_DOCUMENTS?: boolean | undefined;
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
 * Cupo operativo. Tiene que ser un entero mayor que cero: un `0` o un negativo
 * apagaria el limitador en lugar de configurarlo.
 */
const positiveIntegerSchema = z.coerce.number().int().positive();

/**
 * Llave AES-256 del cache MSAL, opcional hasta que Microsoft se encienda.
 *
 * El blob puede contener el refresh token aunque la aplicacion no lo lea. Por
 * eso la llave tiene que ser base64 de exactamente 32 bytes. Se vuelve a
 * codificar y se compara con el texto original: un padding distinto o caracteres
 * ignorados por el decoder no pasan como la misma llave. Que sea distinta de
 * los secretos BFF se exige mas abajo.
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
 * Microsoft entra completo o no entra. Basta una pieza, o
 * `ENABLE_ORDER_DOCUMENTS`, para exigir tenant, cliente, secreto, redirect y
 * la llave del cache: los documentos usan la misma app registration.
 */
const addMicrosoftOidcIssues = (config: MicrosoftOidcConfig, context: z.RefinementCtx): void => {
    const microsoftValues = [config.MICROSOFT_TENANT_ID, config.MICROSOFT_CLIENT_ID, config.MICROSOFT_CLIENT_SECRET, config.MICROSOFT_REDIRECT_URI];

    if (microsoftValues.some(Boolean) || config.ENABLE_ORDER_DOCUMENTS === true) {
        addMissingMicrosoftConfigIssues(config, context);
    }

    addMicrosoftSecretSeparationIssue(config, context);
};

/** Cada clave ausente es un error propio. El arranque no elige un valor por la que falte. */
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
 * La llave del cache no puede ser `COOKIE_SECRET` ni uno de los HMAC. Rotar o
 * filtrar un secreto de sesion no debe descifrar tambien los tokens de Microsoft.
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
 * Origin exacto. `URL.origin` no incluye usuario, path, query ni slash final;
 * si el texto configurado no es identico a eso, CORS y las cookies quedarian
 * atados a una URL distinta de la que el navegador envia.
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
 * Origins extra, separados por coma. Cada uno pasa por la misma regla que
 * `FRONTEND_ORIGIN`. Un valor invalido rechaza la variable entera; un hueco
 * entre comas se ignora. No hay comodin: `*` no es un origin y no se acepta.
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
 * Parte `TRUSTED_PROXY_IPS` una sola vez. Zod y `main.ts` tienen que ver las
 * mismas entradas; recortar en un lado y no en el otro cambiaria de quien se
 * acepta `X-Forwarded-For`.
 */
const splitTrustedProxyEntries = (value: string): string[] =>
    value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);

/**
 * IP sola o IP/prefijo. Mas de una barra, un prefijo que no es decimal o una
 * direccion vacia no son una entrada: se rechazan en vez de interpretarse.
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
 * `::ffff:0:0/96` es todo el espacio IPv4 escrito como IPv6. `proxy-addr` trata
 * un prefijo de 96 o mas sobre esa notacion como un rango IPv4, asi que un /96
 * seria confiar en cualquier cliente. El prefijo se juzga como IPv4, no como IPv6.
 */
const isIpv4MappedAddress = (address: string): boolean => IPV4_MAPPED_SPACE.check(address, "ipv6");

/** Una direccion mapeada suelta es valida. Un prefijo tiene que quedar entre /8 y /32 ya restados los 96 bits del mapeo. */
const hasValidIpv4MappedPrefix = (prefix: number | null): boolean => {
    if (prefix === null) {
        return true;
    }

    const effectiveIpv4Prefix = prefix - IPV4_MAPPED_PREFIX_OFFSET;
    return effectiveIpv4Prefix >= MIN_IPV4_TRUSTED_PROXY_PREFIX && effectiveIpv4Prefix <= MAX_IPV4_CIDR_PREFIX;
};

/**
 * IPv4 no baja de /8 y IPv6 no baja de /32. Una red mas ancha convierte el
 * encabezado reenviado en una identidad que el cliente puede elegir.
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
 * Rechaza `*`, `0.0.0.0/0` y `::/0` antes de mirar el CIDR. El resto tiene que
 * ser una IP concreta o una subred dentro de los prefijos minimos.
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

/** Lista vacia no es un error: significa no confiar en ningun proxy. La primera entrada invalida corta con un solo mensaje. */
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

/** Vuelca el error de proxy al contexto de Zod. La misma funcion la reutiliza el parseo de `main.ts`. */
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
 * Redis de notas en tiempo real. `single` no exige URL. `redis-streams` solo
 * acepta `rediss` con host, usuario y clave, sin query ni fragmento: ahi
 * viajaria otro secreto o una opcion que cambie el destino. Una URL ausente o
 * rota no se interpreta; cae al error de abajo.
 */
const addNotesRealtimeIssues = (config: { NOTES_REALTIME_TOPOLOGY: string; NOTES_REALTIME_REDIS_URL?: string | undefined }, context: z.RefinementCtx): void => {
    if (config.NOTES_REALTIME_TOPOLOGY === "redis-streams") {
        let safeRedis = false;
        try {
            const redis = new URL(config.NOTES_REALTIME_REDIS_URL ?? "");
            safeRedis = [redis.protocol === "rediss:", Boolean(redis.hostname), Boolean(redis.username), Boolean(redis.password), !redis.search, !redis.hash].every(Boolean);
        } catch {
            /* Una URL ausente o invalida queda rechazada abajo. No se sustituye por un Redis local. */
        }
        if (!safeRedis) context.addIssue({ code: "custom", path: ["NOTES_REALTIME_REDIS_URL"], message: "Redis Streams requires an authenticated private TLS endpoint." });
    }
};
/**
 * Sandbox de NetSuite, solo cuando el entorno efectivo es sandbox y hay alguna
 * intencion de usarlo: la variable en `sandbox` o cualquier credencial cargada.
 *
 * Un local sin ninguna de esas piezas puede arrancar; el cliente rechaza la
 * llamada incompleta. Si la intencion existe, faltan consumidor, secreto o
 * token, el realm no es `4552704_SB1` o el RESTlet no es el de esa cuenta, no
 * arranca. Habita no entra aqui: su entorno efectivo es produccion.
 */
const addNetsuiteSandboxIssues = (config: { FRONTEND_ORIGIN: string; NETSUITE_ENVIRONMENT: string; NETSUITE_SANDBOX_CONSUMER_KEY?: string | undefined; NETSUITE_SANDBOX_CONSUMER_SECRET?: string | undefined; NETSUITE_SANDBOX_TOKEN_ID?: string | undefined; NETSUITE_SANDBOX_TOKEN_SECRET?: string | undefined; NETSUITE_SANDBOX_REALM?: string | undefined; NETSUITE_SANDBOX_RESTLET_URL?: string | undefined }, context: z.RefinementCtx): void => {
    const keys = ["NETSUITE_SANDBOX_CONSUMER_KEY", "NETSUITE_SANDBOX_CONSUMER_SECRET", "NETSUITE_SANDBOX_TOKEN_ID", "NETSUITE_SANDBOX_TOKEN_SECRET", "NETSUITE_SANDBOX_REALM", "NETSUITE_SANDBOX_RESTLET_URL"] as const;
    const configured = [config.NETSUITE_ENVIRONMENT === "sandbox", ...keys.map((key) => config[key]?.trim())].some(Boolean);
    if ([resolveNetsuiteEnvironment(config.FRONTEND_ORIGIN, config.NETSUITE_ENVIRONMENT) === "sandbox", configured].every(Boolean)) {
        for (const key of ["NETSUITE_SANDBOX_CONSUMER_KEY", "NETSUITE_SANDBOX_CONSUMER_SECRET", "NETSUITE_SANDBOX_TOKEN_ID", "NETSUITE_SANDBOX_TOKEN_SECRET"] as const) {
            if (!config[key]?.trim()) context.addIssue({ code: "custom", path: [key], message: "Configuracion NetSuite sandbox incompleta." });
        }
        if (config.NETSUITE_SANDBOX_REALM?.trim() !== "4552704_SB1") context.addIssue({ code: "custom", path: ["NETSUITE_SANDBOX_REALM"], message: "Realm NetSuite sandbox incompatible." });
        if (!isNetsuiteSandboxRestletUrl(config.NETSUITE_SANDBOX_RESTLET_URL)) context.addIssue({ code: "custom", path: ["NETSUITE_SANDBOX_RESTLET_URL"], message: "URL NetSuite sandbox incompatible." });
    }
};
/**
 * Receptor de produccion. Persistir exige tenerlo habilitado. Habilitarlo exige
 * `NODE_ENV=production`, el origen de Habita, `NETSUITE_ENVIRONMENT=production`
 * y un secreto propio. Ese secreto no puede repetir los del BFF ni el del
 * receptor local: filtrar uno no abre el otro.
 */
const addNetsuiteProductionEventsIssues = (config: { NETSUITE_PRODUCTION_EVENTS_ENABLED: boolean; NETSUITE_PRODUCTION_EVENTS_PERSIST: boolean; NETSUITE_PRODUCTION_EVENTS_SECRET?: string | undefined; NODE_ENV: string; FRONTEND_ORIGIN: string; NETSUITE_ENVIRONMENT: string; COOKIE_SECRET: string; AUTH_TOKEN_HASH_SECRET: string; AUDIT_HASH_SECRET: string; NETSUITE_LOCAL_EVENTS_SECRET?: string | undefined }, context: z.RefinementCtx): void => {
    if (config.NETSUITE_PRODUCTION_EVENTS_PERSIST && !config.NETSUITE_PRODUCTION_EVENTS_ENABLED) context.addIssue({ code: "custom", path: ["NETSUITE_PRODUCTION_EVENTS_PERSIST"], message: "Persistencia requiere el receptor production habilitado." });
    if (config.NETSUITE_PRODUCTION_EVENTS_ENABLED && ![config.NODE_ENV === "production", config.FRONTEND_ORIGIN === "https://habita.roccacr.com", config.NETSUITE_ENVIRONMENT === "production", Boolean(config.NETSUITE_PRODUCTION_EVENTS_SECRET)].every(Boolean)) context.addIssue({ code: "custom", path: ["NETSUITE_PRODUCTION_EVENTS_ENABLED"], message: "El receptor production requiere Habita, modo production y un secreto exclusivo." });
    if (config.NETSUITE_PRODUCTION_EVENTS_SECRET && [config.COOKIE_SECRET, config.AUTH_TOKEN_HASH_SECRET, config.AUDIT_HASH_SECRET, config.NETSUITE_LOCAL_EVENTS_SECRET].includes(config.NETSUITE_PRODUCTION_EVENTS_SECRET)) context.addIssue({ code: "custom", path: ["NETSUITE_PRODUCTION_EVENTS_SECRET"], message: "El secreto production debe ser exclusivo de la integracion." });
};

/**
 * Receptor local. Persistir exige tenerlo habilitado, y habilitarlo solo vale
 * en `development` con su secreto de 64 hex. El secreto no se reutiliza como
 * cookie ni como HMAC. En produccion esta compuerta no abre.
 */
const addNetsuiteLocalEventsIssues = (config: { NETSUITE_LOCAL_EVENTS_PERSIST: boolean; NETSUITE_LOCAL_EVENTS_ENABLED: boolean; NODE_ENV: string; NETSUITE_LOCAL_EVENTS_SECRET?: string | undefined; COOKIE_SECRET: string; AUTH_TOKEN_HASH_SECRET: string; AUDIT_HASH_SECRET: string }, context: z.RefinementCtx): void => {
    if (config.NETSUITE_LOCAL_EVENTS_PERSIST && !config.NETSUITE_LOCAL_EVENTS_ENABLED) context.addIssue({ code: "custom", path: ["NETSUITE_LOCAL_EVENTS_PERSIST"], message: "Persistencia requiere el receptor Sandbox habilitado." });
    if (config.NETSUITE_LOCAL_EVENTS_ENABLED && (config.NODE_ENV !== "development" || !config.NETSUITE_LOCAL_EVENTS_SECRET)) context.addIssue({ code: "custom", path: ["NETSUITE_LOCAL_EVENTS_ENABLED"], message: "El receptor local requiere development y un secreto exclusivo de 64 caracteres hexadecimales." });
    if (config.NETSUITE_LOCAL_EVENTS_SECRET && [config.COOKIE_SECRET, config.AUTH_TOKEN_HASH_SECRET, config.AUDIT_HASH_SECRET].includes(config.NETSUITE_LOCAL_EVENTS_SECRET)) context.addIssue({ code: "custom", path: ["NETSUITE_LOCAL_EVENTS_SECRET"], message: "El secreto local debe ser exclusivo de la integracion." });
};
const envSchema = z
    .object({
        NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
        // Sin valor, el proceso solo escucha en loopback. Publicar en todas las interfaces tiene que ser explicito.
        API_BIND_HOST: z.string().min(1).default("127.0.0.1"),
        PORT: tcpPortSchema.default(3000),
        LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
        FRONTEND_ORIGIN: frontendOriginSchema,
        FRONTEND_ALLOWED_ORIGINS: frontendAllowedOriginsSchema.optional(),
        NOTES_REALTIME_ENABLED: booleanEnvSchema("true"),
        NOTES_REALTIME_TOPOLOGY: z.enum(["single", "redis-streams"]).default("single"),
        NOTES_REALTIME_REDIS_URL: z.string().optional(),
        COOKIE_SECRET: z.string().min(MIN_RUNTIME_SECRET_LENGTH),
        AUDIT_HASH_SECRET: z.string().min(MIN_RUNTIME_SECRET_LENGTH),
        AUTH_TOKEN_HASH_SECRET: z.string().min(MIN_RUNTIME_SECRET_LENGTH),
        OPENAPI_ENABLED: booleanEnvSchema("false"),
        // Escritura y lectura legacy apagadas salvo opt-in. El nombre, si se da, solo puede ser la base vieja: no sirve para redirigir el runtime.
        ENABLE_LEGACY_FALLBACK: booleanEnvSchema("false"),
        ENABLE_LEGACY_WRITES: booleanEnvSchema("false"),
        ENABLE_RECORD_AUDIT: booleanEnvSchema("false"),
        LEGACY_CRM_DB_NAME: z.preprocess((value) => (value === "" ? undefined : value), z.literal("crmdatabase-api").optional()),
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
        AUTH_READ_USER_MAX: positiveIntegerSchema.default(120),
        AUTH_READ_IP_MAX: positiveIntegerSchema.default(600),
        AUTH_READ_WINDOW_MS: positiveIntegerSchema.default(60_000),
        AUTH_READ_CACHE: positiveIntegerSchema.default(5_000),
        DB_HOST: z.string().min(1),
        DB_PORT: tcpPortSchema.default(3306),
        DB_USER: z.string().min(1),
        // Vacio solo cubre una base local sin clave. No se inventa un secreto.
        DB_PASSWORD: z.string().default(""),
        // Unico nombre aceptado. Otra base, incluida la legacy, no arranca este proceso.
        DB_NAME: z.literal(APPROVED_DATABASE_NAME),
        DB_SSL: booleanEnvSchema("false"),
        DB_SSL_CA: z.string().min(1).optional(),
        // Credenciales del adaptador, solo en el servidor. Un conjunto incompleto no se rellena: el cliente de lectura lo rechaza.
        NETSUITE_ORDER_CANCELLATION_EFFECTS_ENABLED: booleanEnvSchema("false"),
        NETSUITE_PRODUCTION_EVENTS_ENABLED: booleanEnvSchema("false"),
        NETSUITE_PRODUCTION_EVENTS_PERSIST: booleanEnvSchema("false"),
        NETSUITE_PRODUCTION_EVENTS_SECRET: z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .optional(),
        NETSUITE_LOCAL_EVENTS_PERSIST: booleanEnvSchema("false"),
        NETSUITE_LOCAL_EVENTS_ENABLED: booleanEnvSchema("false"),
        NETSUITE_LOCAL_EVENTS_SECRET: z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .optional(),
        NETSUITE_PRODUCTION_READ_MODE: z.enum(["legacy", "modules"]).default("legacy"),
        NETSUITE_PRODUCTION_RESTLET_URL: z
            .string()
            .optional()
            .refine((value) => value === undefined || value === "" || isNetsuiteRestletUrl(value, "production"), "URL NetSuite production incompatible."),
        NETSUITE_ENVIRONMENT: z.enum(["production", "sandbox"]).default("production"),
        NETSUITE_SANDBOX_CONSUMER_KEY: z.string().optional(),
        NETSUITE_SANDBOX_CONSUMER_SECRET: z.string().optional(),
        NETSUITE_SANDBOX_TOKEN_ID: z.string().optional(),
        NETSUITE_SANDBOX_TOKEN_SECRET: z.string().optional(),
        NETSUITE_SANDBOX_REALM: z.string().optional(),
        NETSUITE_SANDBOX_RESTLET_URL: z.string().optional(),
        NETSUITE_CONSUMER_KEY: z.string().optional(),
        NETSUITE_CONSUMER_SECRET: z.string().optional(),
        NETSUITE_TOKEN_ID: z.string().optional(),
        NETSUITE_TOKEN_SECRET: z.string().optional(),
        NETSUITE_REALM: z.string().optional(),
        OAUTH_NETSUITE_SIGNATURE: z.string().optional(),
        MICROSOFT_TENANT_ID: z.string().optional(),
        MICROSOFT_CLIENT_ID: z.string().optional(),
        MICROSOFT_CLIENT_SECRET: z.string().optional(),
        MICROSOFT_REDIRECT_URI: z.string().optional(),
        MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY: microsoftCacheEncryptionKeySchema,
        ENABLE_ORDER_DOCUMENTS: booleanEnvSchema("false"),
        MICROSOFT_DOCUMENTS_GROUP_ID: z.uuid().default("46b0a57a-45ab-4534-8dde-cd4ba39e29b7"),
        MICROSOFT_ORDER_DOCUMENTS_ROOT_ID: z
            .string()
            .regex(/^[A-Za-z0-9!_-]{1,200}$/u)
            .default("01QPXOKIF43B3PZFOW4VFIPCME4QKXURLE"),
        ENABLE_CALENDAR_EXTERNAL: booleanEnvSchema("false"),
        MICROSOFT_SCOPES: z.string().default("openid profile email offline_access User.Read"),
    })
    .superRefine((config, context) => {
        addNetsuiteLocalEventsIssues(config, context);
        addNetsuiteProductionEventsIssues(config, context);
        addNetsuiteSandboxIssues(config, context);
        addNotesRealtimeIssues(config, context);
        // Cookie, auditoria y hash de token son tres secretos. Comprometer uno no debe servir para recomputar los otros.
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

/** Forma ya validada. Una variable no declarada en el schema se descarta y no aparece en este tipo. */
export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Lista que Fastify usa como `trustProxy`. Vacia o ausente devuelve `false`:
 * no se confia en `X-Forwarded-For`. Se vuelve a validar porque `main.ts` puede
 * llamarla con el texto crudo, fuera del `safeParse`.
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
 * Entrada de `ConfigModule`. Un fallo lanza y el proceso no escucha: seguir sin
 * cookie, base o CORS dejaria la identidad a medio configurar.
 */
export const validateEnv = (config: Record<string, unknown>): EnvConfig => {
    const result = envSchema.safeParse(config);

    if (!result.success) {
        throw new Error(`Configuracion de entorno invalida: ${result.error.message}`);
    }

    return result.data;
};
