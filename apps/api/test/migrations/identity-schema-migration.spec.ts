import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { readTargetTableNames, splitSqlStatements, stripDatabaseSelection, stripLineComments } from "../../migrations/schema-only/202609250001_identity_schema.js";
import { readSchemaMigrationEnv, schemaMigrations, selectSchemaMigrations, selectSchemaMigrationsFromArgs } from "../../scripts/run-schema-migrations.js";
import { APPROVED_DATABASE_NAME } from "../../src/config/product.constants.js";
import { CATALOG_DEFINITIONS, CATALOG_PERMISSION_ACTIONS, getCatalogPermissionCodes } from "../../src/modules/crm/catalogs/catalogs.constants.js";

const identitySchemaPath = fileURLToPath(new URL("../../Arquitectura/SQL/001_identity_schema_p0_s1.sql", import.meta.url));
const loginReadinessSchemaPath = fileURLToPath(new URL("../../Arquitectura/SQL/003_identity_login_readiness_p0_s1.sql", import.meta.url));
const microsoftSessionSchemaPath = fileURLToPath(new URL("../../Arquitectura/SQL/004_identity_microsoft_session_p0_s1.sql", import.meta.url));
const userDirectorySchemaPath = fileURLToPath(new URL("../../Arquitectura/SQL/005_identity_user_directory_p0_s1.sql", import.meta.url));

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
    it("keeps registered migrations on the guarded executor without independent connections or plugin bypasses", async () => {
        for (const migration of schemaMigrations) {
            const source = await readFile(new URL(`../../migrations/schema-only/${migration.name}.ts`, import.meta.url), "utf8");
            expect(source, migration.name).not.toMatch(/\b(?:mysql2|LegacyCrmDatabaseService|createLegacyCrmDatabase|withoutPlugins|executeQuery|fetch)\b/);
        }
    });
    it("preserves the explicit default and exact single-migration CLI selection", () => {
        expect(selectSchemaMigrationsFromArgs([])).toEqual(schemaMigrations);
        expect(selectSchemaMigrationsFromArgs(["--only=202610220023_record_audit"]).map((migration) => migration.name)).toEqual(["202610220023_record_audit"]);
        expect(selectSchemaMigrationsFromArgs(["--only=202610220024_record_audit_identifier_collation"]).map((migration) => migration.name)).toEqual(["202610220024_record_audit_identifier_collation"]);
    });

    it.each([["--only", "202610220023_record_audit"], ["--only="], ["--onyl=202610220023_record_audit"], ["202610220023_record_audit"], ["--only=202610220023_record_audit", "--only=202610200021_sales_orders"], ["--only=202610220023_record_audit", "--unexpected"]])("rejects malformed migration CLI arguments instead of selecting all: %j", (...args) => {
        expect(() => selectSchemaMigrationsFromArgs(args)).toThrow("Migration arguments");
    });

    it("rejects unknown migration names from CLI", () => {
        expect(() => selectSchemaMigrationsFromArgs(["--only=unknown"])).toThrow("Unknown migration");
    });

    it("rejects malformed arguments in the real CLI before database configuration", () => {
        const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/run-schema-migrations.ts", "--only", "202610220023_record_audit"], {
            cwd: fileURLToPath(new URL("../../", import.meta.url)),
            encoding: "utf8",
            timeout: 10_000,
            // Even a parser regression cannot connect: dotenv is disabled and the schema is unapproved.
            env: { ...process.env, DOTENV_CONFIG_PATH: fileURLToPath(new URL("./missing-migration-test.env", import.meta.url)), DB_NAME: "do_not_connect", DB_HOST: "127.0.0.1", DB_PORT: "1", DB_USER: "do_not_connect" },
        });
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Migration arguments");
        expect(result.stderr).not.toContain("ECONNREFUSED");
    });

    it("selects only the requested migration and rejects unknown names", () => {
        expect(selectSchemaMigrations("202610090009_projects_domain").map((migration) => migration.name)).toEqual(["202610090009_projects_domain"]);
        expect(() => selectSchemaMigrations("unknown")).toThrow("Unknown migration");
        expect(selectSchemaMigrations()).toEqual(schemaMigrations);
    });
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

    it("registra las migraciones schema-only aprobadas en orden", () => {
        expect(schemaMigrations.map((migration) => migration.name)).toEqual([
            "202609250001_identity_schema",
            "202609250003_identity_login_readiness",
            "202609280004_identity_microsoft_session",
            "202609300005_identity_user_directory",
            "202610010006_identity_role_security_model",
            "202610030007_crm_catalogs",
            "202610080008_administration_owner_repair",
            "202610090009_projects_domain",
            "202610120010_campaigns_domain",
            "202610120011_classes_domain",
            "202610120012_locations_domain",
            "202610120013_subsidiaries_domain",
            "202610120014_brokers_domain",
            "202610120015_unit_files_domain",
            "202610120016_unit_files_naming",
            "202610130017_formalization_home_role",
            "202610130018_user_assign_password_permission",
            "202610200019_formalization_supervisor_role",
            "202610200020_formalization_home_banner",
            "202610200021_sales_orders",
            "202610200022_sales_order_utc_defaults",
            "202610220023_record_audit",
            "202610220024_record_audit_identifier_collation",
            "202610220025_contract_permissions",
            "202610230027_owner_role_inheritance",
            "202610230028_marketing_roles",
            "202610230029_general_manager_modules",
            "202610230030_general_manager_template",
            "202610230031_leads_domain",
            "202610230032_lead_history",
            "202610230033_lead_stage_reasons",
            "202610230034_calendar_domain",
            "202610260035_sales_order_lead",
            "202610260036_sales_order_stage_tracking",
            "202610260037_formalization_stage_permission",
            "202610260038_remove_marketing_appointments",
            "202610270039_notes_domain",
            "202610270040_notes_commands",
            "202610270041_legacy_note_context_source",
            "202610270042_formalization_target_permissions",
            "202610270043_formalization_stage_skip_permission",
            "202610270044_notes_collaboration",
            "202610280045_formalization_approval_permission",
            "202610280046_notes_realtime",
            "202610280047_formalization_banner_permissions",
            "202610280048_formalization_order_read_permission",
            "202610280049_formalization_role_workflows",
            "202610280050_formalization_catalog_access",
            "202610280051_global_calendar",
            "202610280052_notes_locations",
            "202610280053_notes_workflow",
            "202610290054_calendar_event_types",
            "202610290055_calendar_relations",
            "202610290056_marketing_global_read",
            "202610300057_sales_order_operational_flags",
            "202611020058_netsuite_order_events",
            "202611020059_sales_order_cancellation_date",
            "202611020060_lead_profile_permission",
            "202611020061_formalization_calendar_types",
        ]);
    });

    it("mantiene permisos atomicos globales para cada catalogo CRM", () => {
        const catalogPermissionCodes = getCatalogPermissionCodes();

        expect(catalogPermissionCodes).toHaveLength(CATALOG_DEFINITIONS.length * CATALOG_PERMISSION_ACTIONS.length * 5);
        expect(catalogPermissionCodes).not.toContain("catalog_project.read");
        expect(catalogPermissionCodes).toContain("administration.catalog_project.read");
        expect(catalogPermissionCodes).toContain("mercadeo.catalog_project.read");
        expect(catalogPermissionCodes).toContain("formalizacion.catalog_project.read");
        expect(catalogPermissionCodes.slice(0, 24)).toEqual([
            "ventas.catalog_project.read",
            "ventas.catalog_project.create",
            "ventas.catalog_project.update",
            "ventas.catalog_project.inactivate",
            "mercadeo.catalog_project.read",
            "mercadeo.catalog_project.create",
            "mercadeo.catalog_project.update",
            "mercadeo.catalog_project.inactivate",
            "formalizacion.catalog_project.read",
            "formalizacion.catalog_project.create",
            "formalizacion.catalog_project.update",
            "formalizacion.catalog_project.inactivate",
            "contabilidad.catalog_project.read",
            "contabilidad.catalog_project.create",
            "contabilidad.catalog_project.update",
            "contabilidad.catalog_project.inactivate",
            "administration.catalog_project.read",
            "administration.catalog_project.create",
            "administration.catalog_project.update",
            "administration.catalog_project.inactivate",
            "ventas.catalog_campaign.read",
            "ventas.catalog_campaign.create",
            "ventas.catalog_campaign.update",
            "ventas.catalog_campaign.inactivate",
        ]);
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

    it("documenta indices del directorio de usuarios en SQL/005", async () => {
        const userDirectorySchema = await readFile(userDirectorySchemaPath, "utf8");

        expect(userDirectorySchema).toContain("ix_sec_user_directory_status_name");
        expect(userDirectorySchema).toContain("ix_sec_user_directory_status_activity");
        expect(userDirectorySchema).toContain("ft_sec_user_directory_search");
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
