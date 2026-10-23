import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacyContractSummaryReader } from "../../src/integrations/legacy-crm/legacy-contract-summary.reader.js";
import type { LegacyCrmDatabaseService } from "../../src/integrations/legacy-crm/legacy-crm-database.service.js";
import { ContractOrdersRepository } from "../../src/modules/crm/sales/sales-orders/contract-orders.repository.js";
import { ContractSummaryRepository } from "../../src/modules/crm/sales/sales-orders/contract-summary.repository.js";

function fixture() {
    const queries: CompiledQuery[] = [];
    const driver = new DummyDriver();
    const settings: unknown[] = [];
    driver.beginTransaction = (...args: unknown[]) => {
        settings.push(args[1]);
        return Promise.resolve();
    };
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = (query) => {
            queries.push(query);
            return Promise.resolve({ rows: [] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, settings, repository: new ContractSummaryRepository({ db } as DatabaseService) };
}

describe("contract stage read predicates", () => {
    it("keeps native BIGINT cursors as text and bounds queue reads", async () => {
        const f = fixture();
        try {
            await f.repository.readSnapshot((tx) => new ContractOrdersRepository().page(tx, "signature", "9007199254740993", 51));
            expect(f.queries[0]?.parameters).toEqual(["9007199254740993", 51]);
            expect(f.queries[0]?.sql).toContain("stage='contract_pending_signature'");
            expect(f.queries[0]?.sql).toContain("CAST(o.id_sales_order AS CHAR)");
            expect(f.queries[0]?.sql).toContain("MAX_EXECUTION_TIME(1500)");
        } finally {
            await f.db.destroy();
        }
    });
    it("excludes every native alias in the legacy order page, including inactive/deleted aliases", async () => {
        const f = fixture();
        try {
            const reader = new LegacyContractSummaryReader({ isConfigured: () => true } as LegacyCrmDatabaseService);
            await f.repository.readSnapshot((tx) => reader.orders(tx, "send", "123", 51));
            const query = f.queries[0];
            expect(query?.parameters).toEqual(["123", 51]);
            expect(query?.sql).toContain("NOT EXISTS (SELECT 1 FROM crm_sales_order n WHERE n.id_old_produccion_sales_order=o.id_ov)");
            expect(query?.sql).toContain("o.aprobacion_forma_ov=1");
            expect(query?.sql).toContain("stage IN ('contract_pending_send','unclassified','pending_approval')");
            expect(query?.sql).not.toContain("contrado_frima_ov");
        } finally {
            await f.db.destroy();
        }
    });
    it("uses a shared read-only repeatable snapshot and three distinct approved types", async () => {
        const f = fixture();
        try {
            expect(await f.repository.readSnapshot((tx) => f.repository.countNative(tx))).toEqual({ toSend: 0, pendingSignature: 0 });
            expect(f.settings).toContainEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
            const query = f.queries[0]?.sql ?? "";
            for (const predicate of ["status_sales_order='active'", "cancelled_sales_order='no'", "deleted_at_sales_order IS NULL", "'sales_management','developer','formalization'", "status_sales_order_approval='approved'", ")=3", "ORDER BY e.sequence_sales_order_state_event DESC LIMIT 1", "'contract_pending_signature'", "'contract_pending_send'"]) expect(query).toContain(predicate);
            expect(query).not.toMatch(/contract_signed_sales_order|UPDATE|INSERT|FOR UPDATE/);
        } finally {
            await f.db.destroy();
        }
    });
    it("reads qualified legacy stage/order tables through the same transaction with bounded keyset", async () => {
        const f = fixture();
        try {
            const reader = new LegacyContractSummaryReader({ isConfigured: () => true } as LegacyCrmDatabaseService);
            await f.repository.readSnapshot((tx) => reader.pending(123, tx));
            const query = f.queries[0];
            expect(query?.parameters).toEqual([123]);
            for (const predicate of ["`crmdatabase-api`.`ordenventa`", "`crmdatabase-api`.`audit_sales_order_state_event`", "status_ov=1", "caida_ov=0", "chekJefeVenta=1", "aprobacion__rdr_ov=1", "aprobacion_forma_ov=1", "ORDER BY id_ov LIMIT 500"]) expect(query?.sql).toContain(predicate);
            expect(query?.sql).not.toMatch(/contrado_frima_ov|UPDATE|INSERT/);
        } finally {
            await f.db.destroy();
        }
    });
});
