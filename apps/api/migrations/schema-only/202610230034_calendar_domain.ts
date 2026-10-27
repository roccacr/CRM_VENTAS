import { readFile } from "node:fs/promises";

import { type Kysely, sql } from "kysely";

import { readTargetTableNames, splitSqlStatements, stripLineComments } from "./202609250001_identity_schema.js";

const expected = ["conf_calendar_event_type", "crm_calendar_event", "crm_calendar_participant", "crm_calendar_event_link", "crm_calendar_appointment", "crm_calendar_notification", "int_calendar_connection", "int_calendar_event_sync"];

/** Static reviewed DDL only: no seeds, imported records or provider registration. */
export async function loadCalendarStatements(): Promise<string[]> {
    const source = await readFile(new URL("../../Arquitectura/SQL/034_calendar_domain.sql", import.meta.url), "utf8");
    const statements = splitSqlStatements(stripLineComments(source));
    const actual = readTargetTableNames(statements);
    if (statements.length !== expected.length || actual.join(",") !== expected.join(",")) throw new Error("Calendar schema requires exactly the eight approved tables");
    return statements;
}

/** UTC modification times; origin-module changes are forbidden even for direct SQL callers. */
export const calendarTimestampStatements = expected.map((table) => {
    const entity = table.replace(/^(?:conf|crm|int)_/u, "");
    const body = table === "crm_calendar_event" ? "IF NEW.origin_module_id_calendar_event <> OLD.origin_module_id_calendar_event THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Calendar origin module is immutable'; END IF; " : "";
    return `CREATE TRIGGER trg_${entity}_updated_utc BEFORE UPDATE ON ${table} FOR EACH ROW BEGIN ${body}SET NEW.updated_at_${entity} = UTC_TIMESTAMP(3); END`;
});

/** Additive native-only foundation. Partial DDL must be reconciled explicitly, not silently adopted. */
export const calendarDomainMigration = {
    name: "202610230034_calendar_domain",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Calendar schema requires CRM_THINK_V2");
        const statements = await loadCalendarStatements();
        const existing = await sql<{ table_name: string }>`SELECT TABLE_NAME AS table_name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(expected)})`.execute(db);
        if (existing.rows.length) throw new Error("Existing calendar tables require explicit recovery before this migration");
        for (const statement of statements) await sql.raw(statement).execute(db);
        for (const statement of calendarTimestampStatements) await sql.raw(statement).execute(db);
    },
};
