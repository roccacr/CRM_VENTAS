import { ConfigService } from "@nestjs/config";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { PersistedOrderEvent } from "../../src/integrations/netsuite/netsuite-order-event.contract.js";
import { orderFlagMappings } from "../../src/integrations/netsuite/netsuite-order-event.mapper.js";
import { NetsuiteOrderEventRepository } from "../../src/integrations/netsuite/netsuite-order-event.repository.js";
import { NetsuiteOrderEventService } from "../../src/integrations/netsuite/netsuite-order-event.service.js";
import type { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";

it.each(["native", "legacy"] as const)("persists custbody37 in the authoritative %s table and audit within one transaction", async (destination) => {
    const queries: CompiledQuery[] = [];
    const driver = new DummyDriver();
    const column = destination === "native" ? "purchase_funds_origin_sales_order" : "origen_fondos_compra_ov";
    const flags = Object.fromEntries(orderFlagMappings.map((mapping) => [mapping[destination], destination === "native" ? "no" : 0]));
    const row = { ...flags, [column]: null, id_sales_order: 42, id_ov: 42, deleted_at_sales_order: null, referenceStatus: "active", integrationStatus: "active", advisor_commission_calculated_sales_order: "no", calculo_comision_asesor_ov: 0, id_ov_tranid: "RDR673", chekJefeVenta: 0, aprobacion__rdr_ov: 0, aprobacion_forma_ov: 0 };
    const approvals = ["sales_management", "developer", "formalization"].map((code) => ({ type_code_sales_order_approval: code, status_sales_order_approval: "not_approved", version_sales_order_approval: 1 }));
    driver.acquireConnection = () =>
        Promise.resolve({
            executeQuery: <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                let rows: unknown[] = [];
                if (query.sql.includes("SELECT source_modified_ms")) rows = [{ observed: null, hash: null }];
                if (query.sql.includes("SELECT o.*")) rows = destination === "native" ? [row] : [];
                if (query.sql.startsWith("SELECT * FROM `crmdatabase-api`.`ordenventa`")) rows = [row];
                if (query.sql.includes("SELECT x.transaction_number")) rows = [{ transaction_number_sales_order_external_reference: "RDR673" }];
                if (query.sql.includes("from `crm_sales_order_approval`")) rows = approvals;
                return Promise.resolve({ rows: rows as R[] });
            },
            async *streamQuery() {
                yield await Promise.resolve({ rows: [] });
            },
        });
    const commit = vi.spyOn(driver, "commitTransaction");
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const audit = { enabled: true, append: vi.fn().mockResolvedValue({ sequence: 1 }) };
    const repository = new NetsuiteOrderEventRepository({ db } as DatabaseService, new ConfigService({ ENABLE_LEGACY_FALLBACK: true, ENABLE_LEGACY_WRITES: true }), audit as unknown as RecordAuditService);
    const fields = { ...Object.fromEntries(orderFlagMappings.map((mapping) => [mapping.netsuite, false])), custbody37: "2", crm_sync_projection: 1, initialtranid: "RDR673", custbody74: false, custbody13: null, custbody17: null, custbody_ix_total_amount: null, custbody21: null, crm_transaction_date: null, custbody_aprueba_jefe_ventas: false, custbodyid_firma_rocca: false, custbodyid_firma_rc: false, entity: null, custbody38: null, subsidiary: null, opportunity: null, crm_owner_employee: null };
    const event: PersistedOrderEvent = { schemaVersion: 2, source: { system: "netsuite", accountId: "4552704_SB1", environment: "sandbox" }, event: { recordType: "salesorder", netsuiteId: "123", eventType: "create", eventId: "550e8400-e29b-41d4-a716-446655440000", observedAt: "2026-11-03T10:00:00.000Z", sourceModifiedAt: "2026-11-03T09:00:00.000Z" }, snapshot: { status: 200, data: { type: "salesorder", id: "123", fields, sublists: { item: [] } } } };
    try {
        const result = await repository.apply(event, { payloadHash: "test-payload", snapshotHash: "test-snapshot" });
        expect(result).toMatchObject({ result: "applied", destination });
        const update = queries.find((query) => query.sql.startsWith(destination === "native" ? "UPDATE `crm_sales_order`" : "UPDATE `crmdatabase-api`.`ordenventa`"));
        expect(update?.sql).toContain("`" + column + "`=?");
        expect(update?.parameters).toContain("bank_financing");
        expect(audit.append).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ after: { purchase_funds_origin_sales_order: "bank_financing" } }));
        expect(commit).toHaveBeenCalledOnce();
    } finally {
        await db.destroy();
    }
});

it("distinguishes preserve from clear in the ordering hash while keeping numeric and string IDs equivalent", async () => {
    const apply = vi.fn().mockResolvedValue({ result: "unchanged", destination: "native", duplicate: false });
    const service = new NetsuiteOrderEventService({ apply } as unknown as NetsuiteOrderEventRepository, new ConfigService({ NODE_ENV: "development", NETSUITE_LOCAL_EVENTS_ENABLED: true, NETSUITE_LOCAL_EVENTS_PERSIST: true }));
    const baseFields = { ...Object.fromEntries(orderFlagMappings.map((mapping) => [mapping.netsuite, false])), crm_sync_projection: 1, initialtranid: "RDR673", custbody74: false, custbody13: null, custbody17: null, custbody_ix_total_amount: null, custbody21: null, crm_transaction_date: null, custbody_aprueba_jefe_ventas: false, custbodyid_firma_rocca: false, custbodyid_firma_rc: false, entity: null, custbody38: null, subsidiary: null, opportunity: null, crm_owner_employee: null };
    for (const funds of [{}, { custbody37: null }, { custbody37: "" }, { custbody37: 1 }, { custbody37: "1" }]) {
        const event: PersistedOrderEvent = { schemaVersion: 2, source: { system: "netsuite", accountId: "4552704_SB1", environment: "sandbox" }, event: { recordType: "salesorder", netsuiteId: "123", eventType: "create", eventId: "550e8400-e29b-41d4-a716-446655440000", observedAt: "2026-11-03T10:00:00.000Z", sourceModifiedAt: "2026-11-03T09:00:00.000Z" }, snapshot: { status: 200, data: { type: "salesorder", id: "123", fields: { ...baseFields, ...funds }, sublists: { item: [] } } } };
        await service.receive(event);
    }
    const hashes = apply.mock.calls.map((call) => (call[1] as { snapshotHash: string }).snapshotHash);
    expect(hashes[0]).not.toBe(hashes[1]);
    expect(hashes[1]).toBe(hashes[2]);
    expect(hashes[3]).toBe(hashes[4]);
});
