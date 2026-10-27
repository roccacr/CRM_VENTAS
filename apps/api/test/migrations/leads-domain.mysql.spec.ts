import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { validateEnv } from "../../src/config/env.validation.js";
import { DatabaseService } from "../../src/database/database.service.js";

const tables = ["conf_lead_status", "conf_action_reason", "conf_action_reason_status", "conf_lead_source", "conf_lead_interest", "crm_contact", "crm_lead", "crm_lead_external_reference", "audit_lead_status_event"];

// Read-only metadata verification: no synthetic contacts, users or leads in a shared database.
describe.skipIf(process.env.LEAD_SCHEMA_MYSQL_TESTS !== "1")("lead schema installed in native MySQL (read only)", () => {
    let database: DatabaseService;
    beforeAll(() => {
        config({ quiet: true });
        database = new DatabaseService(new ConfigService(validateEnv(process.env)));
    });
    afterAll(async () => {
        await database.onModuleDestroy();
    });

    it("has nine InnoDB tables and comments on every column", async () => {
        const found = await sql<{ name: string; engine: string; comment: string }>`SELECT TABLE_NAME AS name,ENGINE AS engine,TABLE_COMMENT AS comment FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(tables)})`.execute(database.db);
        expect(found.rows.map((row) => row.name).sort()).toEqual([...tables].sort());
        expect(found.rows.every((row) => row.engine === "InnoDB" && row.comment.length > 0)).toBe(true);
        const missing = await sql`SELECT TABLE_NAME,COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN (${sql.join(tables)}) AND COLUMN_COMMENT=''`.execute(database.db);
        expect(missing.rows).toEqual([]);
    });
    it("links the responsible user by the native sec_user identity without cross-database FKs", async () => {
        const keys = await sql<{ columnName: string; target: string; targetColumn: string; targetSchema: string }>`SELECT COLUMN_NAME AS columnName,REFERENCED_TABLE_NAME AS target,REFERENCED_COLUMN_NAME AS targetColumn,REFERENCED_TABLE_SCHEMA AS targetSchema FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_lead' AND REFERENCED_TABLE_NAME IS NOT NULL`.execute(database.db);
        expect(keys.rows).toContainEqual({ columnName: "owner_user_id_lead", target: "sec_user", targetColumn: "id_user", targetSchema: "CRM_THINK_V2" });
        expect(keys.rows.every((row) => row.targetSchema === "CRM_THINK_V2")).toBe(true);
    });
    it("installs seven stages without pretending to import commercial data", async () => {
        const stages = await database.db.selectFrom("conf_lead_status").select(["code_lead_status", "name_lead_status"]).orderBy("display_order_lead_status").execute();
        expect(stages.map((row) => row.code_lead_status)).toEqual(["interested", "opportunity", "pre_reservation", "reservation", "contract", "lost", "follow_up"]);
    });
    it("has timezone-independent automatic modification triggers", async () => {
        const triggers = await sql<{ statement: string; timing: string; event: string }>`SELECT ACTION_STATEMENT AS statement,ACTION_TIMING AS timing,EVENT_MANIPULATION AS event FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() AND EVENT_OBJECT_TABLE IN (${sql.join(tables)})`.execute(database.db);
        expect(triggers.rows).toHaveLength(8);
        expect(triggers.rows.every((row) => row.timing === "BEFORE" && row.event === "UPDATE" && /utc_timestamp\(3\)/i.test(row.statement))).toBe(true);
    });
    it("enforces one operation/sequence per lead and independent external system identities", async () => {
        const indexes = await sql<{ tableName: string; indexName: string; columns: string }>`SELECT TABLE_NAME AS tableName,INDEX_NAME AS indexName,GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('audit_lead_status_event','crm_lead_external_reference') AND NON_UNIQUE=0 GROUP BY TABLE_NAME,INDEX_NAME`.execute(database.db);
        expect(indexes.rows).toContainEqual({ tableName: "crm_lead_external_reference", indexName: "uq_lead_external", columns: "external_system_id_lead_external_reference,external_id_lead_external_reference" });
        expect(indexes.rows).toContainEqual({ tableName: "audit_lead_status_event", indexName: "uq_lead_event_sequence", columns: "lead_id_lead_status_event,sequence_lead_status_event" });
        expect(indexes.rows).toContainEqual({ tableName: "audit_lead_status_event", indexName: "uq_lead_event_operation", columns: "lead_id_lead_status_event,operation_id_lead_status_event" });
    });
});
