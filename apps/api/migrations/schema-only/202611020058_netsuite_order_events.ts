import { type Kysely, sql } from "kysely";

/** Solo esquema nativo: no altera ordenes ni columnas legacy. */
export const netsuiteOrderEventsMigration = {
    name: "202611020058_netsuite_order_events",
    async up(db: Kysely<unknown>): Promise<void> {
        const database = (await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(db)).rows[0]?.name;
        if (database !== "CRM_THINK_V2") throw new Error("NetSuite event audit requires CRM_THINK_V2");
        await sql`CREATE TABLE IF NOT EXISTS int_netsuite_order_cursor (
            account_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            netsuite_id VARCHAR(15) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            source_modified_ms BIGINT NULL,
            snapshot_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
            PRIMARY KEY(account_id,netsuite_id)
        ) ENGINE=InnoDB COMMENT='NetSuite local event cursor v1'`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS audit_netsuite_order_event (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            account_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            netsuite_id VARCHAR(15) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
            destination ENUM('native','legacy') NULL,
            order_id VARCHAR(20) NULL,
            result ENUM('applied','unchanged','not_found','stale','error') NOT NULL,
            error_message VARCHAR(1000) NULL,
            origin VARCHAR(64) NOT NULL,
            changes JSON NOT NULL,
            payload JSON NOT NULL,
            recorded_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
            INDEX ix_netsuite_event (account_id,netsuite_id,event_id),
            INDEX ix_netsuite_order_time (netsuite_id,recorded_at,id)
        ) ENGINE=InnoDB COMMENT='NetSuite local event audit v1'`.execute(db);
        const rows = (await sql<{ name: string; engine: string; comment: string }>`SELECT TABLE_NAME AS name,ENGINE AS engine,TABLE_COMMENT AS comment FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('int_netsuite_order_cursor','audit_netsuite_order_event')`.execute(db)).rows;
        if (rows.length !== 2 || rows.some((row) => row.engine !== "InnoDB" || !row.comment.endsWith("v1"))) throw new Error("NetSuite audit schema drift");
    },
};
