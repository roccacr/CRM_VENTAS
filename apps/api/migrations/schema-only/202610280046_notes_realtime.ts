import { readFile } from "node:fs/promises";

import { type Kysely, sql } from "kysely";

import { splitSqlStatements, stripLineComments } from "./202609250001_identity_schema.js";
/** Additive metadata-only publication destination, without grants or legacy reads. */
export async function loadNotesRealtimeStatements(): Promise<string[]> {
    const statements = splitSqlStatements(stripLineComments(await readFile(new URL("../../Arquitectura/SQL/046_notes_realtime.sql", import.meta.url), "utf8")));
    if (statements.length !== 1 || !statements[0]?.startsWith("CREATE TABLE crm_note_realtime_event (")) throw new Error("Unexpected realtime schema");
    return statements;
}
export const notesRealtimeMigration = {
    name: "202610280046_notes_realtime",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        const target = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (target.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Realtime requires CRM_THINK_V2");
        const ledger = await sql`SELECT migration_name_schema_migration FROM conf_schema_migration WHERE migration_name_schema_migration='202610270044_notes_collaboration'`.execute(db);
        if (ledger.rows.length !== 1) throw new Error("Realtime requires registered044");
        const partial = await sql`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_note_realtime_event'`.execute(db);
        if (partial.rows.length) throw new Error("Partial realtime schema requires explicit recovery");
        const parents = await sql`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('sec_user','crm_note','sec_notification','int_event_outbox') AND TABLE_TYPE='BASE TABLE' AND ENGINE='InnoDB'`.execute(db);
        if (parents.rows.length !== 4) throw new Error("Missing realtime dependencies");
        for (const statement of await loadNotesRealtimeStatements()) await sql.raw(statement).execute(db);
    },
};
