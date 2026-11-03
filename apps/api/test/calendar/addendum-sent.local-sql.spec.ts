import { randomUUID } from "node:crypto";

import { ConfigService } from "@nestjs/config";
import { Kysely, type KyselyPlugin, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacySalesOrderAddendumWriter } from "../../src/integrations/legacy-crm/legacy-sales-order-addendum.writer.js";
import { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import type { AddendumIdentity } from "../../src/modules/crm/sales/sales-orders/sales-order-addendum.port.js";
import { SalesOrderAddendumRepository } from "../../src/modules/crm/sales/sales-orders/sales-order-addendum.repository.js";

// Fixed disposable QA instance only: no .env, shared host or selectable destination.
describe.skipIf(process.env.RUN_ADDENDUM_SENT_MYSQL_QA !== "3311")("Adendum sent with real SQL and central audit in isolated QA", () => {
    let db: Kysely<CrmDatabase>;
    let audit: RecordAuditService;
    let repository: SalesOrderAddendumRepository;
    const orders: (AddendumIdentity & { internalId: string })[] = [];
    const actors = [ulid(), ulid()] as const;
    const actorIds: number[] = [];
    const databaseQueries = new WeakSet();
    const casePlugin: KyselyPlugin = {
        transformQuery({ node, queryId }) {
            if (node.kind === "RawNode" && "sqlFragments" in node && (node.sqlFragments as string[]).join("").trim() === "SELECT DATABASE() AS name") databaseQueries.add(queryId);
            return node;
        },
        transformResult({ result, queryId }) {
            return Promise.resolve(databaseQueries.has(queryId) ? { ...result, rows: result.rows.map((row) => (row.name === "crm_think_v2" ? { ...row, name: "CRM_THINK_V2" } : row)) } : result);
        },
    };
    beforeAll(async () => {
        db = new Kysely<CrmDatabase>({ dialect: new MysqlDialect({ pool: createPool({ host: "127.0.0.1", port: 3311, user: "root", database: "CRM_THINK_V2", connectionLimit: 5, timezone: "Z" }) }), plugins: [casePlugin] });
        const directory = (await sql<{ directory: string }>`SELECT @@datadir AS directory`.execute(db)).rows[0]?.directory;
        if (!directory?.replaceAll("\\", "/").includes("crm-banks-qa-20261103-3311/")) throw new Error("Requires dedicated disposable QA datadir");
        // Only the disposable fixture is extended; migration072 has already prepared both enums.
        for (const [table, definitions] of [
            ["CRM_THINK_V2.crm_sales_order", ["lead_id_sales_order BIGINT UNSIGNED NULL", "addendum_version_sales_order INT UNSIGNED NOT NULL DEFAULT 0", "addendum_changed_at_sales_order DATETIME(3) NULL", "addendum_note_sales_order TEXT NULL", "updated_by_user_id_sales_order BIGINT UNSIGNED NULL", "updated_at_sales_order DATETIME(3) NULL"]],
            ["crmdatabase-api.ordenventa", ["id_ov_lead INT NULL", "version_adendum_ov INT UNSIGNED NOT NULL DEFAULT 0", "fecha_adendum_ov DATETIME(3) NULL", "nota_adendum_ov TEXT NULL"]],
        ] as const) {
            for (const definition of definitions) {
                const name = definition.split(" ")[0];
                const columns = (await sql<{ Field: string }>`SHOW COLUMNS FROM ${sql.table(table)}`.execute(db)).rows;
                if (!columns.some((column) => column.Field === name)) await sql`ALTER TABLE ${sql.table(table)} ADD COLUMN ${sql.raw(definition)}`.execute(db);
            }
        }
        for (const publicId of actors) {
            const result = await sql`INSERT INTO sec_user(public_id_user,display_name_user,status_user) VALUES (${publicId},'Adendum QA actor','active')`.execute(db);
            actorIds.push(Number(result.insertId));
        }
        const database = { db } as DatabaseService;
        audit = new RecordAuditService(database, new ConfigService({ ENABLE_RECORD_AUDIT: true }));
        await audit.onModuleInit();
        repository = new SalesOrderAddendumRepository(database, audit, new LegacySalesOrderAddendumWriter(new ConfigService({ ENABLE_LEGACY_FALLBACK: true, ENABLE_LEGACY_WRITES: true, LEGACY_CRM_DB_NAME: "crmdatabase-api" })));
    });
    afterAll(async () => {
        for (const order of orders) {
            const schema = order.source === "native" ? "CRM_THINK_V2" : "crmdatabase-api";
            await sql`DELETE e FROM audit_record_event e JOIN audit_record r ON r.id_record=e.record_id_record_event WHERE r.source_schema_record=${schema} AND r.entity_type_record='sales_order' AND r.source_id_record=${order.internalId}`.execute(db);
            await sql`DELETE FROM audit_record WHERE source_schema_record=${schema} AND entity_type_record='sales_order' AND source_id_record=${order.internalId}`.execute(db);
            if (order.source === "native") await sql`DELETE FROM crm_sales_order WHERE public_id_sales_order=${order.id}`.execute(db);
            else await sql`DELETE FROM ${sql.table("crmdatabase-api.ordenventa")} WHERE id_ov=${Number(order.id)}`.execute(db);
        }
        for (const id of actorIds) await sql`DELETE FROM sec_user WHERE id_user=${id}`.execute(db);
        await db.destroy();
    });
    async function order(source: "native" | "legacy") {
        let id = ulid();
        let internalId: string;
        if (source === "native") {
            const inserted = await sql`INSERT INTO crm_sales_order(public_id_sales_order) VALUES (${id})`.execute(db);
            internalId = String(inserted.insertId);
        } else {
            id = String(100000000 + Math.floor(Math.random() * 900000000));
            await sql`INSERT INTO ${sql.table("crmdatabase-api.ordenventa")}(id_ov) VALUES (${Number(id)})`.execute(db);
            internalId = id;
        }
        const target = { source, id, internalId };
        orders.push(target);
        return target;
    }
    async function events(target: (typeof orders)[number]) {
        return (await sql<{ actor: string; after: unknown; changes: unknown }>`SELECT actor_reference_record_event AS actor,after_record_event AS after,changes_record_event AS changes FROM audit_record_event e JOIN audit_record r ON r.id_record=e.record_id_record_event WHERE r.source_schema_record=${target.source === "native" ? "CRM_THINK_V2" : "crmdatabase-api"} AND r.entity_type_record='sales_order' AND r.source_id_record=${target.internalId} ORDER BY sequence_record_event`.execute(db)).rows;
    }
    const marker = (target: AddendumIdentity) => ({ ...target, expectedVersion: 0, operationId: randomUUID(), actorPublicId: actors[0], note: "  Documento bancario requerido  " });
    it.each(["native", "legacy"] as const)("requires a manual reason, records actors and preserves reason/status fields through pending-sent-completed: %s", async (source) => {
        const target = await order(source);
        const pending = marker(target);
        for (const note of [null, " ", "ab", "x".repeat(2001)]) await expect(repository.markManually({ ...pending, note })).rejects.toMatchObject({ status: 400 });
        expect(await events(target)).toHaveLength(0);
        expect(await repository.markManually(pending)).toMatchObject({ status: "pending", version: 1, note: pending.note.trim() });
        const sent = { ...target, status: "sent" as const, expectedVersion: 1, operationId: randomUUID(), actorPublicId: actors[1] };
        expect(await repository.change(sent)).toMatchObject({ status: "sent", version: 2, note: pending.note.trim(), replayed: false });
        expect(await repository.change(sent)).toMatchObject({ status: "sent", version: 2, replayed: true });
        await expect(repository.change({ ...sent, expectedVersion: 0 })).rejects.toMatchObject({ status: 409 });
        expect(await repository.change({ ...sent, status: "completed", expectedVersion: 2, operationId: randomUUID() })).toMatchObject({ status: "completed", version: 3, note: pending.note.trim() });
        const history = await events(target);
        expect(history.map((entry) => entry.actor)).toEqual([actors[0], actors[1], actors[1]]);
        expect(JSON.stringify(history[1]?.changes)).toContain("sent");
        expect(JSON.stringify(history[1]?.after)).toContain(pending.note.trim());
        const saved = await repository.read(target);
        expect(saved).toMatchObject({ active: true, lead: null });
        if (source === "native") expect((await sql`SELECT status_sales_order,cancelled_sales_order,lead_id_sales_order FROM crm_sales_order WHERE id_sales_order=${Number(target.internalId)}`.execute(db)).rows).toEqual([{ status_sales_order: "active", cancelled_sales_order: "no", lead_id_sales_order: null }]);
        else expect((await sql`SELECT status_ov,caida_ov,id_ov_lead FROM ${sql.table("crmdatabase-api.ordenventa")} WHERE id_ov=${Number(target.id)}`.execute(db)).rows).toEqual([{ status_ov: 1, caida_ov: 0, id_ov_lead: null }]);
    });
    it.each(["native", "legacy"] as const)("accepts only one concurrent send at the expected version: %s", async (source) => {
        const target = await order(source);
        await repository.markManually(marker(target));
        const command = { ...target, status: "sent" as const, expectedVersion: 1, actorPublicId: actors[1] };
        const outcomes = await Promise.allSettled([repository.change({ ...command, operationId: randomUUID() }), repository.change({ ...command, operationId: randomUUID() })]);
        expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
        const rejected = outcomes.find((outcome) => outcome.status === "rejected");
        expect(rejected?.status === "rejected" && Reflect.get(Object(rejected.reason), "status")).toBe(409);
        expect(await repository.read(target)).toMatchObject({ status: "sent", version: 2 });
        expect(await events(target)).toHaveLength(2);
    });
    it.each(["native", "legacy"] as const)("rolls back sent and the real inserted audit event after audit failure: %s", async (source) => {
        const target = await order(source);
        await repository.markManually(marker(target));
        const append = audit.append.bind(audit);
        const failure = vi.spyOn(audit, "append").mockImplementationOnce(async (...args) => {
            await append(...args);
            throw new Error("QA injected failure after real audit insert");
        });
        try {
            await expect(repository.change({ ...target, status: "sent", expectedVersion: 1, operationId: randomUUID(), actorPublicId: actors[1] })).rejects.toThrow("QA injected failure");
        } finally {
            failure.mockRestore();
        }
        expect(await repository.read(target)).toMatchObject({ status: "pending", version: 1, note: "Documento bancario requerido" });
        expect(await events(target)).toHaveLength(1);
    });
    it.each(["native", "legacy"] as const)("can send an old pending marker with null reason without backfill: %s", async (source) => {
        const target = await order(source);
        if (source === "native") await sql`UPDATE crm_sales_order SET addendum_status_sales_order='pending' WHERE id_sales_order=${Number(target.internalId)}`.execute(db);
        else await sql`UPDATE ${sql.table("crmdatabase-api.ordenventa")} SET estado_adendum_ov='pending' WHERE id_ov=${Number(target.id)}`.execute(db);
        expect(await repository.change({ ...target, status: "sent", expectedVersion: 0, operationId: randomUUID(), actorPublicId: actors[1] })).toMatchObject({ status: "sent", version: 1, note: null });
        expect(await events(target)).toHaveLength(1);
    });
});
