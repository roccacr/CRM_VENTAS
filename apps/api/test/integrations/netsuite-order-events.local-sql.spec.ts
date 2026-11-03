import "reflect-metadata";

import { randomUUID } from "node:crypto";

import { ConfigService } from "@nestjs/config";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { loadRecordAuditStatements } from "../../migrations/schema-only/202610220023_record_audit.js";
import { netsuiteOrderEventsMigration } from "../../migrations/schema-only/202611020058_netsuite_order_events.js";
import { LocalServiceTokenGuard } from "../../src/common/security/local-service-token.guard.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { NetsuiteLocalEventsController } from "../../src/integrations/netsuite/netsuite-local-events.controller.js";
import type { PersistedOrderEvent } from "../../src/integrations/netsuite/netsuite-order-event.contract.js";
import { orderFieldMappings, orderFlagMappings } from "../../src/integrations/netsuite/netsuite-order-event.mapper.js";
import { NetsuiteOrderEventRepository } from "../../src/integrations/netsuite/netsuite-order-event.repository.js";
import { NetsuiteOrderEventService } from "../../src/integrations/netsuite/netsuite-order-event.service.js";
import { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import { displayOrderHistory } from "../../src/modules/crm/sales/sales-orders/order-history.query.js";

// Solo instancia efimera propia en loopback: nunca lee .env ni conecta al RDS compartido.
describe.skipIf(process.env.NETSUITE_EVENTS_LOCAL_SQL_TESTS !== "1")("NetSuite durable events on isolated InnoDB", () => {
    let db: Kysely<CrmDatabase>;
    let admin: Kysely<unknown>;
    let service: NetsuiteOrderEventService;
    let app: NestFastifyApplication;
    const secret = "a".repeat(64);
    const config = new ConfigService({ NODE_ENV: "development", NETSUITE_LOCAL_EVENTS_PERSIST: true, NETSUITE_LOCAL_EVENTS_ENABLED: true, NETSUITE_LOCAL_EVENTS_SECRET: secret, ENABLE_RECORD_AUDIT: true, ENABLE_LEGACY_FALLBACK: true, ENABLE_LEGACY_WRITES: true });
    function fixtureColumnType(destination: "native" | "legacy", type: (typeof orderFieldMappings)[number]["type"]): string {
        if (destination === "legacy") return type === "checkbox" ? "INT NULL" : "VARCHAR(250) NULL";
        if (type === "decimal") return "DECIMAL(19,4) NULL";
        return type === "date" ? "DATE NULL" : "VARCHAR(20) NULL";
    }

    async function extendFixture(): Promise<void> {
        await sql`ALTER TABLE crm_sales_order ADD COLUMN IF NOT EXISTS cancellation_marked_on_sales_order DATE NULL,ADD COLUMN IF NOT EXISTS status_sales_order VARCHAR(20) NOT NULL DEFAULT 'active'`.execute(db);
        await sql`ALTER TABLE ${sql.table("crmdatabase-api.ordenventa")} ADD COLUMN IF NOT EXISTS envioReservaCaida VARCHAR(100) NULL,ADD COLUMN IF NOT EXISTS status_ov INT NOT NULL DEFAULT 1,ADD COLUMN IF NOT EXISTS reserva_ov INT NOT NULL DEFAULT 0,ADD COLUMN IF NOT EXISTS pagadas_ov INT NOT NULL DEFAULT 0`.execute(db);
        // Ampliacion del fixture propio; no utiliza ni modifica el esquema del RDS.
        for (const destination of ["native", "legacy"] as const) {
            const table = destination === "native" ? "crm_sales_order" : "crmdatabase-api.ordenventa";
            for (const mapping of orderFieldMappings) {
                const definition = fixtureColumnType(destination, mapping.type);
                await sql`ALTER TABLE ${sql.table(table)} ADD COLUMN IF NOT EXISTS ${sql.id(mapping[destination])} ${sql.raw(definition)}`.execute(db);
                await sql`ALTER TABLE ${sql.table(table)} MODIFY COLUMN ${sql.id(mapping[destination])} ${sql.raw(definition)}`.execute(db);
            }
        }
        await sql`ALTER TABLE ${sql.table("crmdatabase-api.ordenventa")} ADD COLUMN IF NOT EXISTS calculo_comision_corredor_ov INT NULL,ADD COLUMN IF NOT EXISTS id_ov_tranid VARCHAR(50) NULL, ADD COLUMN IF NOT EXISTS chekJefeVenta INT NULL, ADD COLUMN IF NOT EXISTS aprobacion__rdr_ov INT NULL, ADD COLUMN IF NOT EXISTS aprobacion_forma_ov INT NULL`.execute(db);
        await sql`ALTER TABLE crm_sales_order_external_reference ADD COLUMN IF NOT EXISTS transaction_number_sales_order_external_reference VARCHAR(180) NULL, ADD COLUMN IF NOT EXISTS updated_at_sales_order_external_reference DATETIME(3) NULL`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS crm_sales_order_approval (sales_order_id_sales_order_approval INT NOT NULL,type_code_sales_order_approval VARCHAR(32) NOT NULL,status_sales_order_approval VARCHAR(20),version_sales_order_approval INT NOT NULL DEFAULT 1,updated_at_sales_order_approval DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),updated_by_user_id_sales_order_approval INT NULL, PRIMARY KEY(sales_order_id_sales_order_approval,type_code_sales_order_approval)) ENGINE=InnoDB`.execute(db);
        await sql`ALTER TABLE crm_sales_order ADD COLUMN IF NOT EXISTS broker_commission_calculated_sales_order VARCHAR(20) NULL,ADD COLUMN IF NOT EXISTS currency_code_sales_order CHAR(3) NULL, ADD COLUMN IF NOT EXISTS lead_id_sales_order BIGINT NULL, ADD COLUMN IF NOT EXISTS unit_file_id_sales_order BIGINT NULL, ADD COLUMN IF NOT EXISTS subsidiary_id_sales_order BIGINT NULL, ADD COLUMN IF NOT EXISTS owner_user_id_sales_order BIGINT NULL`.execute(db);
        await sql`ALTER TABLE ${sql.table("crmdatabase-api.ordenventa")} ADD COLUMN IF NOT EXISTS id_ov_lead INT NULL, ADD COLUMN IF NOT EXISTS idExpediente_ov INT NULL, ADD COLUMN IF NOT EXISTS idsubsidiaria_ov INT NULL, ADD COLUMN IF NOT EXISTS id_ov_admin INT NULL, ADD COLUMN IF NOT EXISTS id_ov_opt INT NULL, ADD COLUMN IF NOT EXISTS id_ov_est INT NULL`.execute(db);
        for (const domain of ["lead", "unit_file", "subsidiary"]) {
            const suffix = domain + "_external_reference";
            await sql`CREATE TABLE IF NOT EXISTS ${sql.id("crm_" + suffix)} (${sql.id(domain + "_id_" + suffix)} INT,${sql.id("external_system_id_" + suffix)} INT,${sql.id("external_id_" + suffix)} VARCHAR(180),${sql.id("status_" + suffix)} VARCHAR(20),${sql.id("deleted_at_" + suffix)} DATETIME NULL) ENGINE=InnoDB`.execute(db);
        }
        await sql`CREATE TABLE IF NOT EXISTS int_user_external_identity (user_id_user_external_identity INT,external_system_id_user_external_identity INT,external_user_id_user_external_identity VARCHAR(180),status_user_external_identity VARCHAR(20),deleted_at_user_external_identity DATETIME NULL) ENGINE=InnoDB`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS audit_sales_order_approval_event (sales_order_id_sales_order_approval_event INT NOT NULL,type_code_sales_order_approval_event VARCHAR(32) NOT NULL,version_sales_order_approval_event INT NOT NULL,before_status_sales_order_approval_event VARCHAR(20) NULL,after_status_sales_order_approval_event VARCHAR(20) NOT NULL,effective_at_sales_order_approval_event DATETIME(3) NULL,actor_user_id_sales_order_approval_event INT NULL,actor_snapshot_sales_order_approval_event JSON NULL,origin_sales_order_approval_event VARCHAR(20),reason_sales_order_approval_event VARCHAR(500),operation_id_sales_order_approval_event VARCHAR(100),correlation_id_sales_order_approval_event VARCHAR(100),UNIQUE KEY uq_event(sales_order_id_sales_order_approval_event,type_code_sales_order_approval_event,version_sales_order_approval_event)) ENGINE=InnoDB`.execute(
            db,
        );
    }

    beforeAll(async () => {
        admin = new Kysely({ dialect: new MysqlDialect({ pool: createPool({ host: "127.0.0.1", port: 3309, user: "root", connectionLimit: 4 }) }) });
        const local = (await sql<{ path: string }>`SELECT @@datadir AS path`.execute(admin)).rows[0]?.path;
        if (!local?.includes("netsuite-events-mariadb-20261102")) throw new Error("SQL fixture requires the dedicated disposable datadir");
        await sql`CREATE DATABASE IF NOT EXISTS CRM_THINK_V2`.execute(admin);
        await sql`CREATE DATABASE IF NOT EXISTS ${sql.id("crmdatabase-api")}`.execute(admin);
        db = new Kysely<CrmDatabase>({ dialect: new MysqlDialect({ pool: createPool({ host: "127.0.0.1", port: 3309, user: "root", database: "CRM_THINK_V2", connectionLimit: 8 }) }) });
        await netsuiteOrderEventsMigration.up(db as unknown as Kysely<unknown>);
        await sql`CREATE TABLE IF NOT EXISTS crm_sales_order (id_sales_order INT PRIMARY KEY, id_old_produccion_sales_order INT NULL UNIQUE,deleted_at_sales_order DATETIME NULL,updated_at_sales_order DATETIME(3) NULL,${sql.join(orderFlagMappings.map((mapping) => sql`${sql.id(mapping.native)} ENUM('yes','no','unknown') NOT NULL DEFAULT 'unknown'`))}) ENGINE=InnoDB`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS int_external_system (id_external_system INT PRIMARY KEY,code_external_system VARCHAR(32),status_external_system VARCHAR(16)) ENGINE=InnoDB`.execute(db);
        // Indices reales de identidad, sin dependencias de otras tablas del CRM.
        await sql`CREATE TABLE IF NOT EXISTS crm_sales_order_external_reference (sales_order_id_sales_order_external_reference INT,external_system_id_sales_order_external_reference INT,external_id_sales_order_external_reference VARCHAR(15),status_sales_order_external_reference VARCHAR(16),UNIQUE KEY ix_reference(external_system_id_sales_order_external_reference,external_id_sales_order_external_reference)) ENGINE=InnoDB`.execute(db);
        await sql`CREATE TABLE IF NOT EXISTS ${sql.table("crmdatabase-api.ordenventa")} (id_ov INT PRIMARY KEY,id_ov_netsuite BIGINT NOT NULL UNIQUE,${sql.join(orderFlagMappings.map((mapping) => sql`${sql.id(mapping.legacy)} INT NULL`))}) ENGINE=InnoDB`.execute(db);
        await extendFixture();
        for (const statement of await loadRecordAuditStatements()) await sql.raw(statement).execute(db);
        await sql`CREATE TABLE IF NOT EXISTS conf_schema_migration (migration_name_schema_migration VARCHAR(100) PRIMARY KEY) ENGINE=InnoDB`.execute(db);
        await sql`INSERT IGNORE INTO conf_schema_migration VALUES ('202610220023_record_audit'),('202610220024_record_audit_identifier_collation')`.execute(db);
        const database = { db } as DatabaseService;
        const repository = new NetsuiteOrderEventRepository(database, config, new RecordAuditService(database, config));
        service = new NetsuiteOrderEventService(repository, config);
        const module = await Test.createTestingModule({ controllers: [NetsuiteLocalEventsController], providers: [LocalServiceTokenGuard, { provide: NetsuiteOrderEventService, useValue: service }, { provide: ConfigService, useValue: config }] }).compile();
        app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
        await app.init();
        await app.getHttpAdapter().getInstance().ready();
    });
    afterAll(async () => {
        await app.close();
        await db.destroy();
        await admin.destroy();
    });
    beforeEach(async () => {
        config.set("NETSUITE_ORDER_CANCELLATION_EFFECTS_ENABLED", false);
        await sql`DROP TRIGGER IF EXISTS fail_order_update`.execute(db);
        await sql`DROP TRIGGER IF EXISTS fail_success_audit`.execute(db);
        for (const table of ["audit_sales_order_approval_event", "crm_sales_order_approval", "audit_record_event", "audit_record", "crm_sales_order_external_reference", "crm_sales_order", "int_external_system", "audit_netsuite_order_event", "int_netsuite_order_cursor", "crmdatabase-api.ordenventa"]) await sql`DELETE FROM ${sql.table(table)}`.execute(db);
        await sql`INSERT INTO int_external_system VALUES (1,'netsuite','active')`.execute(db);
        for (const table of ["crm_lead_external_reference", "crm_unit_file_external_reference", "crm_subsidiary_external_reference", "int_user_external_identity"]) await sql`DELETE FROM ${sql.id(table)}`.execute(db);
    });
    function event(checked = true): PersistedOrderEvent {
        return {
            schemaVersion: 2,
            source: { system: "netsuite", accountId: "4552704_SB1", environment: "sandbox" },
            event: { recordType: "salesorder", netsuiteId: "123", eventType: "edit", observedAt: "2026-11-02T20:00:00.000Z", sourceModifiedAt: "2026-11-02T20:00:00.000Z", snapshotReadStartedAt: "2026-11-02T20:00:00.000Z", snapshotReadCompletedAt: "2026-11-02T20:00:00.100Z", eventId: randomUUID() },
            snapshot: { status: 200, data: { type: "salesorder", id: "123", fields: Object.fromEntries(orderFlagMappings.map((field) => [field.netsuite, checked])), sublists: { item: [] } } },
        };
    }
    function observedEvent(checked: boolean, second: number): PersistedOrderEvent {
        const payload = event(checked);
        Object.assign(payload.event, { snapshotReadStartedAt: `2026-11-02T20:00:${String(second).padStart(2, "0")}.000Z`, snapshotReadCompletedAt: `2026-11-02T20:00:${String(second).padStart(2, "0")}.100Z` });
        return payload;
    }
    function cancellationEvent(marked: boolean, day: number): PersistedOrderEvent {
        const payload = observedEvent(false, 1);
        payload.snapshot.data.fields.custbody43 = marked;
        payload.event.sourceModifiedAt = `2026-11-${String(day).padStart(2, "0")}T20:00:00.000Z`;
        payload.event.snapshotReadStartedAt = `2026-11-${String(day).padStart(2, "0")}T20:00:01.000Z`;
        payload.event.snapshotReadCompletedAt = `2026-11-${String(day).padStart(2, "0")}T20:00:01.100Z`;
        return payload;
    }
    function dateValue(value: unknown): unknown {
        if (!(value instanceof Date)) return value;
        return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
    }
    function expectCancellationDiffs(records: Awaited<ReturnType<typeof audit>>): void {
        expect(records).toHaveLength(4);
        expect(records[0]?.changes).toEqual(expect.arrayContaining([expect.objectContaining({ field: "cancellationMarkedOn", before: null, after: "2026-11-02" })]));
        expect((records[1]?.changes as { field: string }[]).some((change) => change.field === "cancellationMarkedOn")).toBe(false);
        expect((records[2]?.changes as { field: string }[]).some((change) => change.field === "cancellationMarkedOn")).toBe(false);
        expect(records[3]?.changes).toEqual(expect.arrayContaining([expect.objectContaining({ field: "cancellationMarkedOn", before: "2026-11-02", after: "2026-11-05" })]));
    }
    it.each(["native", "legacy"] as const)("rolls back both the cancellation checkbox and its date in %s", async (destination) => {
        config.set("NETSUITE_ORDER_CANCELLATION_EFFECTS_ENABLED", true);
        if (destination === "native") await native();
        else await legacy();
        const table = destination === "native" ? "crm_sales_order" : "crmdatabase-api.ordenventa";
        const trigger = destination === "native" ? "cancel_failure" : "crmdatabase-api.cancel_failure";
        await sql`CREATE TRIGGER ${sql.table(trigger)} BEFORE UPDATE ON ${sql.table(table)} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic cancellation error'`.execute(db);
        try {
            await expect(service.receive(cancellationEvent(true, 2))).rejects.toThrow();
            const row = await flags(destination);
            const expected = destination === "native" ? { cancelled_sales_order: "unknown", cancellation_marked_on_sales_order: null } : { caida_ov: null, envioReservaCaida: null };
            expect(row).toMatchObject(expected);
            expect((await audit())[0]).toMatchObject({ result: "error", destination });
        } finally {
            await sql`DROP TRIGGER ${sql.table(trigger)}`.execute(db);
        }
    });
    it("rejects overlapping reads with different content until a fresh complete observation arrives", async () => {
        await native();
        await service.receive(observedEvent(false, 1));
        await expect(service.receive(observedEvent(true, 1))).rejects.toThrow("ambiguo");
        expect((await flags("native"))?.contract_signed_sales_order).toBe("no");
        expect(await service.receive(observedEvent(true, 2))).toMatchObject({ result: "applied" });
    });
    it.each(["native", "legacy"] as const)("marks, preserves, unmarks and remarks cancellation with dates and native diffs in %s", async (destination) => {
        config.set("NETSUITE_ORDER_CANCELLATION_EFFECTS_ENABLED", true);
        if (destination === "native") await native();
        else await legacy();
        const dateColumn = destination === "native" ? "cancellation_marked_on_sales_order" : "envioReservaCaida";
        const mark = cancellationEvent(true, 2);
        await service.receive(mark);
        expect(dateValue((await flags(destination))?.[dateColumn])).toBe("2026-11-02");
        const other = cancellationEvent(true, 3);
        other.snapshot.data.fields.custbody90 = true;
        await service.receive(other);
        expect(dateValue((await flags(destination))?.[dateColumn])).toBe("2026-11-02");
        await service.receive(cancellationEvent(false, 4));
        expect(dateValue((await flags(destination))?.[dateColumn])).toBe("2026-11-02");
        const remark = cancellationEvent(true, 5);
        await service.receive(remark);
        expect(await service.receive(remark)).toMatchObject({ duplicate: true });
        const row = await flags(destination);
        expect(dateValue(row?.[dateColumn])).toBe("2026-11-05");
        expectCancellationDiffs(await audit());
    });
    it.each(["native", "legacy"] as const)("applies distinct same-minute observations in order and rejects delayed values in %s", async (destination) => {
        if (destination === "native") await native();
        else await legacy();
        const first = observedEvent(false, 1);
        const second = observedEvent(true, 2);
        expect(await service.receive(first)).toMatchObject({ persisted: true });
        expect(await service.receive(second)).toMatchObject({ persisted: true, result: "applied" });
        expect(await service.receive(second)).toMatchObject({ duplicate: true });
        await expect(service.receive(observedEvent(false, 1))).rejects.toThrow("anterior");
        expect((await flags(destination))?.[destination === "native" ? "contract_signed_sales_order" : "contrado_frima_ov"]).toBe(destination === "native" ? "yes" : 1);
    });
    it("does not move the observation cursor backwards for a delayed event with the same content", async () => {
        await native();
        await service.receive(observedEvent(true, 30));
        await expect(service.receive(observedEvent(true, 10))).rejects.toThrow("anterior");
        await expect(service.receive(observedEvent(false, 20))).rejects.toThrow("anterior");
        expect((await flags("native"))?.contract_signed_sales_order).toBe("yes");
    });
    async function native(legacyId: number | null = null) {
        await sql`INSERT INTO crm_sales_order (id_sales_order,id_old_produccion_sales_order) VALUES (1,${legacyId})`.execute(db);
        await sql`INSERT INTO crm_sales_order_external_reference (sales_order_id_sales_order_external_reference,external_system_id_sales_order_external_reference,external_id_sales_order_external_reference,status_sales_order_external_reference) VALUES (1,1,'123','active')`.execute(db);
    }
    async function legacy() {
        await sql`INSERT INTO ${sql.table("crmdatabase-api.ordenventa")} (id_ov,id_ov_netsuite) VALUES (2,123)`.execute(db);
    }
    async function flags(destination: "native" | "legacy") {
        const table = destination === "native" ? "crm_sales_order" : "crmdatabase-api.ordenventa";
        return (await sql<Record<string, unknown>>`SELECT * FROM ${sql.table(table)}`.execute(db)).rows[0];
    }
    async function audit() {
        return (await sql<{ result: string; destination: string | null; changes: unknown; payload: unknown }>`SELECT result,destination,changes,payload FROM audit_netsuite_order_event ORDER BY id`.execute(db)).rows.map((row) => ({ ...row, changes: typeof row.changes === "string" ? (JSON.parse(row.changes) as unknown) : row.changes, payload: typeof row.payload === "string" ? (JSON.parse(row.payload) as unknown) : row.payload }));
    }
    async function expectNativeProjection(row: Record<string, unknown> | undefined): Promise<void> {
        expect(row).toMatchObject({ list_price_sales_order: "125000.1500", net_sale_price_sales_order: "120000.0000", sale_price_sales_order: "130000.0000", advisor_commission_sales_order: "3500.2500", advisor_commission_calculated_sales_order: "yes" });
        const date = row?.transaction_date_sales_order as Date;
        expect([date.getFullYear(), date.getMonth() + 1, date.getDate()]).toEqual([2026, 11, 2]);
        const approvals = (await sql<{ status: string }>`SELECT status_sales_order_approval AS status FROM crm_sales_order_approval ORDER BY type_code_sales_order_approval`.execute(db)).rows;
        expect(approvals.map((approval) => approval.status)).toEqual(["not_approved", "approved", "approved"]);
        expect((await sql`SELECT * FROM audit_sales_order_approval_event`.execute(db)).rows).toHaveLength(3);
        expect((await sql<{ number: string }>`SELECT transaction_number_sales_order_external_reference AS number FROM crm_sales_order_external_reference`.execute(db)).rows[0]?.number).toBe("RDR123");
    }

    it.each(["native", "legacy"] as const)("persists the expanded direct projection, approvals and transaction number in %s atomically", async (destination) => {
        if (destination === "native") await native();
        else await legacy();
        const payload = event();
        Object.assign(payload.snapshot.data.fields, {
            entity: null,
            custbody38: null,
            subsidiary: null,
            crm_owner_employee: null,
            opportunity: null,
            createdfrom: null,
            crm_currency_iso: "USD",
            crm_sync_projection: 1,
            initialtranid: "RDR123",
            custbody74: true,
            custbody73: false,
            custbody13: "125000.15",
            custbody17: "120000",
            custbody_ix_total_amount: "130000",
            custbody21: "3500.25",
            crm_transaction_date: "2026-11-02",
            custbody_aprueba_jefe_ventas: true,
            custbodyid_firma_rocca: false,
            custbodyid_firma_rc: true,
        });
        const response = await app.inject({ method: "POST", url: "/integrations/netsuite/local/order-events", headers: { authorization: "Bearer " + secret }, payload });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ persisted: true, destination, duplicate: false });
        const row = await flags(destination);
        expect(orderFlagMappings.every((mapping) => row?.[mapping[destination]] === (destination === "native" ? "yes" : 1))).toBe(true);
        if (destination === "native") await expectNativeProjection(row);
        else expect(row).toMatchObject({ pre_lista_ov: "125000.1500", prec_ventaneto_ov: "120000.0000", prec_venta_ov: "130000.0000", comison_asesor_ov: "3500.2500", trandate_ov: "2026-11-02", calculo_comision_asesor_ov: 1, chekJefeVenta: 1, aprobacion__rdr_ov: 0, aprobacion_forma_ov: 1, id_ov_tranid: "RDR123" });
        expect((await audit())[0]?.changes).toHaveLength(20);
        const history = (await sql<{ changes: unknown }>`SELECT changes_record_event AS changes FROM audit_record_event`.execute(db)).rows[0];
        expect(displayOrderHistory({ eventKey: "extended", action: "update", changes: history?.changes }).hiddenChanges).toBe(0);
        expect(await service.receive(payload)).toMatchObject({ duplicate: true });
        expect(await audit()).toHaveLength(1);
    });
    it.each(["native", "legacy"] as const)("resolves ERP relationships in %s without writing the related business entities", async (destination) => {
        if (destination === "native") await native();
        else await legacy();
        for (const domain of ["lead", "unit_file", "subsidiary"]) await sql`INSERT INTO ${sql.id("crm_" + domain + "_external_reference")} VALUES (10,1,'900','active',NULL)`.execute(db);
        await sql`INSERT INTO int_user_external_identity VALUES (10,1,'900','active',NULL)`.execute(db);
        const payload = event();
        Object.assign(payload.snapshot.data.fields, {
            crm_currency_iso: "USD",
            crm_sync_projection: 1,
            initialtranid: "RDR123",
            custbody74: false,
            custbody73: false,
            custbody13: null,
            custbody17: null,
            custbody_ix_total_amount: null,
            custbody21: null,
            crm_transaction_date: "2026-11-02",
            custbody_aprueba_jefe_ventas: false,
            custbodyid_firma_rocca: false,
            custbodyid_firma_rc: false,
            entity: "900",
            custbody38: "900",
            subsidiary: "900",
            crm_owner_employee: "900",
            opportunity: "901",
            createdfrom: "902",
        });
        await service.receive(payload);
        const row = await flags(destination);
        const expected = destination === "native" ? { lead_id_sales_order: 10, unit_file_id_sales_order: 10, subsidiary_id_sales_order: 10, owner_user_id_sales_order: 10 } : { id_ov_lead: 900, idExpediente_ov: 900, idsubsidiaria_ov: 900, id_ov_admin: 900, id_ov_opt: 901, id_ov_est: null };
        expect(row).toMatchObject(expected);
    });
    it("retains the attempted direct diff when an unresolved native relationship rejects the event", async () => {
        await native();
        const payload = event();
        Object.assign(payload.snapshot.data.fields, {
            crm_currency_iso: "USD",
            crm_sync_projection: 1,
            initialtranid: "RDR123",
            custbody74: false,
            custbody73: false,
            custbody13: "125",
            custbody17: null,
            custbody_ix_total_amount: null,
            custbody21: null,
            crm_transaction_date: "2026-11-02",
            custbody_aprueba_jefe_ventas: false,
            custbodyid_firma_rocca: false,
            custbodyid_firma_rc: false,
            entity: "999",
            custbody38: null,
            subsidiary: null,
            crm_owner_employee: null,
            opportunity: null,
            createdfrom: null,
        });
        await expect(service.receive(payload)).rejects.toThrow("Relacion ERP nativa ausente");
        expect((await flags("native"))?.contract_signed_sales_order).toBe("unknown");
        const error = (await audit())[0];
        expect(error).toMatchObject({ result: "error", destination: "native" });
        expect(error?.changes).toEqual(expect.arrayContaining([expect.objectContaining({ field: "custbody13", before: null, after: "125.0000" })]));
    });

    it("updates native first, never the legacy duplicate, and audits all ten changes", async () => {
        await native();
        await legacy();
        const payload = event();
        const response = await app.inject({ method: "POST", url: "/integrations/netsuite/local/order-events", headers: { authorization: "Bearer " + secret }, payload });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ persisted: true, destination: "native", result: "applied" });
        const row = await flags("native");
        expect(orderFlagMappings.every((field) => row?.[field.native] === "yes")).toBe(true);
        expect((await flags("legacy"))?.cuotas_pagadas_completo_ov).toBeNull();
        const record = (await audit())[0];
        expect(record?.destination).toBe("native");
        expect(record?.changes).toHaveLength(10);
        expect(record?.payload).toEqual(payload);
        const central = (await sql<{ origin: string; kind: string }>`SELECT origin_record_event AS origin,actor_kind_record_event AS kind FROM audit_record_event`.execute(db)).rows;
        expect(central).toEqual([{ origin: "integration", kind: "service" }]);
        const centralEvent = (await sql<{ changes: unknown }>`SELECT changes_record_event AS changes FROM audit_record_event`.execute(db)).rows[0];
        const history = displayOrderHistory({ eventKey: "test", action: "update", changes: centralEvent?.changes });
        expect(history.changes).toHaveLength(10);
        expect(history.hiddenChanges).toBe(0);
    });
    it("updates only legacy when native is absent; audit remains native", async () => {
        await legacy();
        const payload = event(false);
        const response = await app.inject({ method: "POST", url: "/integrations/netsuite/local/order-events", headers: { authorization: "Bearer " + secret }, payload });
        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({ persisted: true, destination: "legacy" });
        const row = await flags("legacy");
        expect(orderFlagMappings.every((field) => row?.[field.legacy] === 0)).toBe(true);
        expect((await audit())[0]?.changes).toHaveLength(10);
    });
    it("does not create an order when absent in both sources", async () => {
        expect(await service.receive(event())).toMatchObject({ persisted: false, result: "not_found" });
        expect(await flags("native")).toBeUndefined();
        expect(await flags("legacy")).toBeUndefined();
        expect((await audit())[0]?.result).toBe("not_found");
    });
    it("rolls back a failed update and records the error", async () => {
        await native();
        await sql`CREATE TRIGGER fail_order_update BEFORE UPDATE ON crm_sales_order FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic failure'`.execute(db);
        await expect(service.receive(event())).rejects.toThrow();
        expect((await flags("native"))?.contract_signed_sales_order).toBe("unknown");
        expect((await audit())[0]).toMatchObject({ result: "error", destination: "native" });
    });
    it("rolls back legacy too when writing the native audit fails", async () => {
        await legacy();
        await sql`CREATE TRIGGER fail_success_audit BEFORE INSERT ON audit_netsuite_order_event FOR EACH ROW BEGIN IF NEW.result='applied' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic audit failure'; END IF; END`.execute(db);
        await expect(service.receive(event())).rejects.toThrow();
        expect((await flags("legacy"))?.cuotas_pagadas_completo_ov).toBeNull();
        expect((await audit())[0]).toMatchObject({ result: "error", destination: "legacy" });
    });
    it("rolls back business data if the existing central audit fails", async () => {
        await legacy();
        await sql`CREATE TRIGGER fail_central_audit BEFORE INSERT ON audit_record_event FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic central audit failure'`.execute(db);
        try {
            await expect(service.receive(event())).rejects.toThrow();
            expect((await flags("legacy"))?.cuotas_pagadas_completo_ov).toBeNull();
            expect((await audit())[0]).toMatchObject({ result: "error", destination: "legacy" });
        } finally {
            await sql`DROP TRIGGER fail_central_audit`.execute(db);
        }
    });
    it("serializes duplicate concurrent events with one audit and one update", async () => {
        await native();
        const payload = event();
        const results = await Promise.all([service.receive(payload), service.receive(payload)]);
        expect(results.filter((result) => result.duplicate)).toHaveLength(1);
        expect(await audit()).toHaveLength(1);
    });
    it("rejects event ID reuse with a different payload", async () => {
        await native();
        const payload = event();
        await service.receive(payload);
        const other = event(false);
        other.event.eventId = payload.event.eventId;
        await expect(service.receive(other)).rejects.toThrow("otro payload");
        expect((await flags("native"))?.contract_signed_sales_order).toBe("yes");
    });
    it("rejects older observations without overwriting a newer edit", async () => {
        await native();
        await service.receive(event());
        const older = event(false);
        older.event.observedAt = "2026-11-02T21:00:00.000Z";
        older.event.sourceModifiedAt = "2026-11-02T19:00:00.000Z";
        await expect(service.receive(older)).rejects.toThrow("anterior");
        expect((await flags("native"))?.contract_signed_sales_order).toBe("yes");
    });
    it("does not fall back to legacy when an existing native reference is disabled", async () => {
        await native();
        await legacy();
        await sql`UPDATE crm_sales_order_external_reference SET status_sales_order_external_reference='inactive'`.execute(db);
        await expect(service.receive(event())).rejects.toThrow("deshabilitada");
        expect((await flags("legacy"))?.cuotas_pagadas_completo_ov).toBeNull();
    });
    it("preserves the native migrated authority even without its ERP reference", async () => {
        await native(2);
        await legacy();
        await sql`DELETE FROM crm_sales_order_external_reference`.execute(db);
        expect(await service.receive(event())).toMatchObject({ destination: "native" });
        expect((await flags("legacy"))?.cuotas_pagadas_completo_ov).toBeNull();
    });
});
