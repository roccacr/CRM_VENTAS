import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { LegacyCrmDatabaseService } from "../../src/integrations/legacy-crm/legacy-crm-database.service.js";
import { LegacyHomeSummaryReader } from "../../src/integrations/legacy-crm/legacy-home-summary.reader.js";
import { HomeSummaryRepository } from "../../src/modules/crm/sales/sales-orders/home-summary.repository.js";
import { aggregateNumber, stageCountsFromRow } from "../../src/modules/crm/sales/sales-orders/home-summary.types.js";

const period = { year: 2026, timeZone: "America/Costa_Rica" as const, start: "2026-01-01T06:00:00.000Z", endExclusive: "2027-01-01T06:00:00.000Z" };
function expectSourcePredicates(queries: CompiledQuery[]) {
    for (const [index, prefix] of ["", "NOT shadowed AND "].entries()) {
        const query = queries[index]?.sql ?? "";
        expect(query).toContain(index === 0 ? "o.contract_signed_sales_order='yes'" : "o.contrado_frima_ov=1");
        const completionPredicates: Record<string, string> = { pending_transfer: " AND installments_paid=1 AND unit_transferred=0 AND unit_delivered=0", transfer_signed: " AND installments_paid=1 AND unit_transferred=1 AND keys_delivered=0 AND unit_delivered=0" };
        for (const [stage, alias] of [
            ["bank_management", "banking"],
            ["pending_balance", "balance"],
            ["pending_transfer", "transferPending"],
            ["transfer_signed", "transferSigned"],
        ] as const)
            expect(query).toContain(`SUM(${prefix}contract_signed AND stage='${stage}'${completionPredicates[stage] ?? ""}) AS ${alias}`);
        expect(query).toContain(`SUM(${prefix}contract_signed AND completed_this_year AND unit_delivered=1) AS closedThisYear`);
        const orderColumn = index === 0 ? "sales_order_id_sales_order_state_event=o.id_sales_order" : "legacy_order_id_sales_order_state_event=o.id_ov";
        expect(query).toContain(`closed_event.${orderColumn}`);
        expect(query).toContain("closed_event.to_state_code_sales_order_state_event='closed'");
        expect(query).toContain("closed_event.effective_at_sales_order_state_event >= ? AND closed_event.effective_at_sales_order_state_event < ?) AS completed_this_year");
        expect(query).not.toContain("stage='closed' AND");
        expect(query).toContain(`SUM(${prefix}approved AND stage='contract_pending_signature') AS pendingSignature`);
    }
}
describe("Home aggregate SQL", () => {
    it("executes exactly two aggregate SELECTs in one read-only snapshot, without transferring order IDs", async () => {
        const queries: CompiledQuery[] = [];
        const settings: unknown[] = [];
        const driver = new DummyDriver();
        driver.beginTransaction = (...args: unknown[]) => {
            settings.push(args[1]);
            return Promise.resolve();
        };
        driver.acquireConnection = async () => {
            const connection = await DummyDriver.prototype.acquireConnection.call(driver);
            connection.executeQuery = (query) => {
                queries.push(query);
                return Promise.resolve({ rows: [{ toSend: null, pendingSignature: null, banking: null, bankingInProgress: 0, balance: null, transferPending: null, transferSigned: null, closedThisYear: null, duplicatesExcluded: null }] as never[] });
            };
            return connection;
        };
        const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
        try {
            const repository = new HomeSummaryRepository({ db } as DatabaseService);
            const legacy = new LegacyHomeSummaryReader({ isConfigured: () => true } as LegacyCrmDatabaseService);
            await repository.readSnapshot(async (tx) => {
                await repository.aggregate(tx, period);
                await legacy.aggregate(tx, period);
            });
            expect(settings).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
            expect(queries).toHaveLength(2);
            for (const query of queries) {
                expect(query.parameters).toEqual(["2026-01-01 06:00:00.000", "2027-01-01 06:00:00.000"]);
                expect(query.sql).toContain("ORDER BY latest.sequence_sales_order_state_event DESC LIMIT 1");
                expect(query.sql).toContain("stage='bank_management') AS banking");
                expect(query.sql).not.toMatch(/UPDATE|INSERT|DELETE|FOR UPDATE|recorded_at|YEAR\(|commercial_closure/);
                expect(query.sql).toContain("MAX_EXECUTION_TIME(1500)");
            }
            expect(queries[0]?.sql).toContain("o.deleted_at_sales_order IS NULL");
            expect(queries[0]?.sql).toContain("a.type_code_sales_order_approval='formalization'");
            expectSourcePredicates(queries);
            expect(queries[1]?.sql).toContain("`crmdatabase-api`.`ordenventa`");
            expect(queries[1]?.sql).toContain("EXISTS(SELECT 1 FROM crm_sales_order n WHERE n.id_old_produccion_sales_order=o.id_ov)");
            expect(queries[1]?.sql).not.toMatch(/n.status|n.cancelled|n.deleted/);
            expect(queries[1]?.sql).toContain("SUM(shadowed) AS duplicatesExcluded");
        } finally {
            await db.destroy();
        }
    });
    it("normalizes empty aggregates and rejects unsafe numeric results", () => {
        expect(stageCountsFromRow({ toSend: null, pendingSignature: null, banking: null, bankingInProgress: 0, balance: null, transferPending: null, transferSigned: null, closedThisYear: null })).toEqual({ contracts: { toSend: 0, pendingSignature: 0 }, banking: 0, bankingInProgress: 0, balance: 0, transferPending: 0, transferSigned: 0, closedThisYear: 0 });
        expect(() => stageCountsFromRow(undefined)).toThrow();
        expect(() => stageCountsFromRow({} as never)).toThrow();
        expect(() => aggregateNumber(undefined as never)).toThrow();
        expect(aggregateNumber("1234567")).toBe(1234567);
        for (const value of ["", " ", "1.0000000000000001", "01", "+1", "-1", "1e3", "1.0", "9007199254740993", "NaN", -1, 1.5]) expect(() => aggregateNumber(value)).toThrow();
        expect(aggregateNumber(null)).toBe(0);
        expect(aggregateNumber("0")).toBe(0);
        expect(aggregateNumber("9007199254740991")).toBe(Number.MAX_SAFE_INTEGER);
    });
});

it("bounds personal activity to six actor-filtered events using deterministic newest-first order", async () => {
    const queries: CompiledQuery[] = [];
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = (query) => {
            queries.push(query);
            return Promise.resolve({ rows: [] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    try {
        const repository = new HomeSummaryRepository({ db } as DatabaseService);
        await repository.readSnapshot((tx) => repository.recentActivity(tx, "authenticated-actor"));
        expect(queries).toHaveLength(1);
        const query = queries[0];
        expect(query?.parameters).toEqual(["authenticated-actor"]);
        expect(query?.sql).toContain("e.actor_reference_record_event=?");
        expect(query?.sql).toContain("e.module_record_event='formalizacion'");
        expect(query?.sql).toContain("r.entity_type_record='sales_order'");
        expect(query?.sql).toContain("ORDER BY e.recorded_at_record_event DESC,e.id_record_event DESC LIMIT 6");
        expect(query?.sql).not.toMatch(/INSERT|UPDATE|DELETE|SELECT \*/);
    } finally {
        await db.destroy();
    }
});
