import { readFile } from "node:fs/promises";

import { type Kysely, sql } from "kysely";

import { splitSqlStatements, stripLineComments } from "./202609250001_identity_schema.js";

/** Loads the bounded additive native workflow schema and notification kind extension. */
export async function loadNotesWorkflowStatements(): Promise<string[]> {
    const statements = splitSqlStatements(stripLineComments(await readFile(new URL("../../Arquitectura/SQL/053_notes_workflow.sql", import.meta.url), "utf8")));
    if (statements.length !== 3 || !statements[0]?.startsWith("CREATE TABLE crm_note_task (") || !statements[1]?.startsWith("CREATE TABLE crm_note_workflow_event (") || !statements[2]?.startsWith("ALTER TABLE sec_notification DROP CHECK ck_notification_kind")) throw new Error("Unexpected note workflow schema");
    return statements;
}
export const notesWorkflowMigration = {
    name: "202610280053_notes_workflow",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        const target = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (target.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Note workflow requires CRM_THINK_V2");
        const ledger = await sql`SELECT migration_name_schema_migration FROM conf_schema_migration WHERE migration_name_schema_migration IN ('202610270044_notes_collaboration','202610280046_notes_realtime')`.execute(db);
        if (ledger.rows.length !== 2) throw new Error("Note workflow requires registered044/046");
        const partial = await sql`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('crm_note_task','crm_note_workflow_event')`.execute(db);
        if (partial.rows.length) throw new Error("Partial note workflow schema requires explicit recovery");
        const parents = await sql`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('sec_user','crm_note','sec_notification','int_event_outbox','crm_note_realtime_event') AND TABLE_TYPE='BASE TABLE' AND ENGINE='InnoDB'`.execute(db);
        if (parents.rows.length !== 5) throw new Error("Missing note workflow dependencies");
        for (const statement of await loadNotesWorkflowStatements()) await sql.raw(statement).execute(db);
    },
};
