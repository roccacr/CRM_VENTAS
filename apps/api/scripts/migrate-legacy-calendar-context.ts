import { pathToFileURL } from "node:url";

import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";

import { buildMysqlPoolOptions } from "../src/database/mysql-pool-options.js";
import { readSchemaMigrationEnv } from "./run-schema-migrations.js";

const table = "crm_calendar_event_context";
const triggerName = "trg_calendar_event_context_updated_utc";
const columns = [
    ["calendar_id", "int", "NO", null, "ID legacy explicito; una clasificacion por evento existente"],
    ["public_id", "char(26)", "NO", null, "ULID publico del contexto de evento legacy"],
    ["module_code", "varchar(80)", "NO", null, "Modulo de origen explicito e inmutable; nunca inferido del usuario"],
    ["event_type_code", "varchar(80)", "NO", null, "Codigo del tipo configurable dentro del modulo de origen"],
    ["starts_at", "datetime(3)", "NO", null, "Inicio UTC explicito; sin reinterpretar fechas legacy"],
    ["ends_at", "datetime(3)", "NO", null, "Fin UTC exclusivo posterior al inicio"],
    ["timezone", "varchar(100)", "NO", null, "Zona IANA explicita para presentar el horario"],
    ["version", "int", "NO", "1", "Version optimista incrementada por cada comando autorizado"],
    ["owner_user_public_id", "char(26)", "NO", null, "ULID del usuario CRM nuevo mapeado explicitamente; sin FK entre bases"],
    ["details", "json", "YES", null, "Detalles opcionales por modulo; referencias libres como texto"],
    ["created_at", "datetime(3)", "NO", "utc_timestamp(3)", "Creacion del contexto en UTC"],
    ["updated_at", "datetime(3)", "NO", "utc_timestamp(3)", "Ultima modificacion del contexto en UTC"],
    ["all_day", "tinyint unsigned", "NO", "0", "Uno para evento de todo el dia; limites UTC verificados por el API"],
    ["status", "varchar(24)", "NO", "scheduled", "Estado canonico scheduled, completed o cancelled del evento clasificado"],
] as const;
const indexes = [
    ["PRIMARY", 0, ["calendar_id"]],
    ["uq_calendar_context_public", 0, ["public_id"]],
    ["ix_calendar_context_module_time", 1, ["module_code", "starts_at", "calendar_id"]],
    ["ix_calendar_context_owner_time", 1, ["owner_user_public_id", "starts_at", "calendar_id"]],
] as const;
const checks = [
    ["ck_calendar_context_interval", "ends_at > starts_at"],
    ["ck_calendar_context_flags", "version > 0 AND all_day IN (0,1)"],
    ["ck_calendar_context_status", "status IN ('scheduled','completed','cancelled')"],
] as const;
const triggerBody = "BEGIN IF BINARY NEW.module_code <> BINARY OLD.module_code OR NEW.calendar_id <> OLD.calendar_id OR BINARY NEW.public_id <> BINARY OLD.public_id THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Calendar context origin is immutable'; END IF; SET NEW.updated_at = UTC_TIMESTAMP(3); END";

/** Reviewed additive side table only. No historical rows, inferred modules or cross-database keys. */
export const legacyCalendarContextDdl = `CREATE TABLE crm_calendar_event_context (
${columns.map(([name, type, nullable, defaultValue, comment]) => `    ${name} ${type.toUpperCase()}${["public_id", "owner_user_public_id"].includes(name) ? " CHARACTER SET ascii COLLATE ascii_bin" : ""} ${nullable === "YES" ? "NULL" : "NOT NULL"}${defaultValue === null ? "" : ` DEFAULT ${defaultValue === "utc_timestamp(3)" ? "(UTC_TIMESTAMP(3))" : `'${defaultValue}'`}`} COMMENT '${comment}'`).join(",\n")},
${indexes.map(([name, nonUnique, fields]) => `    ${name === "PRIMARY" ? "PRIMARY KEY" : `${nonUnique ? "KEY" : "UNIQUE KEY"} ${name}`} (${fields.join(",")})`).join(",\n")},
    CONSTRAINT fk_calendar_context_calendar FOREIGN KEY (calendar_id) REFERENCES calendars(id_calendar) ON DELETE RESTRICT ON UPDATE RESTRICT,
${checks.map(([name, clause]) => `    CONSTRAINT ${name} CHECK (${clause})`).join(",\n")}
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Contexto explicito de calendario legacy; filas antiguas sin contexto no se clasifican'`;
const triggerDdl = `CREATE TRIGGER ${triggerName} BEFORE UPDATE ON ${table} FOR EACH ROW ${triggerBody}`;
type Row = Record<string, unknown>;

function normalizeType(value: unknown): string {
    return String(value)
        .toLowerCase()
        .replace(/\b(int|tinyint)\(\d+\)/g, "$1");
}
function normalizeDefault(value: unknown): string | null {
    if (value === null) return null;
    if (typeof value !== "string" && typeof value !== "number") throw new Error("Unexpected metadata default");
    return String(value)
        .toLowerCase()
        .replace(/^\((.*)\)$/, "$1");
}
function normalizeSql(value: unknown): string {
    return String(value).toLowerCase().replace(/[`\s]/g, "");
}

/** Require a signed INT primary key and transactional parent before adding the local RESTRICT key. */
async function validateParent(db: Kysely<unknown>): Promise<void> {
    const parent = (await sql<Row>`SELECT COLUMN_NAME AS column_name,COLUMN_TYPE AS column_type,IS_NULLABLE AS is_nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='calendars' AND COLUMN_NAME='id_calendar'`.execute(db)).rows;
    if (parent.length !== 1 || !parent.every((c) => c.column_name === "id_calendar" && normalizeType(c.column_type) === "int" && c.is_nullable === "NO")) throw new Error("Legacy calendars.id_calendar must be a signed INT");
    const primary = (await sql<Row>`SELECT INDEX_NAME AS index_name,COLUMN_NAME AS column_name,NON_UNIQUE AS non_unique,SEQ_IN_INDEX AS seq_in_index,SUB_PART AS sub_part FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='calendars' AND INDEX_NAME='PRIMARY' ORDER BY SEQ_IN_INDEX`.execute(db)).rows;
    if (primary.length !== 1 || !primary.every((i) => i.column_name === "id_calendar" && i.non_unique === 0 && i.seq_in_index === 1 && i.sub_part === null)) throw new Error("Legacy calendar parent primary key drift");
}

/** Exact contracts include defaults, comments, charset, generated behavior and nullability. */
function validateColumns(actual: Row[]): void {
    if (actual.length !== columns.length) throw new Error("Legacy calendar context column count drift");
    for (const [name, type, nullable, defaultValue, comment] of columns) {
        const matches = actual.filter((c) => c.column_name === name);
        const valid = matches.length === 1 && matches.every((c) => [normalizeType(c.column_type) === type, c.is_nullable === nullable, normalizeDefault(c.column_default) === defaultValue, c.column_comment === comment, ["", "DEFAULT_GENERATED"].includes(String(c.extra)), c.collation_name === (["public_id", "owner_user_public_id"].includes(name) ? "ascii_bin" : /^(?:varchar|char)/.test(type) ? "utf8mb4_unicode_ci" : null)].every(Boolean));
        if (!valid) throw new Error("Legacy calendar context column drift requires reconciliation");
    }
}

/** Reject extra uniqueness, prefixes or missing module/date and owner/date access paths. */
async function validateIndexes(db: Kysely<unknown>): Promise<void> {
    const actual = (await sql<Row>`SELECT INDEX_NAME AS index_name,NON_UNIQUE AS non_unique,SEQ_IN_INDEX AS seq_in_index,COLUMN_NAME AS column_name,SUB_PART AS sub_part FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table} ORDER BY INDEX_NAME,SEQ_IN_INDEX`.execute(db)).rows;
    const expected = indexes.flatMap(([index_name, non_unique, fields]) => fields.map((column_name, i) => ({ index_name, non_unique, seq_in_index: i + 1, column_name, sub_part: null })));
    if (actual.length !== expected.length || !expected.every((e) => actual.some((a) => Object.entries(e).every(([key, value]) => a[key] === value)))) throw new Error("Legacy calendar context index drift");
}

/** Local-only RESTRICT FK and enforced canonical invariants; no FK to new CRM identities. */
async function validateConstraints(db: Kysely<unknown>): Promise<void> {
    const keys = (
        await sql<Row>`SELECT k.COLUMN_NAME AS column_name,k.REFERENCED_TABLE_SCHEMA AS referenced_schema,k.REFERENCED_TABLE_NAME AS referenced_table,k.REFERENCED_COLUMN_NAME AS referenced_column,k.ORDINAL_POSITION AS position,r.DELETE_RULE AS delete_rule,r.UPDATE_RULE AS update_rule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.TABLE_NAME=k.TABLE_NAME AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME WHERE k.TABLE_SCHEMA=DATABASE() AND k.TABLE_NAME=${table} AND k.REFERENCED_TABLE_NAME IS NOT NULL`.execute(
            db,
        )
    ).rows;
    if (keys.length !== 1 || !keys.every((k) => [k.column_name === "calendar_id", k.referenced_schema === "crmdatabase-api", k.referenced_table === "calendars", k.referenced_column === "id_calendar", k.position === 1, k.delete_rule === "RESTRICT", k.update_rule === "RESTRICT"].every(Boolean))) throw new Error("Legacy calendar context foreign key drift");
    const actual = (await sql<Row>`SELECT t.CONSTRAINT_NAME AS name,c.CHECK_CLAUSE AS clause,t.ENFORCED AS enforced FROM information_schema.TABLE_CONSTRAINTS t JOIN information_schema.CHECK_CONSTRAINTS c ON c.CONSTRAINT_SCHEMA=t.CONSTRAINT_SCHEMA AND c.CONSTRAINT_NAME=t.CONSTRAINT_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME=${table} AND t.CONSTRAINT_TYPE='CHECK'`.execute(db)).rows;
    const normalizeCheck = (value: unknown) =>
        normalizeSql(value)
            .replace(/[()]/g, "")
            .replace(/_utf8mb4/g, "")
            .replace(/\\'/g, "'");
    if (actual.length !== checks.length || !checks.every(([name, clause]) => actual.some((c) => c.name === name && c.enforced === "YES" && normalizeCheck(c.clause) === normalizeCheck(clause)))) throw new Error("Legacy calendar context check constraint drift");
}

async function validateContext(db: Kysely<unknown>): Promise<void> {
    const actual = (await sql<Row>`SELECT COLUMN_NAME AS column_name,COLUMN_TYPE AS column_type,IS_NULLABLE AS is_nullable,COLUMN_DEFAULT AS column_default,EXTRA AS extra,COLUMN_COMMENT AS column_comment,COLLATION_NAME AS collation_name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${table} ORDER BY ORDINAL_POSITION`.execute(db)).rows;
    validateColumns(actual);
    await validateIndexes(db);
    await validateConstraints(db);
}

/** Recover a missing trigger only when its table has already passed structural checks. */
async function planContextTrigger(db: Kysely<unknown>): Promise<string[]> {
    const triggers = (await sql<Row>`SELECT TRIGGER_NAME AS name,ACTION_TIMING AS timing,EVENT_MANIPULATION AS event,ACTION_ORIENTATION AS orientation,ACTION_STATEMENT AS body FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE=${table}`.execute(db)).rows;
    if (triggers.length && (triggers.length !== 1 || !triggers.every((t) => t.name === triggerName && t.timing === "BEFORE" && t.event === "UPDATE" && t.orientation === "ROW" && normalizeSql(t.body) === normalizeSql(triggerBody)))) throw new Error("Legacy calendar context trigger drift");
    return triggers.length ? [] : [triggerDdl];
}

/** Read-only preflight; adopt existing DDL only after complete structural verification. */
export async function planLegacyCalendarContext(db: Kysely<unknown>): Promise<string[]> {
    if ((await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name !== "crmdatabase-api") throw new Error("Legacy calendar context requires exactly crmdatabase-api");
    const inventory = (await sql<{ table_name: string; table_type: string; engine: string; collation: string }>`SELECT TABLE_NAME AS table_name,TABLE_TYPE AS table_type,ENGINE AS engine,TABLE_COLLATION AS collation FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('calendars','crm_calendar_event_context')`.execute(db)).rows;
    if (!inventory.some((t) => t.table_name === "calendars" && t.table_type === "BASE TABLE" && t.engine === "InnoDB")) throw new Error("Legacy calendar requires native InnoDB calendars parent");
    await validateParent(db);
    const existing = inventory.filter((t) => t.table_name === table);
    if (existing.length > 1 || existing.some((t) => t.table_type !== "BASE TABLE" || t.engine !== "InnoDB" || t.collation !== "utf8mb4_unicode_ci")) throw new Error("Legacy calendar context table drift");
    if (existing.length) await validateContext(db);
    return [...(existing.length ? [] : [legacyCalendarContextDdl]), ...(await planContextTrigger(db))];
}

/** One pinned connection for advisory lock, dry plan, additive DDL and post-apply verification. */
export async function runLegacyCalendarContext(db: Kysely<unknown>, apply: boolean): Promise<string[]> {
    return db.connection().execute(async (connection) => {
        const lock = await sql<{ acquired: number }>`SELECT GET_LOCK('legacy_calendar_event_context',30) AS acquired`.execute(connection);
        if (lock.rows[0]?.acquired !== 1) throw new Error("Legacy calendar context lock unavailable");
        try {
            const statements = await planLegacyCalendarContext(connection);
            if (apply) {
                for (const statement of statements) await sql.raw(statement).execute(connection);
                if ((await planLegacyCalendarContext(connection)).length) throw new Error("Legacy calendar context DDL verification incomplete");
            }
            return statements;
        } finally {
            await sql`SELECT RELEASE_LOCK('legacy_calendar_event_context')`.execute(connection);
        }
    });
}

async function runFromCli(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.length !== 1 || !["--plan", "--apply=crmdatabase-api"].includes(args[0] ?? "")) throw new Error("Use exactly --plan or --apply=crmdatabase-api");
    await import("dotenv/config");
    const env = readSchemaMigrationEnv();
    const db = new Kysely<unknown>({ dialect: new MysqlDialect({ pool: createPool(buildMysqlPoolOptions({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD, database: "crmdatabase-api", connectionLimit: 1, ssl: env.DB_SSL, ...(env.DB_SSL_CA ? { sslCaPath: env.DB_SSL_CA } : {}) })) }) });
    try {
        console.log((await runLegacyCalendarContext(db, args[0] === "--apply=crmdatabase-api")).join(";\n"));
    } finally {
        await db.destroy();
    }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url)
    void runFromCli().catch(() => {
        console.error("Legacy calendar context failed; inspect schema drift and configuration before retrying");
        process.exitCode = 1;
    });
