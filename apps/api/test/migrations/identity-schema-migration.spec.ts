import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readTargetTableNames, splitSqlStatements, stripDatabaseSelection, stripLineComments } from "../../migrations/schema-only/202609250001_identity_schema.js";
import { readSchemaMigrationEnv, schemaMigrations } from "../../scripts/run-schema-migrations.js";
import { APPROVED_DATABASE_NAME } from "../../src/config/product.constants.js";

const identitySchemaPath = fileURLToPath(new URL("../../Arquitectura/SQL/001_identity_schema_p0_s1.sql", import.meta.url));
const loginReadinessSchemaPath = fileURLToPath(new URL("../../Arquitectura/SQL/003_identity_login_readiness_p0_s1.sql", import.meta.url));
const microsoftSessionSchemaPath = fileURLToPath(new URL("../../Arquitectura/SQL/004_identity_microsoft_session_p0_s1.sql", import.meta.url));

/**
 * Entorno minimo para probar la validacion del runner sin abrir MySQL.
 */
const createValidMigrationEnv = (): NodeJS.ProcessEnv => ({
    DB_HOST: "127.0.0.1",
    DB_NAME: APPROVED_DATABASE_NAME,
    DB_USER: "crm_migration",
    MIGRATION_CONFIRM_SCHEMA_ONLY: APPROVED_DATABASE_NAME,
});

describe("identity schema migration parser", () => {
    it("divide sentencias sin cortar punto y coma dentro de literales SQL", () => {
        const statements = splitSqlStatements(`
            CREATE TABLE IF NOT EXISTS audit_security_event (
                summary_security_event VARCHAR(250) COMMENT 'Texto con ; dentro'
            );
            CREATE TABLE IF NOT EXISTS sec_user (
                email_user VARCHAR(250)
            );
        `);

        expect(statements).toHaveLength(2);
        expect(statements[0]).toContain("Texto con ; dentro");
        expect(statements[1]).toContain("sec_user");
    });

    it("extrae un nombre de tabla por cada CREATE TABLE aprobado", () => {
        expect(readTargetTableNames(["CREATE TABLE IF NOT EXISTS audit_security_event (id_security_event BIGINT)", "CREATE TABLE IF NOT EXISTS `sec_user` (id_user BIGINT)"])).toEqual(["audit_security_event", "sec_user"]);
    });

    it("falla si una sentencia CREATE TABLE no permite extraer el nombre objetivo", () => {
        expect(() => readTargetTableNames(["CREATE TABLE IF NOT EXISTS CRM_THINK_V2.sec_user (id_user BIGINT)"])).toThrow("nombre de tabla");
    });

    it("extrae exactamente las 15 tablas del artefacto SQL aprobado", async () => {
        const sqlSource = await readFile(identitySchemaPath, "utf8");
        const statements = splitSqlStatements(stripLineComments(stripDatabaseSelection(sqlSource)));

        expect(readTargetTableNames(statements)).toEqual(["sec_user", "sec_auth_identity", "sec_auth_session", "sec_refresh_token", "sec_local_password_reset_token", "sec_role", "sec_permission", "sec_user_role", "sec_role_permission", "sec_org_unit", "sec_user_org_unit", "sec_user_permission_override", "int_external_system", "int_user_external_identity", "audit_security_event"]);
    });

    it("registra la migracion 003 de login readiness en el runner schema-only", () => {
        expect(schemaMigrations.map((migration) => migration.name)).toEqual(["202609250001_identity_schema", "202609250003_identity_login_readiness", "202609280004_identity_microsoft_session"]);
    });

    it("documenta un unico token de reset activo por identidad en los artefactos SQL", async () => {
        const initialSchema = await readFile(identitySchemaPath, "utf8");
        const loginReadinessSchema = await readFile(loginReadinessSchemaPath, "utf8");

        for (const sqlSource of [initialSchema, loginReadinessSchema]) {
            expect(sqlSource).toContain("active_key_local_password_reset_token");
            expect(sqlSource).toContain("UNIQUE KEY uq_sec_local_password_reset_active (auth_identity_id_local_password_reset_token, active_key_local_password_reset_token)");
        }
    });

    it("documenta cache MSAL cifrada y foto de usuario en SQL/004", async () => {
        const microsoftSessionSchema = await readFile(microsoftSessionSchemaPath, "utf8");

        expect(microsoftSessionSchema).toContain("sec_microsoft_account");
        expect(microsoftSessionSchema).toContain("cache_ciphertext_microsoft_account");
        expect(microsoftSessionSchema).not.toContain("access_token");
        expect(microsoftSessionSchema).not.toContain("refresh_token");
        expect(microsoftSessionSchema).toContain("sec_user_profile_image");
        expect(microsoftSessionSchema).toContain("provider_code_auth_session");
    });

    it("rechaza DB_SSL con casing distinto para no apagar TLS silenciosamente", () => {
        expect(() =>
            readSchemaMigrationEnv({
                ...createValidMigrationEnv(),
                DB_HOST: "db-crms.cfxfgwugknzb.us-east-2.rds.amazonaws.com",
                DB_SSL: "TRUE",
            }),
        ).toThrow("DB_SSL");
    });

    it("exige la doble confirmacion de base antes de migrar", () => {
        expect(() =>
            readSchemaMigrationEnv({
                ...createValidMigrationEnv(),
                MIGRATION_CONFIRM_SCHEMA_ONLY: "crmdatabase-api",
            }),
        ).toThrow("MIGRATION_CONFIRM_SCHEMA_ONLY");
    });

    it("rechaza DB_SSL_CA cuando DB_SSL esta apagado", () => {
        expect(() =>
            readSchemaMigrationEnv({
                ...createValidMigrationEnv(),
                DB_SSL: "false",
                DB_SSL_CA: "C:\\certs\\global-bundle.pem",
            }),
        ).toThrow("DB_SSL_CA");
    });

    it("exige TLS cuando el runner apunta a un host remoto", () => {
        expect(() =>
            readSchemaMigrationEnv({
                ...createValidMigrationEnv(),
                DB_HOST: "db-crms.cfxfgwugknzb.us-east-2.rds.amazonaws.com",
                DB_SSL: "false",
            }),
        ).toThrow("DB_SSL");
    });
});
