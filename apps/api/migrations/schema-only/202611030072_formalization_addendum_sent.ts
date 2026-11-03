import { type Kysely, sql } from "kysely";

import { assertBankSchemaDestination } from "./banks-schema.js";

const targets = { native: { database: "CRM_THINK_V2", table: "crm_sales_order", column: "addendum_status_sales_order" }, legacy: { database: "crmdatabase-api", table: "ordenventa", column: "estado_adendum_ov" } } as const;
type Source = keyof typeof targets;
type Metadata = { type: string; nullable: string; defaultValue: string | null; extra: string; charset: string; collation: string; comment: string };
const original = "enum('pending','completed','cancelled')";
const final = "enum('pending','completed','cancelled','sent')";

/** Appending preserves ENUM ordinals. Literal quoting requires NO_BACKSLASH_ESCAPES on the executing session. */
export function buildAddendumSentAlter(column: Metadata, source: Source): string | null {
    if (![[original, final].includes(column.type), column.nullable === "YES", [null, "NULL"].includes(column.defaultValue), column.extra === "", /^[a-zA-Z0-9_]+$/.test(column.charset), /^[a-zA-Z0-9_]+$/.test(column.collation), typeof column.comment === "string"].every(Boolean)) throw new Error("Addendum sent column drift");
    if (column.type === final) return null;
    const target = targets[source];
    return `ALTER TABLE \`${target.table}\` MODIFY COLUMN \`${target.column}\` ENUM('pending','completed','cancelled','sent') CHARACTER SET ${column.charset} COLLATE ${column.collation} NULL DEFAULT NULL COMMENT '${column.comment.replaceAll("'", "''")}', ALGORITHM=INPLACE, LOCK=NONE`;
}

/** The full contract is checked on every retry, including already-expanded columns. */
export async function planAddendumSent(db: Kysely<unknown>, source: Source): Promise<string[]> {
    const target = targets[source];
    await assertBankSchemaDestination(db, target.database);
    const tables = (await sql<{ engine: string; kind: string }>`SELECT ENGINE AS engine,TABLE_TYPE AS kind FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${target.table}`.execute(db)).rows;
    if (![tables.length === 1, tables.every((table) => table.engine === "InnoDB" && table.kind === "BASE TABLE")].every(Boolean)) throw new Error("Addendum sent requires InnoDB base table");
    const columns = (await sql<Metadata>`SELECT COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS defaultValue,EXTRA AS extra,CHARACTER_SET_NAME AS charset,COLLATION_NAME AS collation,COLUMN_COMMENT AS comment FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${target.table} AND COLUMN_NAME=${target.column}`.execute(db)).rows;
    if (columns.length !== 1 || !columns[0]) throw new Error("Addendum sent column missing");
    const statement = buildAddendumSentAlter(columns[0], source);
    return statement ? [statement] : [];
}

/** Bound MDL before metadata and DDL; preserve session settings, notes and historical states. */
export async function runAddendumSent(db: Kysely<unknown>, source: Source, apply: boolean): Promise<string[]> {
    return db.connection().execute(async (connection) => {
        const settings = (await sql<{ timeout: number; mode: string }>`SELECT @@SESSION.lock_wait_timeout AS timeout,@@SESSION.sql_mode AS mode`.execute(connection)).rows[0];
        if (!settings || !Number.isSafeInteger(settings.timeout) || settings.timeout < 1 || typeof settings.mode !== "string") throw new Error("Invalid addendum session settings");
        await sql`SET SESSION lock_wait_timeout=10`.execute(connection);
        try {
            // Double quote escaping remains unambiguous for comments containing apostrophes and backslashes.
            await sql`SET SESSION sql_mode=${[...new Set([...settings.mode.split(",").filter(Boolean), "NO_BACKSLASH_ESCAPES"])].join(",")}`.execute(connection);
            const statements = await planAddendumSent(connection, source);
            if (apply) for (const statement of statements) await sql.raw(statement).execute(connection);
            return statements;
        } finally {
            try {
                await sql`SET SESSION sql_mode=${settings.mode}`.execute(connection);
            } finally {
                await sql`SET SESSION lock_wait_timeout=${settings.timeout}`.execute(connection);
            }
        }
    });
}
export const formalizationAddendumSentMigration = {
    name: "202611030072_formalization_addendum_sent",
    async up(db: Kysely<unknown>): Promise<void> {
        await runAddendumSent(db, "native", true);
    },
};
