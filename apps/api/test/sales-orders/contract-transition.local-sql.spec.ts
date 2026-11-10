import { randomInt, randomUUID } from "node:crypto";

import { ConfigService } from "@nestjs/config";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadRecordAuditStatements } from "../../migrations/schema-only/202610220023_record_audit.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacyContractTransitionWriter } from "../../src/integrations/legacy-crm/legacy-contract-transition.writer.js";
import { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import { ContractTransitionRepository } from "../../src/modules/crm/sales/sales-orders/contract-transition.repository.js";

// Explicit loopback-only opt-in. Never load .env or connect to a shared database.
describe.skipIf(process.env.FORMALIZATION_LOCAL_SQL_TESTS !== "1")("Formalization branches on isolated InnoDB", () => {
    let db: Kysely<CrmDatabase>;
    const config = new ConfigService({ ENABLE_RECORD_AUDIT: true, ENABLE_LEGACY_FALLBACK: true, ENABLE_LEGACY_WRITES: true, LEGACY_CRM_DB_NAME: "crmdatabase-api" });
    beforeAll(async () => {
        db = new Kysely<CrmDatabase>({ dialect: new MysqlDialect({ pool: createPool({ host: "127.0.0.1", port: 3309, user: "root", database: "CRM_THINK_V2", connectionLimit: 4 }) }) });
        const path = (await sql<{ path: string }>`SELECT @@datadir AS path`.execute(db)).rows[0]?.path;
        if (!path?.includes("netsuite-events-mariadb-20261102")) throw new Error("Requires the dedicated disposable local datadir");
        // Extend only the existing disposable fixture; preserve the migration/security QA rows.
        await sql`ALTER TABLE sec_user ADD COLUMN IF NOT EXISTS public_id_user CHAR(26) NULL,ADD COLUMN IF NOT EXISTS display_name_user VARCHAR(250) NULL`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS sec_role (id_role BIGINT PRIMARY KEY,code_role VARCHAR(100),name_role VARCHAR(250),status_role VARCHAR(20),deleted_at_role DATETIME NULL) ENGINE=InnoDB`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS sec_user_role (user_id_user_role BIGINT,role_id_user_role BIGINT,status_user_role VARCHAR(20),revoked_at_user_role DATETIME NULL) ENGINE=InnoDB`.execute(db);
        await sql`ALTER TABLE crm_sales_order ADD COLUMN IF NOT EXISTS public_id_sales_order CHAR(26) NULL,ADD COLUMN IF NOT EXISTS native_code_sales_order VARCHAR(180) NULL,ADD COLUMN IF NOT EXISTS updated_by_user_id_sales_order BIGINT NULL`.execute(db);
        const common = sql`sequence_sales_order_state_event INT UNSIGNED NOT NULL,from_state_code_sales_order_state_event VARCHAR(48) NULL,to_state_code_sales_order_state_event VARCHAR(48) NOT NULL,event_kind_sales_order_state_event VARCHAR(32) NOT NULL,effective_at_sales_order_state_event DATETIME(3),actor_snapshot_sales_order_state_event JSON NULL,responsible_snapshot_sales_order_state_event JSON NULL,origin_sales_order_state_event VARCHAR(64),reason_sales_order_state_event VARCHAR(500),operation_id_sales_order_state_event VARCHAR(100),correlation_id_sales_order_state_event VARCHAR(100),CHECK ((sequence_sales_order_state_event=1 AND from_state_code_sales_order_state_event IS NULL) OR (sequence_sales_order_state_event>1 AND from_state_code_sales_order_state_event IS NOT NULL))`;
        await sql`CREATE TABLE IF NOT EXISTS audit_sales_order_state_event (id_sales_order_state_event BIGINT PRIMARY KEY AUTO_INCREMENT,public_id_sales_order_state_event CHAR(26),sales_order_id_sales_order_state_event INT NOT NULL,actor_user_id_sales_order_state_event BIGINT NULL,responsible_user_id_sales_order_state_event BIGINT NULL,${common},UNIQUE KEY uq_sequence(sales_order_id_sales_order_state_event,sequence_sales_order_state_event),UNIQUE KEY uq_operation(sales_order_id_sales_order_state_event,operation_id_sales_order_state_event)) ENGINE=InnoDB`.execute(
            db,
        );
        await sql`CREATE TABLE IF NOT EXISTS ${sql.table("crmdatabase-api.audit_sales_order_state_event")} (id_sales_order_state_event BIGINT PRIMARY KEY AUTO_INCREMENT,legacy_order_id_sales_order_state_event INT NOT NULL,actor_reference_sales_order_state_event VARCHAR(180),responsible_reference_sales_order_state_event VARCHAR(180),${common},UNIQUE KEY uq_sequence(legacy_order_id_sales_order_state_event,sequence_sales_order_state_event),UNIQUE KEY uq_operation(legacy_order_id_sales_order_state_event,operation_id_sales_order_state_event)) ENGINE=InnoDB`.execute(
            db,
        );
        for (const statement of await loadRecordAuditStatements()) await sql.raw(statement).execute(db);
    });
    afterAll(async () => db.destroy());

    async function cleanup(id: number): Promise<void> {
        const records = await sql<{ id: string }>`SELECT id_record FROM audit_record WHERE source_id_record=${String(id)}`.execute(db);
        for (const record of records.rows) {
            await sql`DELETE FROM audit_record_event WHERE record_id_record_event=${record.id}`.execute(db);
            await sql`DELETE FROM audit_record WHERE id_record=${record.id}`.execute(db);
        }
        await sql`DELETE FROM audit_sales_order_state_event WHERE sales_order_id_sales_order_state_event=${id}`.execute(db);
        await sql`DELETE FROM ${sql.table("crmdatabase-api.audit_sales_order_state_event")} WHERE legacy_order_id_sales_order_state_event=${id}`.execute(db);
        await sql`DELETE FROM crm_sales_order_approval WHERE sales_order_id_sales_order_approval=${id}`.execute(db);
        await sql`DELETE FROM crm_sales_order WHERE id_sales_order=${id}`.execute(db);
        await sql`DELETE FROM ${sql.table("crmdatabase-api.ordenventa")} WHERE id_ov=${id}`.execute(db);
        await sql`DELETE FROM sec_user WHERE id_user=${id}`.execute(db);
    }

    async function seed(source: "native" | "legacy", id: number, actor: string, order: string): Promise<void> {
        await sql`INSERT INTO sec_user (id_user,public_id_user,display_name_user,status_user,deleted_at_user) VALUES (${id},${actor},'Local Formalization actor','active',NULL)`.execute(db);
        if (source === "native") {
            await sql`INSERT INTO crm_sales_order (id_sales_order,public_id_sales_order,native_code_sales_order,status_sales_order,cancelled_sales_order,contract_signed_sales_order,unit_transferred_sales_order,keys_delivered_sales_order,unit_delivered_sales_order) VALUES (${id},${order},${order},'active','no','yes','no','no','no')`.execute(db);
            await sql`INSERT INTO crm_sales_order_approval (sales_order_id_sales_order_approval,type_code_sales_order_approval,status_sales_order_approval) VALUES (${id},'formalization','approved')`.execute(db);
        } else await sql`INSERT INTO ${sql.table("crmdatabase-api.ordenventa")} (id_ov,id_ov_netsuite,status_ov,caida_ov,contrado_frima_ov,chekJefeVenta,aprobacion__rdr_ov,aprobacion_forma_ov,unidad_traspasada_ov,entrega_llaves_ov,unidad_entregada_ov) VALUES (${id},${id},1,0,1,0,0,1,0,0,0)`.execute(db);
    }

    async function verifyAudit(id: number, actor: string, purchaseFundsOrigin: string): Promise<void> {
        const events = (await sql<{ changes: string; actor: string; occurred: Date }>`SELECT changes_record_event AS changes,actor_reference_record_event AS actor,occurred_at_record_event AS occurred FROM audit_record_event WHERE source_id_record_event=${String(id)} ORDER BY sequence_record_event`.execute(db)).rows;
        expect(events).toHaveLength(2);
        const event = events[1];
        const changes: unknown = typeof event?.changes === "string" ? JSON.parse(event.changes) : event?.changes;
        expect(changes).toContainEqual(expect.objectContaining({ path: "/purchaseFundsOrigin", before: null, after: purchaseFundsOrigin }));
        expect(event?.actor).toBe(actor);
        expect(event?.occurred).toBeInstanceOf(Date);
    }

    it.each(["native", "legacy"] as const)("gates transfer with locked paid evidence and disallows returning to balance (%s)", async (source) => {
        const id = randomInt(1500000000, 2000000000);
        const actor = ulid();
        const order = ulid();
        const database = { db } as DatabaseService;
        const repo = new ContractTransitionRepository(database, new RecordAuditService(database, config), new LegacyContractTransitionWriter(config));
        try {
            await seed(source, id, actor, order);
            const command = { source, id: source === "native" ? order : String(id), action: "send" as const, expectedSequence: 0, operationId: randomUUID(), actorPublicId: actor, reason: "", ownOnly: false, correlationId: randomUUID() };
            await repo.transition(command);
            await repo.transition({ ...command, action: "set", expectedSequence: 1, operationId: randomUUID(), purchaseFundsOrigin: "own_funds", targetState: "pending_balance" });
            const table = source === "native" ? "crm_sales_order" : "crmdatabase-api.ordenventa";
            const column = source === "native" ? "installments_fully_paid_sales_order" : "cuotas_pagadas_completo_ov";
            const primary = source === "native" ? "id_sales_order" : "id_ov";
            const transfer = { ...command, action: "set" as const, targetState: "pending_transfer" as const, expectedSequence: 2, operationId: randomUUID() };
            await sql`UPDATE ${sql.table(table)} SET ${sql.ref(column)}=${source === "native" ? "no" : 0} WHERE ${sql.ref(primary)}=${id}`.execute(db);
            await expect(repo.transition(transfer)).rejects.toMatchObject({ response: { code: "FORMALIZATION_COMPLETION_FLAGS_REQUIRED" } });
            await sql`UPDATE ${sql.table(table)} SET ${sql.ref(column)}=${source === "native" ? "yes" : 1} WHERE ${sql.ref(primary)}=${id}`.execute(db);
            await expect(repo.transition(transfer)).resolves.toMatchObject({ state: "pending_transfer", sequence: 3 });
            await expect(repo.transition({ ...transfer, targetState: "pending_balance", expectedSequence: 3, operationId: randomUUID(), canSkipStages: true, reason: "exception" })).rejects.toMatchObject({ response: { code: "PENDING_BALANCE_RETURN_FORBIDDEN" } });
            await sql`UPDATE ${sql.table(table)} SET ${sql.ref(column)}=${source === "native" ? "no" : 0} WHERE ${sql.ref(primary)}=${id}`.execute(db);
            await expect(repo.transition({ ...transfer, targetState: "transfer_signed", expectedSequence: 3, operationId: randomUUID() })).rejects.toMatchObject({ response: { code: "FORMALIZATION_COMPLETION_FLAGS_REQUIRED" } });
        } finally {
            await cleanup(id);
        }
    });

    it.each([
        ["native", "own_funds", "pending_balance"],
        ["native", "bank_financing", "bank_management"],
        ["legacy", "own_funds", "pending_balance"],
        ["legacy", "bank_financing", "bank_management"],
    ] as const)("persists route/history/audit and rejects altered retries (%s, %s)", async (source, purchaseFundsOrigin, targetState) => {
        const id = randomInt(1500000000, 2000000000);
        const actor = ulid();
        const order = ulid();
        const database = { db } as DatabaseService;
        const repo = new ContractTransitionRepository(database, new RecordAuditService(database, config), new LegacyContractTransitionWriter(config));
        try {
            await seed(source, id, actor, order);
            const command = { source, id: source === "native" ? order : String(id), action: "send" as const, expectedSequence: 0, operationId: randomUUID(), actorPublicId: actor, reason: "", ownOnly: false, correlationId: randomUUID() };
            await repo.transition(command);
            const selection = { ...command, action: "set" as const, expectedSequence: 1, operationId: randomUUID(), purchaseFundsOrigin, targetState };
            await expect(repo.transition({ ...selection, purchaseFundsOrigin: undefined })).rejects.toMatchObject({ response: { code: "PURCHASE_FUNDS_ORIGIN_REQUIRED" } });
            const failingAudit = new RecordAuditService(database, config);
            const append = failingAudit.append.bind(failingAudit);
            failingAudit.append = async (tx, input) => {
                await append(tx, input);
                throw new Error("forced audit failure");
            };
            const failingRepo = new ContractTransitionRepository(database, failingAudit, new LegacyContractTransitionWriter(config));
            await expect(failingRepo.transition(selection)).rejects.toThrow("forced audit failure");
            const afterRollback = (await sql<{ count: number }>`SELECT COUNT(*) AS count FROM audit_record_event WHERE source_id_record_event=${String(id)}`.execute(db)).rows[0];
            expect(Number(afterRollback?.count)).toBe(1);
            await expect(repo.transition(selection)).resolves.toMatchObject({ state: targetState, sequence: 2, purchaseFundsOrigin });
            await expect(repo.transition(selection)).resolves.toMatchObject({ replayed: true, sequence: 2 });
            await expect(repo.transition({ ...selection, purchaseFundsOrigin: purchaseFundsOrigin === "own_funds" ? "bank_financing" : "own_funds" })).rejects.toThrow("different content");
            const { table, column, primary } = {
                native: { table: "crm_sales_order", column: "purchase_funds_origin_sales_order", primary: "id_sales_order" },
                legacy: { table: "crmdatabase-api.ordenventa", column: "origen_fondos_compra_ov", primary: "id_ov" },
            }[source];
            const stored = (await sql<{ origin: string }>`SELECT ${sql.ref(column)} AS origin FROM ${sql.table(table)} WHERE ${sql.ref(primary)}=${id}`.execute(db)).rows[0];
            expect(stored?.origin).toBe(purchaseFundsOrigin);
            // Later legitimate edits must not change the content used to validate an old retry.
            await sql`UPDATE ${sql.table(table)} SET ${sql.ref(column)}=${purchaseFundsOrigin === "own_funds" ? "bank_financing" : "own_funds"} WHERE ${sql.ref(primary)}=${id}`.execute(db);
            await expect(repo.transition(selection)).resolves.toMatchObject({ replayed: true, purchaseFundsOrigin });
            await verifyAudit(id, actor, purchaseFundsOrigin);
        } finally {
            await cleanup(id);
        }
    });

    it.each(["native", "legacy"] as const)("serializes competing versions and duplicate operation retries (%s)", async (source) => {
        const id = randomInt(1500000000, 2000000000);
        const actor = ulid();
        const order = ulid();
        const database = { db } as DatabaseService;
        const repo = new ContractTransitionRepository(database, new RecordAuditService(database, config), new LegacyContractTransitionWriter(config));
        try {
            await seed(source, id, actor, order);
            const command = { source, id: source === "native" ? order : String(id), action: "send" as const, expectedSequence: 0, operationId: randomUUID(), actorPublicId: actor, reason: "", ownOnly: false, correlationId: randomUUID() };
            const attempts = await Promise.allSettled([repo.transition(command), repo.transition({ ...command, operationId: randomUUID() })]);
            expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
            expect(attempts.filter((attempt) => attempt.status === "rejected")).toHaveLength(1);
            const selection = { ...command, action: "set" as const, targetState: "pending_balance" as const, purchaseFundsOrigin: "own_funds" as const, expectedSequence: 1, operationId: randomUUID() };
            const duplicates = await Promise.all([repo.transition(selection), repo.transition(selection)]);
            expect(duplicates.map((result) => result.sequence)).toEqual([2, 2]);
            expect(duplicates.filter((result) => result.replayed)).toHaveLength(1);
            await verifyAudit(id, actor, "own_funds");
            const table = source === "native" ? "audit_sales_order_state_event" : "crmdatabase-api.audit_sales_order_state_event";
            const parent = source === "native" ? "sales_order_id_sales_order_state_event" : "legacy_order_id_sales_order_state_event";
            const history = (await sql<{ count: number }>`SELECT COUNT(*) AS count FROM ${sql.table(table)} WHERE ${sql.ref(parent)}=${id}`.execute(db)).rows[0];
            expect(Number(history?.count)).toBe(2);
        } finally {
            await cleanup(id);
        }
    });
});
