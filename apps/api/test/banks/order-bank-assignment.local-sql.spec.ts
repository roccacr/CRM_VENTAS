import { ConfigService } from "@nestjs/config";
import { Kysely, type KyselyPlugin, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { loadRecordAuditStatements } from "../../migrations/schema-only/202610220023_record_audit.js";
import { salesOrderBankAssignmentMigration } from "../../migrations/schema-only/202611030069_sales_order_bank_assignment.js";
import { salesOrderBankAssignmentUnlinkMigration } from "../../migrations/schema-only/202611030071_sales_order_bank_assignment_unlink.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacyOrderBankAssignmentReader } from "../../src/integrations/legacy-crm/legacy-order-bank-assignment.reader.js";
import { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import { BanksRepository } from "../../src/modules/crm/banks/banks.repository.js";
import { OrderBankAssignmentRepository } from "../../src/modules/crm/sales/sales-orders/order-bank-assignment.repository.js";

// QA exclusiva: nunca lee .env ni permite elegir host, usuario o puerto del RDS.
describe.skipIf(process.env.RUN_BANK_ASSIGNMENT_MYSQL_QA !== "3311")("Asignación bancaria con SQL y bitácora reales en QA aislada", () => {
    let db: Kysely<CrmDatabase>;
    let audit: RecordAuditService;
    let repository: OrderBankAssignmentRepository;
    const orders: { source: "native" | "legacy"; id: string; internalId: string }[] = [];
    const banks: string[] = [];
    const actorPublicId = "01K8M000000000000000000001";
    // Windows/MariaDB pliega DATABASE(). Solo adapta esa proyección de metadatos
    // al nombre canónico; todas las consultas, transacciones y escrituras son reales.
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
        if (!directory?.includes("crm-banks-qa-20261103-3311")) throw new Error("Se requiere datadir exclusivo QA Bancos");
        const existing = (await sql`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='crm_sales_order_bank_assignment'`.execute(db)).rows;
        if (!existing.length) await salesOrderBankAssignmentMigration.up(db as unknown as Kysely<unknown>);
        await salesOrderBankAssignmentUnlinkMigration.up(db as unknown as Kysely<unknown>);
        await salesOrderBankAssignmentUnlinkMigration.up(db as unknown as Kysely<unknown>);
        for (const statement of await loadRecordAuditStatements()) await sql.raw(statement).execute(db);
        await sql`INSERT IGNORE INTO conf_schema_migration(migration_name_schema_migration) VALUES ('202610220023_record_audit'),('202610220024_record_audit_identifier_collation')`.execute(db);
        // Proyección mínima de autoridad, sin importar registros comerciales ni ejecutar la cadena de migraciones.
        await sql`CREATE TABLE IF NOT EXISTS crm_sales_order (id_sales_order BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,public_id_sales_order CHAR(26) NOT NULL UNIQUE,id_old_produccion_sales_order INT NULL UNIQUE,status_sales_order VARCHAR(10) NOT NULL DEFAULT 'active',cancelled_sales_order VARCHAR(10) NOT NULL DEFAULT 'no',deleted_at_sales_order DATETIME(3) NULL) ENGINE=InnoDB`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS int_external_system (id_external_system BIGINT UNSIGNED PRIMARY KEY,code_external_system VARCHAR(64),status_external_system VARCHAR(10)) ENGINE=InnoDB`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS crm_sales_order_external_reference (sales_order_id_sales_order_external_reference BIGINT UNSIGNED,external_system_id_sales_order_external_reference BIGINT UNSIGNED,external_id_sales_order_external_reference VARCHAR(180),status_sales_order_external_reference VARCHAR(10)) ENGINE=InnoDB`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS \`crmdatabase-api\`.ordenventa (id_ov INT PRIMARY KEY,status_ov INT NOT NULL DEFAULT 1,caida_ov INT NOT NULL DEFAULT 0) ENGINE=InnoDB`.execute(db);
        const database = { db } as DatabaseService;
        audit = new RecordAuditService(database, new ConfigService({ ENABLE_RECORD_AUDIT: true }));
        const bankReader = new BanksRepository(database, {} as never);
        repository = new OrderBankAssignmentRepository(database, audit, bankReader, new LegacyOrderBankAssignmentReader(new ConfigService({ ENABLE_LEGACY_FALLBACK: true, LEGACY_CRM_DB_NAME: "crmdatabase-api" })));
    });
    afterAll(async () => {
        // Solo IDs creados por esta corrida; jamás limpia tablas completas ni registros compartidos.
        for (const order of orders) {
            await sql`DELETE FROM crm_sales_order_bank_assignment WHERE source_bank_assignment=${order.source} AND order_id_bank_assignment=${order.id}`.execute(db);
            const schema = order.source === "native" ? "CRM_THINK_V2" : "crmdatabase-api";
            await sql`DELETE e FROM audit_record_event e JOIN audit_record r ON r.id_record=e.record_id_record_event WHERE r.source_schema_record=${schema} AND r.entity_type_record='sales_order' AND r.source_id_record=${order.internalId}`.execute(db);
            await sql`DELETE FROM audit_record WHERE source_schema_record=${schema} AND entity_type_record='sales_order' AND source_id_record=${order.internalId}`.execute(db);
            if (order.source === "native") await sql`DELETE FROM crm_sales_order WHERE public_id_sales_order=${order.id}`.execute(db);
            else await sql`DELETE FROM \`crmdatabase-api\`.ordenventa WHERE id_ov=${Number(order.id)}`.execute(db);
        }
        if (banks.length) {
            await sql`DELETE a FROM crm_bank_advisor a JOIN crm_bank b ON b.id_bank=a.bank_id_bank_advisor WHERE b.public_id_bank IN (${sql.join(banks)})`.execute(db);
            await sql`DELETE FROM crm_bank WHERE public_id_bank IN (${sql.join(banks)})`.execute(db);
        }
        await db.destroy();
    });
    async function order(source: "native" | "legacy" = "native") {
        let id = ulid();
        let internalId: string;
        if (source === "native") {
            const result = await sql`INSERT INTO crm_sales_order(public_id_sales_order) VALUES (${id})`.execute(db);
            internalId = String(result.insertId);
        } else {
            id = String(100000000 + Math.floor(Math.random() * 900000000));
            await sql`INSERT INTO \`crmdatabase-api\`.ordenventa(id_ov) VALUES (${Number(id)})`.execute(db);
            internalId = id;
        }
        const identity = { source, id, internalId };
        orders.push(identity);
        return identity;
    }
    async function contact() {
        const bankPublicId = ulid();
        const advisorPublicId = ulid();
        banks.push(bankPublicId);
        await sql`INSERT INTO crm_bank(public_id_bank,name_bank) VALUES (${bankPublicId},${`QA ${bankPublicId}`})`.execute(db);
        await sql`INSERT INTO crm_bank_advisor(public_id_bank_advisor,bank_id_bank_advisor,name_bank_advisor,email_bank_advisor,phone_bank_advisor,area_bank_advisor) SELECT ${advisorPublicId},id_bank,'QA Ejecutivo',${`${advisorPublicId}@example.invalid`},'88888888','Crédito' FROM crm_bank WHERE public_id_bank=${bankPublicId}`.execute(db);
        return { bankPublicId, advisorPublicId, actorPublicId, reason: "Asignación QA aislada", expectedVersion: 0 };
    }
    it.each(["native", "legacy"] as const)("guarda y reabre %s con actor y diff en bitácora central", async (source) => {
        const target = await order(source);
        const command = await contact();
        expect(await repository.read(target)).toMatchObject({ version: 0, bank: null, advisor: null });
        const saved = await repository.change(target, command);
        expect(saved).toMatchObject({ source, id: target.id, version: 1, bank: { publicId: command.bankPublicId }, advisor: { publicId: command.advisorPublicId } });
        expect(await repository.read(target)).toEqual(saved);
        const event = (await sql<{ actor: string; changes: unknown }>`SELECT actor_reference_record_event AS actor,changes_record_event AS changes FROM audit_record_event e JOIN audit_record r ON r.id_record=e.record_id_record_event WHERE source_schema_record=${source === "native" ? "CRM_THINK_V2" : "crmdatabase-api"} AND source_id_record=${target.internalId}`.execute(db)).rows[0];
        expect(event?.actor).toBe(actorPublicId);
        expect(JSON.stringify(event?.changes)).toContain(command.bankPublicId);
        if (source === "legacy") expect((await sql`SELECT status_ov,caida_ov FROM \`crmdatabase-api\`.ordenventa WHERE id_ov=${Number(target.id)}`.execute(db)).rows).toEqual([{ status_ov: 1, caida_ov: 0 }]);
    });
    it("rechaza ejecutivo de otro banco", async () => {
        const target = await order();
        const first = await contact();
        const second = await contact();
        await expect(repository.change(target, { ...first, advisorPublicId: second.advisorPublicId })).rejects.toMatchObject({ status: 409 });
        expect(await repository.read(target)).toMatchObject({ version: 0 });
    });
    it.each(["bank", "advisor"] as const)("rechaza %s inactivo", async (kind) => {
        const target = await order();
        const command = await contact();
        if (kind === "bank") await sql`UPDATE crm_bank SET status_bank='inactive' WHERE public_id_bank=${command.bankPublicId}`.execute(db);
        else await sql`UPDATE crm_bank_advisor SET status_bank_advisor='inactive' WHERE public_id_bank_advisor=${command.advisorPublicId}`.execute(db);
        await expect(repository.change(target, command)).rejects.toMatchObject({ status: 409 });
        expect(await repository.read(target)).toMatchObject({ version: 0 });
    });
    it("dos asignaciones concurrentes solo aceptan una versión", async () => {
        const target = await order();
        const command = await contact();
        const outcomes = await Promise.allSettled([repository.change(target, command), repository.change(target, command)]);
        expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
        expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
        expect(await repository.read(target)).toMatchObject({ version: 1 });
    });
    it("permite reasignar y rechaza versión anterior sin sobrescribir", async () => {
        const target = await order();
        const first = await contact();
        const second = await contact();
        await repository.change(target, first);
        await repository.change(target, { ...second, expectedVersion: 1 });
        await expect(repository.change(target, { ...first, expectedVersion: 1 })).rejects.toMatchObject({ status: 409 });
        expect(await repository.read(target)).toMatchObject({ version: 2, bank: { publicId: second.bankPublicId } });
    });
    it("un fallo después del INSERT real de bitácora revierte asignación e historial", async () => {
        const target = await order();
        const command = await contact();
        const append = audit.append.bind(audit);
        const fault = vi.spyOn(audit, "append").mockImplementationOnce(async (...args) => {
            await append(...args);
            throw new Error("QA fallo posterior a bitácora");
        });
        try {
            await expect(repository.change(target, command)).rejects.toThrow("QA fallo posterior");
        } finally {
            fault.mockRestore();
        }
        expect(await repository.read(target)).toMatchObject({ version: 0 });
        expect((await sql`SELECT id_record FROM audit_record WHERE source_schema_record='CRM_THINK_V2' AND source_id_record=${target.internalId}`.execute(db)).rows).toHaveLength(0);
    });
    it("alias legacy de orden nativa usa una sola asignación canónica", async () => {
        const target = await order();
        const old = await order("legacy");
        await sql`UPDATE crm_sales_order SET id_old_produccion_sales_order=${Number(old.id)} WHERE public_id_sales_order=${target.id}`.execute(db);
        const saved = await repository.change(old, await contact());
        expect(saved).toMatchObject({ source: "native", id: target.id, version: 1 });
        expect(await repository.read(target)).toEqual(saved);
    });
    it("autoridad nativa inactiva no cae a la copia legacy", async () => {
        const target = await order();
        const old = await order("legacy");
        await sql`UPDATE crm_sales_order SET id_old_produccion_sales_order=${Number(old.id)},status_sales_order='inactive' WHERE public_id_sales_order=${target.id}`.execute(db);
        await expect(repository.change(old, await contact())).rejects.toMatchObject({ status: 404 });
    });
    it("orden inexistente no crea asignación", async () => {
        await expect(repository.change({ source: "native", id: ulid() }, await contact())).rejects.toMatchObject({ status: 404 });
    });
    it.each(["native", "legacy"] as const)("desvincula %s conservando fila, versión y bitácora", async (source) => {
        const target = await order(source);
        await repository.change(target, await contact());
        const cleared = await repository.unlink(target, { actorPublicId, expectedVersion: 1, reason: "Desvinculación QA aislada" });
        expect(cleared).toMatchObject({ source, id: target.id, version: 2, bank: null, advisor: null });
        expect(cleared.changedAt).toEqual(expect.any(String));
        expect(await repository.read(target)).toEqual(cleared);
        expect((await sql`SELECT bank_id_bank_assignment AS bankId,advisor_id_bank_assignment AS advisorId,version_bank_assignment AS version FROM crm_sales_order_bank_assignment WHERE source_bank_assignment=${source} AND order_id_bank_assignment=${target.id}`.execute(db)).rows).toEqual([{ bankId: null, advisorId: null, version: 2 }]);
        const events = (await sql<{ sequence: number; snapshot: unknown }>`SELECT sequence_record_event AS sequence,after_record_event AS snapshot FROM audit_record_event e JOIN audit_record r ON r.id_record=e.record_id_record_event WHERE source_schema_record=${source === "native" ? "CRM_THINK_V2" : "crmdatabase-api"} AND source_id_record=${target.internalId} ORDER BY sequence_record_event`.execute(db)).rows;
        expect(events).toHaveLength(2);
        const snapshot: unknown = typeof events[1]?.snapshot === "string" ? JSON.parse(events[1].snapshot) : events[1]?.snapshot;
        expect(snapshot).toMatchObject({ bankAssignment: { version: 2, bank: null, advisor: null } });
    });
    it("quitar y reasignar no reinicia versiones ni acepta un formulario antiguo", async () => {
        const target = await order();
        const first = await contact();
        const second = await contact();
        await repository.change(target, first);
        await repository.unlink(target, { actorPublicId, expectedVersion: 1, reason: "Cambiar gestión bancaria QA" });
        const reassigned = await repository.change(target, { ...second, expectedVersion: 2 });
        expect(reassigned).toMatchObject({ version: 3, bank: { publicId: second.bankPublicId } });
        await expect(repository.change(target, { ...first, expectedVersion: 1 })).rejects.toMatchObject({ status: 409 });
        await expect(repository.unlink(target, { actorPublicId, expectedVersion: 1, reason: "Formulario anterior QA" })).rejects.toMatchObject({ status: 409 });
        expect(await repository.read(target)).toEqual(reassigned);
    });
    it("dos desvinculaciones concurrentes solo confirman una", async () => {
        const target = await order();
        await repository.change(target, await contact());
        const command = { actorPublicId, expectedVersion: 1, reason: "Desvinculación concurrente QA" };
        const outcomes = await Promise.allSettled([repository.unlink(target, command), repository.unlink(target, command)]);
        expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
        expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
        expect(await repository.read(target)).toMatchObject({ version: 2, bank: null, advisor: null });
    });
    it("fallar después de escribir bitácora revierte también la desvinculación", async () => {
        const target = await order();
        const command = await contact();
        await repository.change(target, command);
        const append = audit.append.bind(audit);
        const fault = vi.spyOn(audit, "append").mockImplementationOnce(async (...args) => {
            await append(...args);
            throw new Error("QA rollback de desvinculación");
        });
        try {
            await expect(repository.unlink(target, { actorPublicId, expectedVersion: 1, reason: "Rollback unlink QA" })).rejects.toThrow("QA rollback");
        } finally {
            fault.mockRestore();
        }
        expect(await repository.read(target)).toMatchObject({ version: 1, bank: { publicId: command.bankPublicId }, advisor: { publicId: command.advisorPublicId } });
        expect((await sql`SELECT e.id_record_event FROM audit_record_event e JOIN audit_record r ON r.id_record=e.record_id_record_event WHERE source_schema_record='CRM_THINK_V2' AND source_id_record=${target.internalId}`.execute(db)).rows).toHaveLength(1);
    });
    it("permite quitar un banco posteriormente inactivado y rechaza quitar de nuevo", async () => {
        const target = await order();
        const command = await contact();
        await repository.change(target, command);
        await sql`UPDATE crm_bank SET status_bank='inactive' WHERE public_id_bank=${command.bankPublicId}`.execute(db);
        expect(await repository.unlink(target, { actorPublicId, expectedVersion: 1, reason: "Banco inactivo QA" })).toMatchObject({ version: 2, bank: null });
        await expect(repository.unlink(target, { actorPublicId, expectedVersion: 2, reason: "Ya desvinculado QA" })).rejects.toMatchObject({ status: 409 });
        expect(await repository.read(target)).toMatchObject({ version: 2 });
    });
    it("la BD impide dejar solo una mitad de la relación", async () => {
        const target = await order();
        const assigned = await repository.change(target, await contact());
        await expect(sql`UPDATE crm_sales_order_bank_assignment SET bank_id_bank_assignment=NULL WHERE source_bank_assignment=${target.source} AND order_id_bank_assignment=${target.id}`.execute(db)).rejects.toThrow();
        await expect(sql`UPDATE crm_sales_order_bank_assignment SET advisor_id_bank_assignment=NULL WHERE source_bank_assignment=${target.source} AND order_id_bank_assignment=${target.id}`.execute(db)).rejects.toThrow();
        expect(await repository.read(target)).toEqual(assigned);
    });
});
