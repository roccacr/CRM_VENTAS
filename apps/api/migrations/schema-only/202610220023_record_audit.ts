import { readFile } from "node:fs/promises";

import { type Kysely, sql } from "kysely";

import { APPROVED_DATABASE_NAME } from "../../src/config/product.constants.js";
import { readTargetTableNames, splitSqlStatements, stripLineComments } from "./202609250001_identity_schema.js";

/** Loads only the two reviewed CREATE statements, never request-provided SQL. */
export const loadRecordAuditStatements = async (): Promise<string[]> => {
    const source = await readFile(new URL("../../Arquitectura/SQL/023_record_audit.sql", import.meta.url), "utf8");
    const statements = splitSqlStatements(stripLineComments(source));
    const names = readTargetTableNames(statements);
    if (statements.length !== 2 || names[0] !== "audit_record" || names[1] !== "audit_record_event") throw new Error("Record audit requires exactly the two approved CREATE statements");
    return statements;
};

/** Additive native-only audit foundation. Existing business and audit tables remain unchanged. */
export const recordAuditMigration = {
    name: "202610220023_record_audit",
    async up(db: Kysely<unknown>): Promise<void> {
        const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (destination.rows[0]?.name !== APPROVED_DATABASE_NAME) throw new Error("Record audit requires CRM_THINK_V2");
        const statements = await loadRecordAuditStatements();
        const existing = await sql<{ table_name: string }>`SELECT TABLE_NAME AS table_name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${sql.join(readTargetTableNames(statements))})`.execute(db);
        if (existing.rows.length > 0) throw new Error("Existing audit tables require DBA reconciliation before recording this migration");
        for (const statement of statements) await sql.raw(statement).execute(db);
    },
};
