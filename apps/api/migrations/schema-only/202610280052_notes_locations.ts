import { readFile } from "node:fs/promises";

import { type Kysely, sql } from "kysely";

import { splitSqlStatements, stripLineComments } from "./202609250001_identity_schema.js";

/** Additive references only; never imports or duplicates legacy or note content. */
export async function loadNotesLocationsStatements(): Promise<string[]> {
    const statements = splitSqlStatements(stripLineComments(await readFile(new URL("../../Arquitectura/SQL/052_notes_locations.sql", import.meta.url), "utf8")));
    if (statements.length !== 1 || !statements[0]?.startsWith("CREATE TABLE crm_note_location (")) throw new Error("Unexpected note locations schema");
    return statements;
}
export const notesLocationsMigration = {
    name: "202610280052_notes_locations",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        const target = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (target.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Note locations require CRM_THINK_V2");
        const dependency = await sql`SELECT migration_name_schema_migration FROM conf_schema_migration WHERE migration_name_schema_migration='202610270044_notes_collaboration'`.execute(db);
        if (dependency.rows.length !== 1) throw new Error("Note locations require registered044");
        const partial = await sql`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_note_location'`.execute(db);
        if (partial.rows.length) throw new Error("Partial locations schema requires explicit recovery");
        for (const statement of await loadNotesLocationsStatements()) await sql.raw(statement).execute(db);
    },
};
