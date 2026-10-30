import { readFile } from "node:fs/promises";

import { type Kysely, sql } from "kysely";

import { splitSqlStatements, stripLineComments } from "./202609250001_identity_schema.js";
const modules = ["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"];
const actions = ["share_own", "reply", "edit_reply_own", "withdraw_reply_own"];
export const notesCollaborationPermissions = modules.flatMap((module) => actions.map((action) => ({ code: `${module}.notes.${action}`, module, action, description: `Colaborar en notas: ${action} en ${module}; requiere autoria o invitacion y acceso vigente.`, status: "active" })));
/** Loads exactly the approved schema; permissions remain definitions without role grants. */
export async function loadNotesCollaborationStatements(): Promise<string[]> {
    const statements = splitSqlStatements(stripLineComments(await readFile(new URL("../../Arquitectura/SQL/044_notes_collaboration.sql", import.meta.url), "utf8")));
    if (statements.length !== 2 || !statements[0]?.startsWith("ALTER TABLE crm_note") || !statements[1]?.startsWith("CREATE TABLE sec_notification (")) throw new Error("Unexpected collaboration schema");
    return statements;
}
async function checkPermissions<DB>(db: Kysely<DB>) {
    const existing = await sql<Record<string, unknown>>`SELECT code_permission AS code,module_code_permission AS module,action_code_permission AS action,description_permission AS description,status_permission AS status FROM sec_permission WHERE code_permission IN (${sql.join(notesCollaborationPermissions.map((p) => p.code))})`.execute(db);
    for (const row of existing.rows) {
        const expected = notesCollaborationPermissions.find((p) => p.code === row.code);
        if (!expected || !Object.entries(expected).every(([key, value]) => row[key] === value)) throw new Error("Conflicting notes collaboration permissions");
    }
    return new Set(existing.rows.map((row) => String(row.code)));
}
/** Stops on partial DDL instead of adopting unknown schema. No live execution is implied. */
export const notesCollaborationMigration = {
    name: "202610270044_notes_collaboration",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Collaboration requires CRM_THINK_V2");
        const statements = await loadNotesCollaborationStatements();
        const ledger = await sql<{ name: string }>`SELECT migration_name_schema_migration AS name FROM conf_schema_migration WHERE migration_name_schema_migration='202610270040_notes_commands'`.execute(db);
        if (ledger.rows.length !== 1) throw new Error("Collaboration requires registered foundation 040");
        const partial = await sql<{ name: string }>`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sec_notification' UNION ALL SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_note' AND COLUMN_NAME IN ('collaboration_version_note','collaboration_updated_at_note')`.execute(db);
        if (partial.rows.length) throw new Error("Partial collaboration schema requires explicit recovery");
        const parents = ["crm_note", "int_event_outbox", "sec_user", "sec_permission"];
        const present = await sql<{ name: string }>`SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(parents)}) AND TABLE_TYPE='BASE TABLE' AND ENGINE='InnoDB'`.execute(db);
        if (present.rows.length !== parents.length) throw new Error("Missing collaboration dependencies");
        await checkPermissions(db);
        for (const statement of statements) await sql.raw(statement).execute(db);
        await db.transaction().execute(async (tx) => {
            const defined = await checkPermissions(tx);
            for (const p of notesCollaborationPermissions) if (!defined.has(p.code)) await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission) VALUES (${p.code},${p.module},${p.action},${p.description},${p.status})`.execute(tx);
        });
    },
};
