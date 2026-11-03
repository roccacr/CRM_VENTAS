import { describe, expect, it } from "vitest";

import { parseTrustedProxyIps, validateEnv } from "../../src/config/env.validation.js";
import { APPROVED_DATABASE_NAME } from "../../src/config/product.constants.js";

/**
 * Configuracion minima valida para probar la frontera Zod sin levantar Nest.
 */
const createValidEnv = (): Record<string, unknown> => ({
    AUDIT_HASH_SECRET: "audit-hash-secret-for-tests-32-chars",
    AUTH_TOKEN_HASH_SECRET: "auth-token-hash-secret-for-tests-32",
    COOKIE_SECRET: "cookie-secret-for-tests-32-chars",
    DB_HOST: "127.0.0.1",
    DB_NAME: APPROVED_DATABASE_NAME,
    DB_USER: "test",
    FRONTEND_ORIGIN: "http://localhost:5173",
});

describe("validateEnv", () => {
    it("defaults authenticated reads to initial per-process quotas", () => {
        expect(validateEnv(createValidEnv())).toMatchObject({ AUTH_READ_USER_MAX: 120, AUTH_READ_IP_MAX: 600, AUTH_READ_WINDOW_MS: 60_000, AUTH_READ_CACHE: 5_000 });
    });

    it.each(["AUTH_READ_USER_MAX", "AUTH_READ_IP_MAX", "AUTH_READ_WINDOW_MS", "AUTH_READ_CACHE"])("requires a positive integer for %s", (key) => {
        for (const value of ["0", "-1", "1.5", "invalid"]) {
            expect(() => validateEnv({ ...createValidEnv(), [key]: value })).toThrow(key);
        }
        expect(validateEnv({ ...createValidEnv(), [key]: "2" })).toHaveProperty(key, 2);
    });

    it("falla rapido si falta AUDIT_HASH_SECRET", () => {
        const env = createValidEnv();
        delete env.AUDIT_HASH_SECRET;

        expect(() => validateEnv(env)).toThrow("AUDIT_HASH_SECRET");
    });

    it("mantiene OpenAPI apagado por defecto hasta decision explicita", () => {
        expect(validateEnv(createValidEnv()).OPENAPI_ENABLED).toBe(false);
    });

    it("exige que DB_NAME sea la base canonica aprobada", () => {
        const env = createValidEnv();
        env.DB_NAME = "crmdatabase-api";

        expect(() => validateEnv(env)).toThrow(APPROVED_DATABASE_NAME);
    });

    it("rechaza DB_SSL_CA cuando DB_SSL esta apagado", () => {
        const env = createValidEnv();
        env.DB_SSL = "false";
        env.DB_SSL_CA = "C:\\certs\\global-bundle.pem";

        expect(() => validateEnv(env)).toThrow("DB_SSL_CA");
    });

    it("exige DB_SSL=true cuando DB_HOST no es local", () => {
        const env = createValidEnv();
        env.DB_HOST = "db-crms.cfxfgwugknzb.us-east-2.rds.amazonaws.com";
        env.DB_SSL = "false";

        expect(() => validateEnv(env)).toThrow("DB_SSL");
    });

    it("acepta host remoto cuando DB_SSL esta activo", () => {
        const env = createValidEnv();
        env.DB_HOST = "db-crms.cfxfgwugknzb.us-east-2.rds.amazonaws.com";
        env.DB_SSL = "true";

        expect(validateEnv(env).DB_SSL).toBe(true);
    });

    it("exige que AUDIT_HASH_SECRET sea distinto de COOKIE_SECRET", () => {
        const env = createValidEnv();
        env.AUDIT_HASH_SECRET = env.COOKIE_SECRET;

        expect(() => validateEnv(env)).toThrow("AUDIT_HASH_SECRET");
    });

    it("exige que AUTH_TOKEN_HASH_SECRET sea distinto de los demas secretos", () => {
        const env = createValidEnv();
        env.AUTH_TOKEN_HASH_SECRET = env.COOKIE_SECRET;

        expect(() => validateEnv(env)).toThrow("AUTH_TOKEN_HASH_SECRET");
    });

    it("exige que FRONTEND_ORIGIN sea un origin puro", () => {
        const env = createValidEnv();
        env.FRONTEND_ORIGIN = "http://localhost:5173/app";

        expect(() => validateEnv(env)).toThrow("FRONTEND_ORIGIN");
    });

    it("acepta una allowlist exacta adicional de frontends locales", () => {
        const env = createValidEnv();
        env.FRONTEND_ALLOWED_ORIGINS = "http://localhost:5173,http://192.168.100.8:5173";

        expect(validateEnv(env).FRONTEND_ALLOWED_ORIGINS).toBe(env.FRONTEND_ALLOWED_ORIGINS);
    });

    it("rechaza FRONTEND_ALLOWED_ORIGINS con rutas o queries", () => {
        const env = createValidEnv();
        env.FRONTEND_ALLOWED_ORIGINS = "http://192.168.100.8:5173/auth/login";

        expect(() => validateEnv(env)).toThrow("FRONTEND_ALLOWED_ORIGINS");
    });

    it("rechaza proxies confiables que equivalen a confiar en todo el trafico", () => {
        const env = createValidEnv();
        env.TRUSTED_PROXY_IPS = "0.0.0.0/0";

        expect(() => validateEnv(env)).toThrow("TRUSTED_PROXY_IPS");
        expect(() => parseTrustedProxyIps("0.0.0.0/0")).toThrow("TRUSTED_PROXY_IPS");
    });

    it("rechaza proxies confiables que no sean IPs reales", () => {
        const env = createValidEnv();
        env.TRUSTED_PROXY_IPS = "cafe,1.2";

        expect(() => validateEnv(env)).toThrow("TRUSTED_PROXY_IPS");
    });

    it("rechaza prefijos CIDR incompatibles con IPv4", () => {
        const env = createValidEnv();
        env.TRUSTED_PROXY_IPS = "192.168.1.1/33";

        expect(() => validateEnv(env)).toThrow("TRUSTED_PROXY_IPS");
    });

    it("rechaza rangos de proxy demasiado amplios aunque se dividan en dos mitades", () => {
        const env = createValidEnv();
        env.TRUSTED_PROXY_IPS = "0.0.0.0/1,128.0.0.0/1";

        expect(() => validateEnv(env)).toThrow("TRUSTED_PROXY_IPS");
    });

    it("rechaza rangos IPv4-mapped que equivalen a confiar todo IPv4", () => {
        const env = createValidEnv();
        env.TRUSTED_PROXY_IPS = "::ffff:0:0/96";

        expect(() => validateEnv(env)).toThrow("TRUSTED_PROXY_IPS");
    });

    it("rechaza rangos IPv4-mapped escritos en notacion no comprimida", () => {
        const env = createValidEnv();
        env.TRUSTED_PROXY_IPS = "0:0:0:0:0:ffff:0:0/96,::0:ffff:0:0/96";

        expect(() => validateEnv(env)).toThrow("TRUSTED_PROXY_IPS");
    });

    it("rechaza rangos IPv4-mapped demasiado amplios", () => {
        const env = createValidEnv();
        env.TRUSTED_PROXY_IPS = "::ffff:0.0.0.0/100";

        expect(() => validateEnv(env)).toThrow("TRUSTED_PROXY_IPS");
    });

    it("rechaza rangos amplios IPv4 e IPv6 que no sean casos trust-all literales", () => {
        const env = createValidEnv();
        env.TRUSTED_PROXY_IPS = "10.0.0.0/7,2001::/31";

        expect(() => validateEnv(env)).toThrow("TRUSTED_PROXY_IPS");
    });

    it("acepta IPs concretas y CIDRs internos razonables", () => {
        const env = createValidEnv();
        const trustedProxyIps = "127.0.0.1,10.10.0.0/16,0:0:0:0:0:ffff:a00:0/104,2001:db8::1,2001:db8::/64";
        env.TRUSTED_PROXY_IPS = trustedProxyIps;

        expect(validateEnv(env).TRUSTED_PROXY_IPS).toBe(trustedProxyIps);
        expect(parseTrustedProxyIps(trustedProxyIps)).toEqual(["127.0.0.1", "10.10.0.0/16", "0:0:0:0:0:ffff:a00:0/104", "2001:db8::1", "2001:db8::/64"]);
    });

    it("separa limites por IP y por correo para endpoints locales", () => {
        const config = validateEnv(createValidEnv());

        expect(config.LOCAL_LOGIN_RATE_LIMIT_EMAIL_MAX).toBe(5);
        expect(config.LOCAL_LOGIN_RATE_LIMIT_IP_MAX).toBe(30);
        expect(config.MICROSOFT_START_RATE_LIMIT_IP_MAX).toBe(30);
        expect(config.LOCAL_RESET_RATE_LIMIT_EMAIL_MAX).toBe(5);
        expect(config.LOCAL_RESET_RATE_LIMIT_IP_MAX).toBe(30);
    });

    it("exige clave de cifrado MSAL cuando Microsoft esta configurado", () => {
        const env = createValidEnv();
        env.MICROSOFT_TENANT_ID = "tenant";
        env.MICROSOFT_CLIENT_ID = "client";
        env.MICROSOFT_CLIENT_SECRET = "secret";
        env.MICROSOFT_REDIRECT_URI = "http://localhost:3000/identity/microsoft/callback";

        expect(() => validateEnv(env)).toThrow("MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY");
    });

    it("acepta Microsoft solo con llave MSAL base64 de 32 bytes", () => {
        const env = createValidEnv();
        env.MICROSOFT_TENANT_ID = "tenant";
        env.MICROSOFT_CLIENT_ID = "client";
        env.MICROSOFT_CLIENT_SECRET = "secret";
        env.MICROSOFT_REDIRECT_URI = "http://localhost:3000/identity/microsoft/callback";
        env.MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");

        expect(validateEnv(env).MICROSOFT_MSAL_CACHE_ENCRYPTION_KEY).toBe(Buffer.alloc(32, 1).toString("base64"));
    });
});

it("preserves optional NetSuite server credentials for ConfigModule without enabling an unsigned client", () => {
    const settings = { NETSUITE_CONSUMER_KEY: "test-consumer", NETSUITE_CONSUMER_SECRET: "test-secret", NETSUITE_TOKEN_ID: "test-token", NETSUITE_TOKEN_SECRET: "test-token-secret", NETSUITE_REALM: "4552704", OAUTH_NETSUITE_SIGNATURE: "HMAC-SHA256" };
    expect(validateEnv({ ...createValidEnv(), ...settings })).toMatchObject(settings);
});

describe("notes realtime configuration", () => {
    it("defaults to authorized single-process transport and supports rollback", () => {
        expect(validateEnv(createValidEnv())).toMatchObject({ NOTES_REALTIME_ENABLED: true, NOTES_REALTIME_TOPOLOGY: "single" });
        expect(validateEnv({ ...createValidEnv(), NOTES_REALTIME_ENABLED: "false" }).NOTES_REALTIME_ENABLED).toBe(false);
    });
    it("fails closed for multi-instance topology without private authenticated TLS Redis", () => {
        for (const url of [undefined, "redis://127.0.0.1:6379", "rediss://redis.example:6379", "https://user:pass@redis.example"]) {
            expect(() => validateEnv({ ...createValidEnv(), NOTES_REALTIME_TOPOLOGY: "redis-streams", NOTES_REALTIME_REDIS_URL: url })).toThrow("NOTES_REALTIME_REDIS_URL");
        }
        expect(validateEnv({ ...createValidEnv(), NOTES_REALTIME_TOPOLOGY: "redis-streams", NOTES_REALTIME_REDIS_URL: "rediss://notes:synthetic@redis.internal:6379" }).NOTES_REALTIME_TOPOLOGY).toBe("redis-streams");
    });
});

it("defaults NetSuite to production and rejects unknown environments", () => {
    expect(validateEnv(createValidEnv()).NETSUITE_ENVIRONMENT).toBe("production");
    expect(() => validateEnv({ ...createValidEnv(), NETSUITE_ENVIRONMENT: "invalid" })).toThrow();
});
it("requires complete sandbox configuration at bootstrap without production fallback", () => {
    expect(() => validateEnv({ ...createValidEnv(), NETSUITE_ENVIRONMENT: "sandbox", NETSUITE_REALM: "4552704", NETSUITE_CONSUMER_KEY: "production" })).toThrow();
});

const sandboxEnv = {
    NETSUITE_ENVIRONMENT: "sandbox",
    NETSUITE_SANDBOX_CONSUMER_KEY: "sandbox-consumer",
    NETSUITE_SANDBOX_CONSUMER_SECRET: "sandbox-secret",
    NETSUITE_SANDBOX_TOKEN_ID: "sandbox-token",
    NETSUITE_SANDBOX_TOKEN_SECRET: "sandbox-token-secret",
    NETSUITE_SANDBOX_REALM: "4552704_SB1",
    NETSUITE_SANDBOX_RESTLET_URL: "https://4552704-sb1.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=9999&deploy=1",
};
it("accepts explicit sandbox deployment and retains its server configuration", () => {
    expect(validateEnv({ ...createValidEnv(), ...sandboxEnv })).toMatchObject(sandboxEnv);
});
it.each(Object.keys(sandboxEnv).filter((key) => key !== "NETSUITE_ENVIRONMENT"))("rejects missing or blank sandbox %s at bootstrap", (key) => {
    for (const value of [undefined, "", "   "]) expect(() => validateEnv({ ...createValidEnv(), ...sandboxEnv, [key]: value })).toThrow(key);
});
it.each(["https://4552704.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=9999&deploy=1", sandboxEnv.NETSUITE_SANDBOX_RESTLET_URL + "&deploy=2", sandboxEnv.NETSUITE_SANDBOX_RESTLET_URL + "&redirect=https://example.com", sandboxEnv.NETSUITE_SANDBOX_RESTLET_URL + "#", sandboxEnv.NETSUITE_SANDBOX_RESTLET_URL + "\n", sandboxEnv.NETSUITE_SANDBOX_RESTLET_URL.replace("&deploy=1", ""), sandboxEnv.NETSUITE_SANDBOX_RESTLET_URL.replace("9999", "0")])(
    "rejects incompatible sandbox deployment at bootstrap: %j",
    (url) => {
        expect(() => validateEnv({ ...createValidEnv(), ...sandboxEnv, NETSUITE_SANDBOX_RESTLET_URL: url })).toThrow("NETSUITE_SANDBOX_RESTLET_URL");
    },
);
it("rejects a production realm in sandbox without exposing configured secrets", () => {
    try {
        validateEnv({ ...createValidEnv(), ...sandboxEnv, NETSUITE_SANDBOX_REALM: "4552704" });
        expect.fail("expected invalid realm");
    } catch (error) {
        expect(String(error)).toContain("NETSUITE_SANDBOX_REALM");
        expect(String(error)).not.toContain("sandbox-secret");
    }
});

it("keeps local NetSuite reception off by default", () => {
    expect(validateEnv(createValidEnv()).NETSUITE_LOCAL_EVENTS_ENABLED).toBe(false);
});
it.each([{ NODE_ENV: "production", NETSUITE_LOCAL_EVENTS_SECRET: "a".repeat(64) }, {}, { NETSUITE_LOCAL_EVENTS_SECRET: "short" }, { COOKIE_SECRET: "a".repeat(64), NETSUITE_LOCAL_EVENTS_SECRET: "a".repeat(64) }])("rejects unsafe enabled local reception", (config) => {
    expect(() => validateEnv({ ...createValidEnv(), ...config, NETSUITE_LOCAL_EVENTS_ENABLED: "true" })).toThrow();
});
it("accepts an exclusive local secret in development", () => {
    expect(validateEnv({ ...createValidEnv(), NODE_ENV: "development", NETSUITE_LOCAL_EVENTS_ENABLED: "true", NETSUITE_LOCAL_EVENTS_SECRET: "a".repeat(64) }).NETSUITE_LOCAL_EVENTS_ENABLED).toBe(true);
});

it("rejects persistence without explicitly enabling the Sandbox receiver", () => {
    expect(() => validateEnv({ ...createValidEnv(), NETSUITE_LOCAL_EVENTS_PERSIST: "true" })).toThrow("Persistencia requiere");
});
