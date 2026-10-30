import { readFile } from "node:fs/promises";

import { type Kysely, sql } from "kysely";

import { splitSqlStatements, stripLineComments } from "./202609250001_identity_schema.js";

const dependencies = ["crm_note", "crm_note_reply", "crm_note_participant", "crm_note_mention", "crm_note_link", "crm_note_placement", "int_note_external_reference", "sec_user", "sec_permission"];
const modules = ["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"];
const actions = { read: "Leer notas autorizadas", create: "Crear notas propias", edit_own: "Editar notas propias", resolve_own: "Completar o reabrir notas propias", archive_own: "Archivar notas propias" };
const permissions = modules.flatMap((module) => Object.entries(actions).map(([action, description]) => ({ code: `${module}.notes.${action}`, module, action, description: `${description} en ${module}; requiere autoria y acceso vigente segun la accion.`, status: "active" })));

/** Only approved DDL: no triggers, imported content or delivery process. */
export async function loadNotesCommandsStatements(): Promise<string[]> {
    const source = await readFile(new URL("../../Arquitectura/SQL/040_notes_commands.sql", import.meta.url), "utf8");
    const statements = splitSqlStatements(stripLineComments(source));
    if (statements.length !== 3 || !statements[0]?.startsWith("ALTER TABLE crm_note") || !statements[1]?.startsWith("CREATE TABLE int_note_command (") || !statements[2]?.startsWith("CREATE TABLE int_event_outbox (")) throw new Error("Notes commands require exactly the approved ALTER and two tables");
    return statements;
}

async function checkPermissions<DB>(db: Kysely<DB>, lock = false): Promise<Set<string>> {
    const existing = await sql<Record<string, unknown>>`SELECT code_permission AS code,module_code_permission AS module,action_code_permission AS action,description_permission AS description,status_permission AS status FROM sec_permission WHERE code_permission IN (${sql.join(permissions.map((permission) => permission.code))}) ${lock ? sql.raw("FOR UPDATE") : sql.raw("")}`.execute(db);
    for (const row of existing.rows) {
        const expected = permissions.find((permission) => permission.code === row.code);
        if (!expected || !Object.entries(expected).every(([key, value]) => row[key] === value)) throw new Error("Notes permission conflicts with existing configuration; explicit reconciliation required");
    }
    return new Set(existing.rows.map((row) => String(row.code)));
}

async function preflightNotesCommands<DB>(db: Kysely<DB>): Promise<void> {
    const foundation = await sql<{ name: string }>`SELECT migration_name_schema_migration AS name FROM conf_schema_migration WHERE migration_name_schema_migration='202610270039_notes_domain'`.execute(db);
    if (foundation.rows.length !== 1) throw new Error("Notes commands require registered foundation 039");
    const existing = await sql<{ table_name: string }>`SELECT TABLE_NAME AS table_name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('int_note_command','int_event_outbox')`.execute(db);
    const column = await sql<{ column_name: string }>`SELECT COLUMN_NAME AS column_name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_note' AND COLUMN_NAME='origin_module_code_note'`.execute(db);
    if (existing.rows.length || column.rows.length) throw new Error("Partial or existing notes commands schema requires explicit recovery");
    const parents = await sql<{ table_name: string }>`SELECT TABLE_NAME AS table_name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(dependencies)}) AND TABLE_TYPE='BASE TABLE' AND ENGINE='InnoDB'`.execute(db);
    if (parents.rows.length !== dependencies.length || !dependencies.every((name) => parents.rows.some((row) => row.table_name === name))) throw new Error("Notes commands require 039 and native InnoDB dependencies");
    const notes = await sql<{ count: number | string }>`SELECT COUNT(*) AS count FROM crm_note`.execute(db);
    if (Number(notes.rows[0]?.count) !== 0) throw new Error("Notes commands require empty crm_note; no module backfill is authorized");
    await checkPermissions(db);
}

/** Stop before DDL on drift. Partial MySQL DDL needs explicit recovery, never adoption.
 * Permissions are definitions only; Owner retains its existing active-permission policy.
 */
export const notesCommandsMigration = {
    name: "202610270040_notes_commands",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Notes commands require CRM_THINK_V2");
        const statements = await loadNotesCommandsStatements();
        await preflightNotesCommands(db);
        for (const statement of statements) await sql.raw(statement).execute(db);
        await db.transaction().execute(async (tx) => {
            const defined = await checkPermissions(tx, true);
            for (const permission of permissions) {
                if (defined.has(permission.code)) continue;
                await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,description_permission,status_permission) VALUES (${permission.code},${permission.module},${permission.action},${permission.description},${permission.status})`.execute(tx);
            }
        });
    },
};
