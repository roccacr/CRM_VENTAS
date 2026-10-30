import { pathToFileURL } from "node:url";

import { Kysely, type KyselyPlugin, MysqlDialect, MysqlQueryCompiler, sql } from "kysely";
import { createPool } from "mysql2";
import { z } from "zod";

import { identitySchemaMigration } from "../migrations/schema-only/202609250001_identity_schema.js";
import { identityLoginReadinessMigration } from "../migrations/schema-only/202609250003_identity_login_readiness.js";
import { identityMicrosoftSessionMigration } from "../migrations/schema-only/202609280004_identity_microsoft_session.js";
import { identityUserDirectoryMigration } from "../migrations/schema-only/202609300005_identity_user_directory.js";
import { identityRoleSecurityModelMigration } from "../migrations/schema-only/202610010006_identity_role_security_model.js";
import { crmCatalogsMigration } from "../migrations/schema-only/202610030007_crm_catalogs.js";
import { administrationOwnerRepairMigration } from "../migrations/schema-only/202610080008_administration_owner_repair.js";
import { projectsDomainMigration } from "../migrations/schema-only/202610090009_projects_domain.js";
import { campaignsDomainMigration } from "../migrations/schema-only/202610120010_campaigns_domain.js";
import { classesDomainMigration } from "../migrations/schema-only/202610120011_classes_domain.js";
import { locationsDomainMigration } from "../migrations/schema-only/202610120012_locations_domain.js";
import { subsidiariesDomainMigration } from "../migrations/schema-only/202610120013_subsidiaries_domain.js";
import { brokersDomainMigration } from "../migrations/schema-only/202610120014_brokers_domain.js";
import { unitFilesDomainMigration } from "../migrations/schema-only/202610120015_unit_files_domain.js";
import { unitFilesNamingMigration } from "../migrations/schema-only/202610120016_unit_files_naming.js";
import { formalizationHomeRoleMigration } from "../migrations/schema-only/202610130017_formalization_home_role.js";
import { userAssignPasswordPermissionMigration } from "../migrations/schema-only/202610130018_user_assign_password_permission.js";
import { formalizationSupervisorRoleMigration } from "../migrations/schema-only/202610200019_formalization_supervisor_role.js";
import { formalizationHomeBannerMigration } from "../migrations/schema-only/202610200020_formalization_home_banner.js";
import { salesOrdersMigration } from "../migrations/schema-only/202610200021_sales_orders.js";
import { salesOrderUtcDefaultsMigration } from "../migrations/schema-only/202610200022_sales_order_utc_defaults.js";
import { recordAuditMigration } from "../migrations/schema-only/202610220023_record_audit.js";
import { recordAuditIdentifierCollationMigration } from "../migrations/schema-only/202610220024_record_audit_identifier_collation.js";
import { contractPermissionsMigration } from "../migrations/schema-only/202610220025_contract_permissions.js";
import { ownerRoleInheritanceMigration } from "../migrations/schema-only/202610230027_owner_role_inheritance.js";
import { marketingRolesMigration } from "../migrations/schema-only/202610230028_marketing_roles.js";
import { generalManagerModulesMigration } from "../migrations/schema-only/202610230029_general_manager_modules.js";
import { generalManagerTemplateMigration } from "../migrations/schema-only/202610230030_general_manager_template.js";
import { leadsDomainMigration } from "../migrations/schema-only/202610230031_leads_domain.js";
import { leadHistoryMigration } from "../migrations/schema-only/202610230032_lead_history.js";
import { leadStageReasonsMigration } from "../migrations/schema-only/202610230033_lead_stage_reasons.js";
import { calendarDomainMigration } from "../migrations/schema-only/202610230034_calendar_domain.js";
import { salesOrderLeadMigration } from "../migrations/schema-only/202610260035_sales_order_lead.js";
import { salesOrderStageTrackingMigration } from "../migrations/schema-only/202610260036_sales_order_stage_tracking.js";
import { formalizationStagePermissionMigration } from "../migrations/schema-only/202610260037_formalization_stage_permission.js";
import { removeMarketingAppointmentsMigration } from "../migrations/schema-only/202610260038_remove_marketing_appointments.js";
import { notesDomainMigration } from "../migrations/schema-only/202610270039_notes_domain.js";
import { notesCommandsMigration } from "../migrations/schema-only/202610270040_notes_commands.js";
import { legacyNoteContextSourceMigration } from "../migrations/schema-only/202610270041_legacy_note_context_source.js";
import { formalizationTargetPermissionsMigration } from "../migrations/schema-only/202610270042_formalization_target_permissions.js";
import { formalizationStageSkipPermissionMigration } from "../migrations/schema-only/202610270043_formalization_stage_skip_permission.js";
import { notesCollaborationMigration } from "../migrations/schema-only/202610270044_notes_collaboration.js";
import { formalizationApprovalPermissionMigration } from "../migrations/schema-only/202610280045_formalization_approval_permission.js";
import { notesRealtimeMigration } from "../migrations/schema-only/202610280046_notes_realtime.js";
import { formalizationBannerPermissionsMigration } from "../migrations/schema-only/202610280047_formalization_banner_permissions.js";
import { formalizationOrderReadPermissionMigration } from "../migrations/schema-only/202610280048_formalization_order_read_permission.js";
import { formalizationRoleWorkflowsMigration } from "../migrations/schema-only/202610280049_formalization_role_workflows.js";
import { formalizationCatalogAccessMigration } from "../migrations/schema-only/202610280050_formalization_catalog_access.js";
import { globalCalendarMigration } from "../migrations/schema-only/202610280051_global_calendar.js";
import { notesLocationsMigration } from "../migrations/schema-only/202610280052_notes_locations.js";
import { notesWorkflowMigration } from "../migrations/schema-only/202610280053_notes_workflow.js";
import { calendarEventTypesMigration } from "../migrations/schema-only/202610290054_calendar_event_types.js";
import { calendarRelationsMigration } from "../migrations/schema-only/202610290055_calendar_relations.js";
import { marketingGlobalReadMigration } from "../migrations/schema-only/202610290056_marketing_global_read.js";
import { addDatabaseTlsIssues, booleanEnvSchema, tcpPortSchema } from "../src/config/database-env.schema.js";
import { APPROVED_DATABASE_NAME } from "../src/config/product.constants.js";
import { buildMysqlPoolOptions } from "../src/database/mysql-pool-options.js";

const MYSQL_CONNECTION_LIMIT = 1;
const SCHEMA_MIGRATION_LOCK_NAME = "crm_think_v2_schema_migration";
const SCHEMA_MIGRATION_LOCK_TIMEOUT_SECONDS = 30;

// Inspect SQL identifiers, not bound values or descriptive strings. This is a runner guard,
// not a replacement for a dedicated MySQL account without privileges on the old database.
const nativeOnlyMigrationPlugin: KyselyPlugin = {
    transformQuery(args) {
        const query = new MysqlQueryCompiler().compileQuery(args.node, args.queryId);
        const tokens = query.sql.matchAll(/'(?:''|\\[\s\S]|[^'\\])*'|"(?:""|\\[\s\S]|[^"\\])*"|`(?:``|[^`])*`|\/\*[\s\S]*?\*\/|--[\t\r\n ][^\r\n]*|#[^\r\n]*|[a-z_][a-z0-9_$-]*/gi);
        for (const [token] of tokens) {
            // Backslash quoting changes meaning under NO_BACKSLASH_ESCAPES: fail closed.
            if (/^["']/.test(token) && token.includes("\\")) throw new Error("Native-only migration: ambiguous SQL quoting is forbidden; use bound values.");
            if (token.startsWith("'") || /^(?:\/\*(?![!+]|M!)|--|#)/i.test(token)) continue;
            const identifier = token.replace(/^["`]|["`]$/g, "").toLowerCase();
            if (/^\/\*/.test(token) || ["crmdatabase-api", "leads", "admins", "bitacoras", "caidas", "use", "call", "prepare", "execute", "load", "outfile", "dumpfile", "federated"].includes(identifier)) throw new Error("Native-only migration: legacy access and indirect SQL execution are forbidden.");
        }
        return args.node;
    },
    transformResult: (args) => Promise.resolve(args.result),
};

/** A schema migration: unique name and idempotent `up`. */
type Migration = {
    name: string;
    up: (db: Kysely<unknown>) => Promise<void>;
};

export const schemaMigrations: Migration[] = [
    identitySchemaMigration,
    identityLoginReadinessMigration,
    identityMicrosoftSessionMigration,
    identityUserDirectoryMigration,
    identityRoleSecurityModelMigration,
    crmCatalogsMigration,
    administrationOwnerRepairMigration,
    projectsDomainMigration,
    campaignsDomainMigration,
    classesDomainMigration,
    locationsDomainMigration,
    subsidiariesDomainMigration,
    brokersDomainMigration,
    unitFilesDomainMigration,
    unitFilesNamingMigration,
    formalizationHomeRoleMigration,
    userAssignPasswordPermissionMigration,
    formalizationSupervisorRoleMigration,
    formalizationHomeBannerMigration,
    salesOrdersMigration,
    salesOrderUtcDefaultsMigration,
    recordAuditMigration,
    recordAuditIdentifierCollationMigration,
    contractPermissionsMigration,
    ownerRoleInheritanceMigration,
    marketingRolesMigration,
    generalManagerModulesMigration,
    generalManagerTemplateMigration,
    leadsDomainMigration,
    leadHistoryMigration,
    leadStageReasonsMigration,
    calendarDomainMigration,
    salesOrderLeadMigration,
    salesOrderStageTrackingMigration,
    formalizationStagePermissionMigration,
    removeMarketingAppointmentsMigration,
    notesDomainMigration,
    notesCommandsMigration,
    legacyNoteContextSourceMigration,
    formalizationTargetPermissionsMigration,
    formalizationStageSkipPermissionMigration,
    notesCollaborationMigration,
    formalizationApprovalPermissionMigration,
    notesRealtimeMigration,
    formalizationBannerPermissionsMigration,
    formalizationOrderReadPermissionMigration,
    formalizationRoleWorkflowsMigration,
    formalizationCatalogAccessMigration,
    globalCalendarMigration,
    notesLocationsMigration,
    notesWorkflowMigration,
    calendarEventTypesMigration,
    calendarRelationsMigration,
    marketingGlobalReadMigration,
];

/** Targeted cutovers avoid replaying unrelated security repairs after a deliberate ledger reset. */
export const selectSchemaMigrations = (name?: string): Migration[] => {
    if (name === undefined) return schemaMigrations;
    const migration = schemaMigrations.find((candidate) => candidate.name === name);
    if (!migration) throw new Error("Unknown migration selection");
    return [migration];
};

/** Fail before connecting: a misspelled targeted command must never run every migration. */
export const selectSchemaMigrationsFromArgs = (args: readonly string[]): Migration[] => {
    if (args.length === 0) return selectSchemaMigrations();
    const [argument] = args;
    if (args.length !== 1 || !argument?.startsWith("--only=") || argument.length === 7) throw new Error("Migration arguments must be empty or exactly --only=<approved-name>");
    return selectSchemaMigrations(argument.slice(7));
};
/** True only when run as a script, not when imported by tests. */
const isExecutedDirectly = (): boolean => (process.argv[1] ? pathToFileURL(process.argv[1]).href === import.meta.url : false);

/**
 * Carga `.env` solo para ejecucion CLI.
 *
 * Importar este archivo desde pruebas debe ser libre de efectos secundarios y
 * no debe cargar secretos reales en `process.env`.
 */
const runFromCli = async (): Promise<void> => {
    await import("dotenv/config");
    await run();
};

/**
 * Contrato estricto del runner schema-only.
 *
 * Es intencionalmente mas pequeno que el contrato completo del runtime: solo
 * valida variables `DB_*` y el doble candado de migracion. No debe depender de
 * CORS, cookies ni Microsoft para validar estructura.
 */
const schemaMigrationEnvSchema = z
    .object({
        DB_HOST: z.string().min(1),
        DB_PORT: tcpPortSchema.default(3306),
        DB_USER: z.string().min(1),
        DB_PASSWORD: z.string().default(""),
        DB_NAME: z.literal(APPROVED_DATABASE_NAME),
        DB_SSL: booleanEnvSchema("false"),
        DB_SSL_CA: z.string().min(1).optional(),
        MIGRATION_CONFIRM_SCHEMA_ONLY: z.literal(APPROVED_DATABASE_NAME),
    })
    .superRefine((config, context) => {
        addDatabaseTlsIssues(config, context);
    });

/** Validated environment of the migration runner. */
type SchemaMigrationEnv = z.infer<typeof schemaMigrationEnvSchema>;

/**
 * Valida variables del runner antes de abrir cualquier conexion.
 */
export const readSchemaMigrationEnv = (source: NodeJS.ProcessEnv = process.env): SchemaMigrationEnv => {
    const result = schemaMigrationEnvSchema.safeParse(source);

    if (!result.success) {
        throw new Error(`Configuracion de migracion invalida: ${result.error.message}`);
    }

    return result.data;
};

/**
 * Crea la conexion Kysely usada solo por migraciones schema-only.
 *
 * El doble candado es intencional. Un `.env` copiado debe nombrar
 * CRM_THINK_V2 dos veces antes de que este script toque una base de datos.
 */
const createDatabase = (): Kysely<unknown> => {
    const env = readSchemaMigrationEnv();
    const poolOptions = buildMysqlPoolOptions({
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
        connectionLimit: MYSQL_CONNECTION_LIMIT,
        ssl: env.DB_SSL,
        ...(env.DB_SSL_CA ? { sslCaPath: env.DB_SSL_CA } : {}),
    });

    const pool = createPool(poolOptions);

    return new Kysely<unknown>({
        dialect: new MysqlDialect({ pool }),
    });
};

/**
 * Asegura que exista el registro local de migraciones.
 *
 * Este registro pertenece a la herramienta de validacion, no a tablas de
 * negocio.
 */
const ensureMigrationTable = async (db: Kysely<unknown>): Promise<void> => {
    await sql`
    CREATE TABLE IF NOT EXISTS conf_schema_migration (
      id_schema_migration BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT 'Identificador interno de la migracion de esquema aplicada.',
      migration_name_schema_migration VARCHAR(180) NOT NULL COMMENT 'Nombre unico y estable de la migracion schema-only.',
      applied_at_schema_migration DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) COMMENT 'Fecha y hora en que se registro la migracion como aplicada.',
      PRIMARY KEY (id_schema_migration),
      UNIQUE KEY uq_conf_schema_migration_name (migration_name_schema_migration)
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_unicode_ci
      COMMENT='Registro controlado de migraciones schema-only aplicadas al CRM.'
  `.execute(db);
};

/**
 * Serializa ejecuciones de validacion de esquema con un lock nombrado MySQL.
 */
const acquireLock = async (db: Kysely<unknown>): Promise<void> => {
    const result = await sql<{ lock_acquired: number | null }>`
    SELECT GET_LOCK(${SCHEMA_MIGRATION_LOCK_NAME}, ${SCHEMA_MIGRATION_LOCK_TIMEOUT_SECONDS}) AS lock_acquired
  `.execute(db);

    if (result.rows[0]?.lock_acquired !== 1) {
        throw new Error("No se pudo obtener el lock de migracion de esquema.");
    }
};

/**
 * Libera el lock asesor. Los callers ignoran fallos durante shutdown porque
 * cerrar la conexion tambien libera locks MySQL.
 */
const releaseLock = async (db: Kysely<unknown>): Promise<void> => {
    await sql`SELECT RELEASE_LOCK(${SCHEMA_MIGRATION_LOCK_NAME})`.execute(db);
};

/**
 * Revisa si una migracion schema-only ya fue registrada.
 */
const hasMigration = async (db: Kysely<unknown>, migrationName: string): Promise<boolean> => {
    const result = await sql<{ found_migration: number }>`
    SELECT COUNT(*) AS found_migration
    FROM conf_schema_migration
    WHERE migration_name_schema_migration = ${migrationName}
  `.execute(db);

    return (result.rows[0]?.found_migration ?? 0) > 0;
};

/**
 * Registra una migracion schema-only aplicada correctamente.
 */
const recordMigration = async (db: Kysely<unknown>, migrationName: string): Promise<void> => {
    await sql`
    INSERT INTO conf_schema_migration (migration_name_schema_migration)
    VALUES (${migrationName})
  `.execute(db);
};

/**
 * Ejecuta migraciones schema-only aprobadas.
 *
 * Este script debe seguir siendo explicito y manual. El arranque NestJS nunca
 * debe ejecutar migraciones automaticamente.
 */
export const runSelectedSchemaMigrations = async (db: Kysely<unknown>, selected: readonly Migration[]): Promise<void> => {
    let failure: { error: unknown } | undefined;
    try {
        await acquireLock(db);
        await ensureMigrationTable(db);

        for (const migration of selected) {
            if (await hasMigration(db, migration.name)) {
                console.log(`Migracion omitida porque ya esta aplicada: ${migration.name}`);
                continue;
            }

            console.log(`Aplicando migracion schema-only: ${migration.name}`);
            await migration.up(db.withPlugin(nativeOnlyMigrationPlugin));
            await recordMigration(db, migration.name);
            console.log(`Migracion schema-only aplicada: ${migration.name}`);
        }
    } catch (error) {
        failure = { error };
    } finally {
        await releaseLock(db).catch(() => undefined);
        try {
            await db.destroy();
        } catch (error) {
            if (failure) console.error("Schema migration database cleanup failed; preserving the original error.");
            else failure = { error };
        }
    }
    if (failure) throw failure.error;
};

/** Validate selection before constructing a pool; the orchestrator owns and closes it. */
const run = async (): Promise<void> => {
    const selected = selectSchemaMigrationsFromArgs(process.argv.slice(2));
    await runSelectedSchemaMigrations(createDatabase(), selected);
};

if (isExecutedDirectly()) {
    void runFromCli().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Fallo la migracion de esquema: ${message}`);
        process.exit(1);
    });
}
