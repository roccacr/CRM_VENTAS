import { type Kysely, sql } from "kysely";

/** Source-aware identity preserves every existing link as native; no business rows are copied or removed. */
export const calendarRelationsMigration = {
    name: "202610290055_calendar_relations",
    async up<DB>(db: Kysely<DB>): Promise<void> {
        const target = (await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name;
        if (target !== "CRM_THINK_V2") throw new Error("Calendar relations require CRM_THINK_V2");
        const foundation = await sql`SELECT migration_name_schema_migration FROM conf_schema_migration WHERE migration_name_schema_migration='202610280051_global_calendar'`.execute(db);
        if (foundation.rows.length !== 1) throw new Error("Calendar relations require registered051");
        const partial = await sql`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_calendar_event_link' AND COLUMN_NAME='source_calendar_event_link'`.execute(db);
        if (partial.rows.length) {
            await verifyCalendarRelationsSchema(db);
            return;
        }
        await sql`ALTER TABLE crm_calendar_event_link
            ADD COLUMN source_calendar_event_link ENUM('native','legacy') NOT NULL DEFAULT 'native' COMMENT 'Origen del registro vinculado; no concede permisos',
            MODIFY COLUMN entity_public_id_calendar_event_link VARCHAR(160) CHARACTER SET ascii COLLATE ascii_bin NOT NULL COMMENT 'Identidad del registro en su origen; validada por existencia y ACL',
            DROP CHECK ck_calendar_link_identity,
            DROP INDEX uq_calendar_link_target,
            ADD UNIQUE KEY uq_calendar_link_target (event_id_calendar_event_link,entity_type_calendar_event_link,source_calendar_event_link,entity_public_id_calendar_event_link),
            ADD CONSTRAINT ck_calendar_link_identity CHECK (entity_type_calendar_event_link REGEXP '^[a-z][a-z0-9_]*$' AND ((source_calendar_event_link='native' AND entity_public_id_calendar_event_link REGEXP '^[0-7][0-9A-HJKMNP-TV-Z]{25}$') OR (source_calendar_event_link='legacy' AND entity_type_calendar_event_link IN ('lead','sales_order') AND entity_public_id_calendar_event_link REGEXP '^[1-9][0-9]{0,19}$')))`.execute(db);
        await verifyCalendarRelationsSchema(db);
    },
};

/** Interrupted DDL is accepted only when all identity constraints match the intended schema. */
// Each independent metadata invariant must pass before accepting interrupted DDL.
// eslint-disable-next-line complexity
async function verifyCalendarRelationsSchema<DB>(db: Kysely<DB>): Promise<void> {
    const columns = (await sql<{ name: string; kind: string; nullable: string; defaultValue: string | null; collation: string | null }>`SELECT COLUMN_NAME AS name,COLUMN_TYPE AS kind,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS defaultValue,COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_calendar_event_link' AND COLUMN_NAME IN ('source_calendar_event_link','entity_public_id_calendar_event_link')`.execute(db)).rows;
    if (!columns.some((c) => c.name === "source_calendar_event_link" && c.kind === "enum('native','legacy')" && c.nullable === "NO" && c.defaultValue === "native") || !columns.some((c) => c.name === "entity_public_id_calendar_event_link" && c.kind === "varchar(160)" && c.nullable === "NO" && c.collation === "ascii_bin")) throw new Error("Calendar relation column drift");
    const indexes = (await sql<{ columns: string; nonUnique: number }>`SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns,NON_UNIQUE AS nonUnique FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_calendar_event_link' AND INDEX_NAME='uq_calendar_link_target' GROUP BY NON_UNIQUE`.execute(db)).rows;
    if (indexes.length !== 1 || Number(indexes[0]?.nonUnique) !== 0 || indexes[0]?.columns !== "event_id_calendar_event_link,entity_type_calendar_event_link,source_calendar_event_link,entity_public_id_calendar_event_link") throw new Error("Calendar relation unique identity drift");
    const checks = (await sql<{ clause: string; enforced: string }>`SELECT c.CHECK_CLAUSE AS clause,t.ENFORCED AS enforced FROM information_schema.CHECK_CONSTRAINTS c JOIN information_schema.TABLE_CONSTRAINTS t ON t.CONSTRAINT_SCHEMA=c.CONSTRAINT_SCHEMA AND t.CONSTRAINT_NAME=c.CONSTRAINT_NAME WHERE t.TABLE_SCHEMA=DATABASE() AND t.TABLE_NAME='crm_calendar_event_link' AND c.CONSTRAINT_NAME='ck_calendar_link_identity'`.execute(db)).rows;
    const check = checks[0];
    const expected = [
        "entity_type_calendar_event_link REGEXP '^[a-z][a-z0-9_]*$' AND ((source_calendar_event_link='native' AND entity_public_id_calendar_event_link REGEXP '^[0-7][0-9A-HJKMNP-TV-Z]{25}$') OR (source_calendar_event_link='legacy' AND entity_type_calendar_event_link IN ('lead','sales_order') AND entity_public_id_calendar_event_link REGEXP '^[1-9][0-9]{0,19}$'))",
        "(regexp_like(`entity_type_calendar_event_link`,_utf8mb4'^[a-z][a-z0-9_]*$') and (((`source_calendar_event_link` = _utf8mb4'native') and regexp_like(`entity_public_id_calendar_event_link`,_utf8mb4'^[0-7][0-9A-HJKMNP-TV-Z]{25}$')) or ((`source_calendar_event_link` = _utf8mb4'legacy') and (`entity_type_calendar_event_link` in (_utf8mb4'lead',_utf8mb4'sales_order')) and regexp_like(`entity_public_id_calendar_event_link`,_utf8mb4'^[1-9][0-9]{0,19}$'))))",
    ].map(normalizeCalendarCheck);
    if (checks.length !== 1 || check?.enforced !== "YES" || !expected.includes(normalizeCalendarCheck(check.clause))) throw new Error("Calendar relation check drift");
}

/** Accept only the authored expression or MySQL's exact rewrite, preserving logical grouping. */
function normalizeCalendarCheck(clause: string): string {
    return clause
        .replaceAll("\\\\'", "'")
        .replaceAll("\\'", "'")
        .replace(/_(?:ascii|utf8mb4)(?=')/g, "")
        .replaceAll("`", "")
        .split(/('[^']*')/)
        .map((token) => (token.startsWith("'") ? token : token.replace(/\s+/g, "").toLowerCase()))
        .join("");
}
