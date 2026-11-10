import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildMysqlPoolOptions } from "../../src/database/mysql-pool-options.js";

const BASE_POOL_INPUT = {
    connectionLimit: 1,
    database: "CRM_THINK_V2",
    host: "db.example.rds.amazonaws.com",
    password: "test-password",
    port: 3306,
    user: "crm_runtime",
} as const;

let temporaryDirectory: string | null = null;

/**
 * Crea un archivo CA temporal para probar la configuracion TLS sin depender de
 * certificados reales ni de red. El contenido no se usa para hacer handshake;
 * solo verifica que el pool cargue exactamente el bundle configurado.
 */
const createTemporaryCaFile = (content: string): string => {
    temporaryDirectory = mkdtempSync(join(tmpdir(), "crm-think-ca-"));
    const caPath = join(temporaryDirectory, "rds-ca.pem");
    writeFileSync(caPath, content, "utf8");
    return caPath;
};

describe("buildMysqlPoolOptions", () => {
    afterEach(() => {
        if (temporaryDirectory) {
            rmSync(temporaryDirectory, { force: true, recursive: true });
            temporaryDirectory = null;
        }
    });

    it("mantiene TLS con verificacion estricta cuando DB_SSL esta activo", () => {
        const options = buildMysqlPoolOptions({
            ...BASE_POOL_INPUT,
            ssl: true,
        });

        expect(options.ssl).toEqual({ rejectUnauthorized: true });
        expect(options.multipleStatements).toBe(false);
    });

    it("aplica queueLimit solo cuando se define y no lo fija por defecto", () => {
        expect(buildMysqlPoolOptions({ ...BASE_POOL_INPUT, ssl: false }).queueLimit).toBeUndefined();
        expect(buildMysqlPoolOptions({ ...BASE_POOL_INPUT, ssl: false, queueLimit: 200 }).queueLimit).toBe(200);
    });

    it("no agrega configuracion ssl cuando DB_SSL esta apagado", () => {
        const options = buildMysqlPoolOptions({
            ...BASE_POOL_INPUT,
            ssl: false,
        });

        expect(options.ssl).toBeUndefined();
        expect(options.multipleStatements).toBe(false);
    });

    it("carga el CA bundle configurado sin desactivar rejectUnauthorized", () => {
        const caContent = "-----BEGIN CERTIFICATE-----\nca-test\n-----END CERTIFICATE-----\n";
        const sslCaPath = createTemporaryCaFile(caContent);
        const options = buildMysqlPoolOptions({
            ...BASE_POOL_INPUT,
            ssl: true,
            sslCaPath,
        });

        expect(options.ssl).toEqual({
            ca: caContent,
            rejectUnauthorized: true,
        });
    });

    it("falla rapido si el CA bundle configurado no existe", () => {
        temporaryDirectory = mkdtempSync(join(tmpdir(), "crm-think-ca-"));
        const sslCaPath = join(temporaryDirectory, "missing.pem");
        expect(() => buildMysqlPoolOptions({ ...BASE_POOL_INPUT, ssl: true, sslCaPath })).toThrow(expect.objectContaining({ code: "ENOENT", path: sslCaPath }));
    });
});
