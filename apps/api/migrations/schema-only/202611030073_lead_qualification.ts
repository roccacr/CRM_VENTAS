import { type Kysely, sql } from "kysely";

const targets = {
    native: { database: "CRM_THINK_V2", table: "crm_lead", column: "is_qualified_lead", constraint: "chk_lead_qualified" },
    legacy: { database: "crmdatabase-api", table: "leads", column: "calificado_lead", constraint: "chk_legacy_lead_qualified" },
} as const;
type Source = keyof typeof targets;

/** Validate the selected schema and table before reading or planning any column change. */
async function assertLeadTable(db: Kysely<unknown>, target: (typeof targets)[Source]): Promise<void> {
    const name = (await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name;
    if (name !== target.database) throw new Error("Lead qualification destination mismatch");
    const tables = (await sql<{ engine: string; kind: string }>`SELECT ENGINE AS engine,TABLE_TYPE AS kind FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${target.table}`.execute(db)).rows;
    if (tables.length !== 1 || tables[0]?.engine !== "InnoDB" || tables[0].kind !== "BASE TABLE") throw new Error("Lead qualification requires InnoDB base table");
}

/** Only the two explicit lead tables are eligible; existing qualification values are never rewritten. */
export async function planLeadQualification(db: Kysely<unknown>, source: Source): Promise<string[]> {
    const target = targets[source];
    await assertLeadTable(db, target);
    const column = (await sql<{ type: string; nullable: string; defaultValue: string | null; extra: string }>`SELECT COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS defaultValue,EXTRA AS extra FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=${target.table} AND COLUMN_NAME=${target.column}`.execute(db)).rows[0];
    if (column && ![column.type === "tinyint(1)", column.nullable === "NO", column.defaultValue === "0", column.extra === ""].every(Boolean)) throw new Error("Lead qualification column drift");
    const check = (await sql<{ clause: string; enforced: string }>`SELECT c.CHECK_CLAUSE AS clause,t.ENFORCED AS enforced FROM information_schema.CHECK_CONSTRAINTS c JOIN information_schema.TABLE_CONSTRAINTS t ON t.CONSTRAINT_SCHEMA=c.CONSTRAINT_SCHEMA AND t.CONSTRAINT_NAME=c.CONSTRAINT_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME=${target.table} AND t.CONSTRAINT_NAME=${target.constraint}`.execute(db)).rows[0];
    if (check && ![check.enforced === "YES", check.clause.replaceAll(/[`\s()]/g, "").toLowerCase() === `${target.column}in0,1`].every(Boolean)) throw new Error("Lead qualification constraint drift");
    return [...(column ? [] : [`ALTER TABLE \`${target.table}\` ADD COLUMN \`${target.column}\` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0: No calificado; 1: Calificado. Independiente del estado comercial', ALGORITHM=INSTANT`]), ...(check ? [] : [`ALTER TABLE \`${target.table}\` ADD CONSTRAINT \`${target.constraint}\` CHECK (\`${target.column}\` IN (0,1))`])];
}

/** MySQL 8.4 must recognize pre-existing legacy foreign keys on non-unique indexes.
 * Compatibility is session-only, restored afterward; foreign_key_checks remains enabled.
 * https://dev.mysql.com/doc/refman/8.4/en/server-system-variables.html#sysvar_restrict_fk_on_non_standard_key
 */
async function applyQualificationStatements(db: Kysely<unknown>, source: Source, statements: readonly string[]): Promise<void> {
    if (source === "native") {
        for (const statement of statements) await sql.raw(statement).execute(db);
        return;
    }
    const previous = (await sql<{ restricted: number; checks: number }>`SELECT @@SESSION.restrict_fk_on_non_standard_key AS restricted,@@SESSION.foreign_key_checks AS checks`.execute(db)).rows[0];
    if (!previous || previous.checks !== 1) throw new Error("Legacy qualification requires enabled foreign key checks");
    try {
        await sql`SET SESSION restrict_fk_on_non_standard_key=OFF`.execute(db);
        for (const statement of statements) await sql.raw(statement).execute(db);
    } finally {
        await sql`SET SESSION restrict_fk_on_non_standard_key=${previous.restricted}`.execute(db);
    }
}

/** Bounded metadata locking; native ledger remains managed exclusively by the native runner. */
export async function runLeadQualification(db: Kysely<unknown>, source: Source, apply: boolean): Promise<string[]> {
    return db.connection().execute(async (connection) => {
        const previous = (await sql<{ timeout: number }>`SELECT @@SESSION.lock_wait_timeout AS timeout`.execute(connection)).rows[0];
        if (!previous) throw new Error("Lead qualification session settings unavailable");
        try {
            await sql`SET SESSION lock_wait_timeout=10`.execute(connection);
            const statements = await planLeadQualification(connection, source);
            if (apply) await applyQualificationStatements(connection, source, statements);
            return statements;
        } finally {
            await sql`SET SESSION lock_wait_timeout=${previous.timeout}`.execute(connection);
        }
    });
}
export const leadQualificationMigration = {
    name: "202611030073_lead_qualification",
    async up(db: Kysely<unknown>): Promise<void> {
        await runLeadQualification(db, "native", true);
    },
};
