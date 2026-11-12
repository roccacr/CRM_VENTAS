import "reflect-metadata";

import { randomUUID } from "node:crypto";

import { ConfigService } from "@nestjs/config";
import { Kysely, MysqlDialect, sql, type Transaction } from "kysely";
import { createPool } from "mysql2";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { loadRecordAuditStatements } from "../../migrations/schema-only/202610220023_record_audit.js";
import { legacyReservationAppliedDown, legacyReservationAppliedUp, salesOrderReservationAppliedMigration } from "../../migrations/schema-only/202611120075_sales_order_reservation_applied.js";
import { applyLegacyFiniquitoWorkflow, finiquitoWorkflowMigration, rollbackLegacyFiniquitoWorkflow } from "../../migrations/schema-only/202611120076_finiquito_workflow.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacyContractTransitionWriter } from "../../src/integrations/legacy-crm/legacy-contract-transition.writer.js";
import { captureIntegrationAuditActor } from "../../src/modules/crm/audit/audit-actor.js";
import { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import type { ContractOrder, ContractTransitionLegacy } from "../../src/modules/crm/sales/sales-orders/contract-transition.port.js";
import { type ContractTransitionCommand, ContractTransitionRepository } from "../../src/modules/crm/sales/sales-orders/contract-transition.repository.js";
import type { FiniquitoAction, FiniquitoStatus } from "../../src/modules/crm/sales/sales-orders/finiquito.policy.js";
import { finiquitoFields, readFiniquitoFlags } from "../../src/modules/crm/sales/sales-orders/finiquito.storage.js";
import { outsideFiniquito } from "../../src/modules/crm/sales/sales-orders/finiquito-exclusion.query.js";
import { readFiniquitoOverview } from "../../src/modules/crm/sales/sales-orders/finiquito-overview.query.js";

type Source = "native" | "legacy";
const actorId = "01M7695Y3X1ZA6XVQ65WC41SES";
const config = new ConfigService({ ENABLE_RECORD_AUDIT: true, ENABLE_LEGACY_FALLBACK: true, ENABLE_LEGACY_WRITES: true, LEGACY_CRM_DB_NAME: "crmdatabase-api" });

// No usa .env ni destinos configurables: solo el datadir desechable ya identificado del puerto loopback.
describe.skipIf(process.env.FINIQUITO_LOCAL_SQL_TESTS !== "1")("Finiquito: persistencia adversarial InnoDB aislada", () => {
    let admin: Kysely<unknown>;
    let db: Kysely<CrmDatabase>;
    let audit: RecordAuditService;
    let repository: ContractTransitionRepository;

    beforeAll(async () => {
        admin = new Kysely({ dialect: new MysqlDialect({ pool: createPool({ host: "127.0.0.1", port: 3309, user: "root", connectionLimit: 2 }) }) });
        const local = (await sql<{ path: string }>`SELECT @@datadir AS path`.execute(admin)).rows[0]?.path;
        if (!local?.includes("netsuite-events-mariadb-20261102")) throw new Error("Finiquito SQL requiere el datadir desechable autorizado.");
        await sql`CREATE DATABASE IF NOT EXISTS CRM_THINK_V2`.execute(admin);
        await sql`CREATE DATABASE IF NOT EXISTS ${sql.id("crmdatabase-api")}`.execute(admin);
        db = new Kysely<CrmDatabase>({ dialect: new MysqlDialect({ pool: createPool({ host: "127.0.0.1", port: 3309, user: "root", database: "CRM_THINK_V2", connectionLimit: 8 }) }) });
        for (const table of ["audit_record_event", "audit_record", "crm_sales_order_external_reference", "crm_sales_order", "int_netsuite_order_cursor", "sec_user", "crmdatabase-api.ordenventa"]) await sql`DROP TABLE IF EXISTS ${sql.table(table)}`.execute(db);
        await sql`CREATE TABLE crm_sales_order (id_sales_order INT PRIMARY KEY,public_id_sales_order CHAR(26) NOT NULL,native_code_sales_order VARCHAR(50) NOT NULL,id_old_produccion_sales_order INT NULL UNIQUE,deleted_at_sales_order DATETIME NULL,cancelled_sales_order VARCHAR(10) NOT NULL DEFAULT 'yes',contract_signed_sales_order VARCHAR(10) NOT NULL DEFAULT 'no') ENGINE=InnoDB`.execute(db);
        await sql`CREATE TABLE ${sql.table("crmdatabase-api.ordenventa")} (id_ov INT PRIMARY KEY,id_ov_tranid VARCHAR(50),caida_ov INT NULL DEFAULT 1,contrado_frima_ov INT NULL DEFAULT 0,reserva_ov TINYINT UNSIGNED NULL DEFAULT 0) ENGINE=InnoDB`.execute(db);
        await sql`CREATE TABLE crm_sales_order_external_reference (id_sales_order_external_reference INT PRIMARY KEY,sales_order_id_sales_order_external_reference INT,transaction_number_sales_order_external_reference VARCHAR(50)) ENGINE=InnoDB`.execute(db);
        await sql`CREATE TABLE int_netsuite_order_cursor (account_id VARCHAR(30),netsuite_id VARCHAR(30),PRIMARY KEY(account_id,netsuite_id)) ENGINE=InnoDB`.execute(db);
        await sql`CREATE TABLE sec_user (id_user INT PRIMARY KEY,public_id_user CHAR(26),status_user VARCHAR(20),deleted_at_user DATETIME NULL) ENGINE=InnoDB`.execute(db);
        for (const statement of await loadRecordAuditStatements()) await sql.raw(statement).execute(db);
        await sql`CREATE TABLE IF NOT EXISTS conf_schema_migration (migration_name_schema_migration VARCHAR(100) PRIMARY KEY) ENGINE=InnoDB`.execute(db);
        await sql`INSERT IGNORE INTO conf_schema_migration VALUES ('202610220023_record_audit'),('202610220024_record_audit_identifier_collation')`.execute(db);
        await salesOrderReservationAppliedMigration.up(db as unknown as Kysely<unknown>);
        await legacyReservationAppliedUp.execute(db);
        await finiquitoWorkflowMigration.up(db as unknown as Kysely<unknown>);
        await applyLegacyFiniquitoWorkflow(db as unknown as Kysely<unknown>);
        audit = new RecordAuditService({ db } as DatabaseService, config);
        vi.spyOn(audit, "captureActor").mockImplementation(() => Promise.resolve(captureIntegrationAuditActor({ publicId: actorId, name: "Fixture actor" })));
        repository = new ContractTransitionRepository({ db } as DatabaseService, audit, {} as ContractTransitionLegacy, { execute: () => Promise.resolve("synthetic workflow confirmation") });
        const internals = repository as unknown as { resolve(tx: Transaction<CrmDatabase>, command: ContractTransitionCommand): Promise<unknown>; readEvent(): Promise<unknown>; assertOwnerScope(): Promise<void> };
        vi.spyOn(internals, "resolve").mockImplementation(async (tx, command) => {
            const native = command.source === "native";
            const { rows } = await sql<Record<string, unknown>>`SELECT * FROM ${sql.table(tableFor(command.source))} WHERE ${sql.ref(keyFor(command.source))}=${command.id} FOR UPDATE`.execute(tx);
            const row = rows[0];
            if (!row) throw new Error("Orden fixture ausente.");
            const order: ContractOrder = {
                id: String(row[keyFor(command.source)]),
                businessId: "FIXTURE",
                available: true,
                active: false,
                approved: true,
                saleLost: native ? row.cancelled_sales_order === "yes" : row.caida_ov === 1,
                contractSigned: native ? row.contract_signed_sales_order === "yes" : row.contrado_frima_ov === 1,
                reservationApplied: native ? row.reservation_applied_sales_order === "yes" : row.reserva_ov === 1,
                installmentsFullyPaid: null,
                unitTransferred: null,
                unitDelivered: null,
                keysDelivered: null,
            };
            return { source: command.source, order, native: native ? row : undefined };
        });
        vi.spyOn(internals, "readEvent").mockResolvedValue({ state: "bank_management", sequence: 1 });
        vi.spyOn(internals, "assertOwnerScope").mockResolvedValue(undefined);
    }, 30000);

    beforeEach(async () => {
        await sql`DROP TRIGGER IF EXISTS reject_finiquito_audit`.execute(db);
        for (const table of ["audit_record_event", "audit_record", "crm_sales_order_external_reference", "crm_sales_order", "crmdatabase-api.ordenventa", "sec_user"]) await sql`DELETE FROM ${sql.table(table)}`.execute(db);
        await sql`INSERT INTO sec_user VALUES (9,${actorId},'active',NULL)`.execute(db);
    });
    afterAll(async () => {
        await db.destroy();
        await admin.destroy();
    });

    function tableFor(source: Source) {
        return source === "native" ? "crm_sales_order" : "crmdatabase-api.ordenventa";
    }
    function keyFor(source: Source) {
        return source === "native" ? "id_sales_order" : "id_ov";
    }
    function command(source: Source, operationId: string = randomUUID()): ContractTransitionCommand {
        return { source, id: "7", action: "set", operationId, expectedSequence: 0, actorPublicId: actorId, ownOnly: false, reason: "", correlationId: randomUUID() };
    }
    async function seed(source: Source, reservation = true, contract = false) {
        if (source === "native") await sql`INSERT INTO crm_sales_order (id_sales_order,public_id_sales_order,native_code_sales_order,reservation_applied_sales_order,contract_signed_sales_order) VALUES (7,${actorId},'N-7',${reservation ? "yes" : "no"},${contract ? "yes" : "no"})`.execute(db);
        else await sql`INSERT INTO ${sql.table("crmdatabase-api.ordenventa")} (id_ov,id_ov_tranid,reserva_ov,contrado_frima_ov) VALUES (7,'L-7',${Number(reservation)},${Number(contract)})`.execute(db);
    }
    async function change(source: Source, status: FiniquitoAction, expectedVersion: number, operationId?: string) {
        return repository.finiquito(command(source, operationId), { status, expectedVersion });
    }
    async function flags(source: Source) {
        return db.transaction().execute((tx) => readFiniquitoFlags(tx, { source, id: "7" }));
    }
    async function countEvents() {
        return (await sql<{ total: number }>`SELECT COUNT(*) AS total FROM audit_record_event`.execute(db)).rows[0]?.total;
    }
    function overview() {
        const writer = new LegacyContractTransitionWriter(config);
        return db.transaction().execute((tx) => readFiniquitoOverview(tx, writer.finiquitoProjection(tx), { section: "all", page: 1 }));
    }
    async function signContract(source: Source) {
        await sql`UPDATE ${sql.table(tableFor(source))} SET ${sql.ref(source === "native" ? "contract_signed_sales_order" : "contrado_frima_ov")}=${source === "native" ? "yes" : 1} WHERE ${sql.ref(keyFor(source))}=7`.execute(db);
    }
    async function physicalRow(source: Source) {
        const row = (await sql<Record<string, unknown>>`SELECT * FROM ${sql.table(tableFor(source))}`.execute(db)).rows[0];
        if (!row) throw new Error("Orden física ausente.");
        return row;
    }
    function assertAllStamps(row: Record<string, unknown>, source: Source) {
        for (const key of ["balanceValidated", "sent", "received"] as const) {
            const field = finiquitoFields[source][key];
            expect(row[field[1]]).toBe(actorId);
            expect(row[field[2]]).toBeTruthy();
        }
    }

    it.each(["native", "legacy"] as const)("%s: valida sin contrato; exige saldo/contrato, avanza secuencial y conserva NS", async (source) => {
        await seed(source);
        expect(await overview()).toMatchObject({ counts: { validation: 1, pending_send: 0, waiting_signature: 0, formalized: 0 }, total: 1 });
        await expect(change(source, "sent", 0)).rejects.toMatchObject({ status: 409 });
        await expect(change(source, "balance_validated", 0)).resolves.toMatchObject({ balanceValidated: true, status: "pending_send", version: 1 });
        expect(await overview()).toMatchObject({ counts: { validation: 0, pending_send: 0, waiting_checks: 1 }, total: 1 });
        await expect(change(source, "sent", 1)).rejects.toMatchObject({ status: 409 });
        await expect(change(source, "signed", 1)).rejects.toMatchObject({ status: 409 });
        const row = await physicalRow(source);
        expect(row[source === "native" ? "contract_signed_sales_order" : "contrado_frima_ov"]).toBe(source === "native" ? "no" : 0);
        expect(row[finiquitoFields[source].balanceValidated[1]]).toBe(actorId);
        expect(row[finiquitoFields[source].balanceValidated[2]]).toBeTruthy();
        await signContract(source);
        expect(await overview()).toMatchObject({ counts: { pending_send: 1, waiting_checks: 0 }, total: 1 });
        await change(source, "sent", 1);
        expect(await overview()).toMatchObject({ counts: { pending_send: 0, waiting_signature: 1 }, total: 1 });
        await change(source, "signed", 2);
        expect(await overview()).toMatchObject({ counts: { waiting_signature: 0, formalized: 1 }, total: 1 });
        await expect(change(source, "sent", 3)).rejects.toMatchObject({ status: 409 });
        expect(await flags(source)).toEqual({ balanceValidated: true, sent: true, received: true });
        expect(await countEvents()).toBe(3);
        const completed = await physicalRow(source);
        expect(completed[source === "native" ? "cancelled_sales_order" : "caida_ov"]).toBe(source === "native" ? "yes" : 1);
        assertAllStamps(completed, source);
    });

    it.each(["native", "legacy"] as const)("%s: sin reserva no modifica checks ni auditoría", async (source) => {
        await seed(source, false, true);
        await expect(change(source, "balance_validated", 0)).rejects.toMatchObject({ status: 409 });
        expect(await flags(source)).toEqual({ balanceValidated: false, sent: false, received: false });
        expect(await countEvents()).toBe(0);
    });

    it.each(["native", "legacy"] as const)("%s: UUID duplicado, CAS concurrente y replay posterior no duplican", async (source) => {
        await seed(source, true, true);
        const operationId = randomUUID();
        await change(source, "balance_validated", 0, operationId);
        await change(source, "balance_validated", 0, operationId);
        expect(await countEvents()).toBe(1);
        const results = await Promise.allSettled([change(source, "sent", 1), change(source, "sent", 1)]);
        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
        expect(await countEvents()).toBe(2);
        await change(source, "balance_validated", 0, operationId);
        expect(await countEvents()).toBe(2);
        expect(await flags(source)).toEqual({ balanceValidated: true, sent: true, received: false });
    });

    it.each(["native", "legacy"] as const)("%s: error real de auditoría revierte la marca financiera y sus stamps", async (source) => {
        await seed(source, true, true);
        await sql`CREATE TRIGGER reject_finiquito_audit BEFORE INSERT ON audit_record_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture audit failure'`.execute(db);
        await expect(change(source, "balance_validated", 0)).rejects.toThrow("fixture audit failure");
        expect(await flags(source)).toEqual({ balanceValidated: false, sent: false, received: false });
        const row = (await sql<Record<string, unknown>>`SELECT * FROM ${sql.table(tableFor(source))}`.execute(db)).rows[0];
        expect(row?.[finiquitoFields[source].balanceValidated[1]]).toBeNull();
        expect(row?.[finiquitoFields[source].balanceValidated[2]]).toBeNull();
        expect(await countEvents()).toBe(0);
    });

    async function historical(source: Source, status: FiniquitoStatus, id = "7", effectiveNativeId?: string) {
        await db.transaction().execute(async (tx) => {
            await audit.append(tx, {
                source: { schema: source === "native" ? "CRM_THINK_V2" : "crmdatabase-api", table: source === "native" ? "crm_sales_order" : "ordenventa", entity: "sales_order", id },
                ...(effectiveNativeId === undefined ? {} : { effectiveSource: { schema: "CRM_THINK_V2", table: "crm_sales_order", id: effectiveNativeId } }),
                actor: captureIntegrationAuditActor({ publicId: actorId, name: "Old actor" }),
                action: "state_change",
                module: "formalizacion.finiquito",
                before: { finiquitoStatus: "pending_send", finiquitoVersion: 0, finiquitoOriginStage: "bank_management" },
                after: { finiquitoStatus: status, finiquitoVersion: 1, finiquitoOriginStage: "bank_management" },
                allowedFields: ["finiquitoStatus", "finiquitoVersion", "finiquitoOriginStage"],
                operationId: randomUUID(),
                correlationId: randomUUID(),
                snapshotScope: "partial",
            });
        });
    }
    it.each(["native", "legacy"] as const)("%s: historia firmada conserva estado pero jamás infiere saldo validado", async (source) => {
        await seed(source, true, true);
        await historical(source, "signed");
        if (source === "native") {
            await finiquitoWorkflowMigration.down(db as unknown as Kysely<unknown>);
            await finiquitoWorkflowMigration.up(db as unknown as Kysely<unknown>);
        } else {
            await rollbackLegacyFiniquitoWorkflow(db as unknown as Kysely<unknown>);
            await applyLegacyFiniquitoWorkflow(db as unknown as Kysely<unknown>);
        }
        expect(await flags(source)).toEqual({ balanceValidated: false, sent: true, received: true });
        expect(await repository.finiquito(command(source))).toMatchObject({ balanceValidated: false, status: "signed", version: 1 });
        expect(await change(source, "balance_validated", 1)).toMatchObject({ balanceValidated: true, status: "signed", version: 2 });
        expect(await countEvents()).toBe(2);
    });

    it("076 conserva envío histórico del alias nativo sin inferir validación financiera", async () => {
        await seed("native", true, true);
        await sql`UPDATE crm_sales_order SET id_old_produccion_sales_order=9 WHERE id_sales_order=7`.execute(db);
        await historical("legacy", "sent", "9", "7");
        await finiquitoWorkflowMigration.down(db as unknown as Kysely<unknown>);
        await finiquitoWorkflowMigration.up(db as unknown as Kysely<unknown>);
        expect(await flags("native")).toEqual({ balanceValidated: false, sent: true, received: false });
        expect(await change("native", "balance_validated", 1)).toMatchObject({ balanceValidated: true, sent: true, status: "sent", version: 2 });
        expect(await change("native", "signed", 2)).toMatchObject({ received: true, status: "signed", version: 3 });
    });

    it("sin columna obsoleta: banner, elegibilidad y validación legacy conservan reserva_ov", async () => {
        await seed("legacy", true, true);
        await legacyReservationAppliedDown.execute(db);
        try {
            expect(await overview()).toMatchObject({ counts: { validation: 1 }, total: 1 });
            const writer = new LegacyContractTransitionWriter(config);
            expect(await db.transaction().execute((tx) => writer.reservationApplied(tx, "7"))).toBe(true);
            expect(await change("legacy", "balance_validated", 0)).toMatchObject({ balanceValidated: true, status: "pending_send" });
            expect(await overview()).toMatchObject({ counts: { validation: 0, pending_send: 1 }, total: 1 });
            const row = await physicalRow("legacy");
            expect(row.reserva_ov).toBe(1);
            expect(Object.hasOwn(row, "reserva_aplicada_ov")).toBe(false);
        } finally {
            // Otros casos también comprueban contradicciones históricas; esta restauración es solo del fixture.
            await legacyReservationAppliedUp.execute(db);
        }
    });

    it("overview real: ambas fuentes, deduplicación por alias, sin reserva excluida, rama persiste al desmarcar caída", async () => {
        await seed("native", true, false);
        await seed("legacy", true, true);
        await sql`INSERT INTO ${sql.table("crmdatabase-api.ordenventa")} (id_ov,id_ov_tranid,reserva_ov) VALUES (8,'NO-RESERVE',0),(9,'ALIAS',1)`.execute(db);
        // Una copia obsoleta contradictoria no incluye una orden sin reserva ni oculta una reserva vigente.
        await sql`UPDATE ${sql.table("crmdatabase-api.ordenventa")} SET reserva_aplicada_ov=IF(id_ov=8,1,0)`.execute(db);
        await sql`UPDATE crm_sales_order SET id_old_produccion_sales_order=9 WHERE id_sales_order=7`.execute(db);
        const writer = new LegacyContractTransitionWriter(config);
        const read = () => db.transaction().execute((tx) => readFiniquitoOverview(tx, writer.finiquitoProjection(tx), { section: "all", page: 1 }));
        expect(await read()).toMatchObject({ counts: { validation: 2 }, total: 2 });
        await change("native", "balance_validated", 0);
        await sql`UPDATE crm_sales_order SET cancelled_sales_order='no' WHERE id_sales_order=7`.execute(db);
        const result = await sql<{ allowed: number }>`SELECT ${outsideFiniquito("native", sql`7`)} AS allowed`.execute(db);
        expect(result.rows[0]?.allowed).toBe(0);
        expect(await read()).toMatchObject({ counts: { validation: 1, waiting_checks: 1 }, total: 2 });
    });
});
