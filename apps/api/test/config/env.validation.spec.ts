import { describe, expect, it } from "vitest";

import { parseTrustedProxyIps, validateEnv } from "../../src/config/env.validation.js";
import { APPROVED_DATABASE_NAME } from "../../src/config/product.constants.js";

/**
 * Configuracion minima valida para probar la frontera Zod sin levantar Nest.
 */
const createValidEnv = (): Record<string, unknown> => ({
    AUDIT_HASH_SECRET: "audit-hash-secret-for-tests-32-chars",
    COOKIE_SECRET: "cookie-secret-for-tests-32-chars",
    DB_HOST: "127.0.0.1",
    DB_NAME: APPROVED_DATABASE_NAME,
    DB_USER: "test",
    FRONTEND_ORIGIN: "http://localhost:5173",
});

describe("validateEnv", () => {
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

    it("exige que FRONTEND_ORIGIN sea un origin puro", () => {
        const env = createValidEnv();
        env.FRONTEND_ORIGIN = "http://localhost:5173/app";

        expect(() => validateEnv(env)).toThrow("FRONTEND_ORIGIN");
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
        expect(config.LOCAL_RESET_RATE_LIMIT_EMAIL_MAX).toBe(5);
        expect(config.LOCAL_RESET_RATE_LIMIT_IP_MAX).toBe(30);
    });
});
