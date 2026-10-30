import { type Kysely, sql } from "kysely";

/** Registers only the reference-system identity used by native note links; no business data or writer is activated. */
export const legacyNoteContextSourceMigration = {
    name: "202610270041_legacy_note_context_source",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        const destination = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db);
        if (destination.rows[0]?.name !== "CRM_THINK_V2") throw new Error("Legacy note context metadata requires CRM_THINK_V2");
        await db.transaction().execute(async (tx) => {
            const existing = await sql<{ name: string; status: string }>`SELECT name_external_system AS name,status_external_system AS status FROM int_external_system WHERE code_external_system=${"legacy_crm"} FOR UPDATE`.execute(tx);
            if (existing.rows.length) {
                if (existing.rows.length !== 1 || existing.rows[0]?.name !== "CRM Legacy" || existing.rows[0].status !== "active") throw new Error("Legacy context source conflicts with existing configuration; explicit reconciliation required");
                return;
            }
            await sql`INSERT INTO int_external_system (code_external_system,name_external_system,status_external_system) SELECT ${"legacy_crm"},${"CRM Legacy"},${"active"} WHERE NOT EXISTS (SELECT 1 FROM int_external_system WHERE code_external_system=${"legacy_crm"})`.execute(tx);
        });
    },
};
