import { readFile } from "node:fs/promises";

import { type Kysely, sql } from "kysely";

import { readTargetTableNames, splitSqlStatements, stripLineComments } from "./202609250001_identity_schema.js";

const expected = ["crm_note", "crm_note_reply", "crm_note_participant", "crm_note_mention", "crm_note_link", "crm_note_placement", "int_note_external_reference"];
const parents = ["sec_user", "int_external_system", "crm_contact", "crm_lead", "crm_sales_order", "crm_calendar_event"];

/** Reviewed empty schema only: no grants, messages, projection worker or imported notes. */
export async function loadNotesStatements(): Promise<string[]> {
    const source = await readFile(new URL("../../Arquitectura/SQL/039_notes_domain.sql", import.meta.url), "utf8");
    const statements = splitSqlStatements(stripLineComments(source));
    if (statements.length !== expected.length || readTargetTableNames(statements).join(",") !== expected.join(",")) throw new Error("Notes schema requires exactly seven approved tables");
    return statements;
}

/** UTC defaults need no privileged triggers. Stage-two commands must explicitly
 * set updated_at with UTC_TIMESTAMP(3) and never accept authorship changes.
 */
/** Native foundation only. Stop on partial DDL; MySQL cannot roll CREATE TABLE back. */
export const notesDomainMigration = {
    name: "202610270039_notes_domain",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Notes schema requires CRM_THINK_V2");
        const statements = await loadNotesStatements();
        const existing = await sql<{ table_name: string }>`SELECT TABLE_NAME AS table_name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(expected)})`.execute(db);
        if (existing.rows.length) throw new Error("Existing notes tables require explicit recovery before this migration");
        const prerequisites = await sql<{
            table_name: string;
        }>`SELECT t.TABLE_NAME AS table_name FROM information_schema.TABLES t JOIN information_schema.COLUMNS c ON c.TABLE_SCHEMA=t.TABLE_SCHEMA AND c.TABLE_NAME=t.TABLE_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME IN (${sql.join(parents)}) AND t.TABLE_TYPE='BASE TABLE' AND t.ENGINE='InnoDB' AND c.COLUMN_KEY='PRI' AND c.COLUMN_TYPE='bigint unsigned' AND c.COLUMN_NAME=CONCAT('id_',REGEXP_REPLACE(t.TABLE_NAME,'^(sec_|int_|crm_)',''))`.execute(db);
        if (prerequisites.rows.length !== parents.length || !parents.every((parent) => prerequisites.rows.some((row) => row.table_name === parent))) throw new Error("Notes schema requires native InnoDB parent keys");
        for (const statement of statements) await sql.raw(statement).execute(db);
    },
};
