import { DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacyApprovalReader } from "../../src/integrations/legacy-crm/legacy-approval.reader.js";
import type { LegacyCrmDatabaseService } from "../../src/integrations/legacy-crm/legacy-crm-database.service.js";
import { ApprovalSummaryRepository } from "../../src/modules/crm/sales/sales-orders/approval-summary.repository.js";

describe("approval count query predicates", () => {
    function fixture() {
        const queries: { sql: string; parameters: readonly unknown[] }[] = [];
        const driver = new DummyDriver();
        const settings: unknown[] = [];
        driver.beginTransaction = (...args: unknown[]) => {
            settings.push(args[1]);
            return Promise.resolve();
        };
        driver.acquireConnection = () =>
            Promise.resolve({
                executeQuery: (query: { sql: string; parameters: readonly unknown[] }) => {
                    queries.push(query);
                    return Promise.resolve({ rows: [] });
                },
                async *streamQuery() {
                    yield await Promise.resolve({ rows: [] });
                },
            });
        const db = new Kysely<CrmDatabase>({
            dialect: {
                createDriver: () => driver,
                createAdapter: () => new MysqlAdapter(),
                createIntrospector: (database) => new MysqlIntrospector(database),
                createQueryCompiler: () => new MysqlQueryCompiler(),
            },
        });
        return { db, queries, settings };
    }
    it("requires the three explicit approval statuses and valid native order", async () => {
        const { db, queries } = fixture();
        await new ApprovalSummaryRepository({ db } as DatabaseService).countPending();
        const query = queries[0]?.sql ?? "";
        for (const predicate of ["status_sales_order = 'active'", "cancelled_sales_order = 'no'", "deleted_at_sales_order IS NULL", "'sales_management'", "'developer'", "'formalization'", "'not_approved'"]) expect(query).toContain(predicate);
        expect(query.match(/status_sales_order_approval = 'approved'/g)).toHaveLength(2);
        await db.destroy();
    });
    it("uses all five legacy flags, keyset paging, and a bound cursor", async () => {
        const { db, queries } = fixture();
        const reader = new LegacyApprovalReader({ db, isConfigured: () => true } as unknown as LegacyCrmDatabaseService);
        await reader.pendingIds(123);
        const query = queries[0];
        for (const predicate of ["status_ov = 1", "caida_ov = 0", "chekJefeVenta = 1", "aprobacion__rdr_ov = 1", "aprobacion_forma_ov = 0", "ORDER BY id_ov LIMIT 500"]) expect(query?.sql).toContain(predicate);
        expect(query?.parameters).toEqual([123]);
        await db.destroy();
    });
    it("suppresses migrated legacy identities irrespective of native eligibility", async () => {
        const { db, queries } = fixture();
        await new ApprovalSummaryRepository({ db } as DatabaseService).migratedIds([12, 13]);
        expect(queries[0]?.parameters).toEqual([12, 13]);
        expect(queries[0]?.sql).not.toMatch(/status_sales_order|cancelled_sales_order|deleted_at_sales_order/);
        await db.destroy();
    });
    it("qualifies the approved legacy source inside a read-only repeatable snapshot", async () => {
        const { db, queries, settings } = fixture();
        try {
            const reader = new LegacyApprovalReader({ isConfigured: () => true } as LegacyCrmDatabaseService);
            const repository = new ApprovalSummaryRepository({ db } as DatabaseService);
            await repository.readSnapshot((tx) => reader.pendingIds(0, tx));
            expect(queries[0]?.sql).toContain("`crmdatabase-api`.`ordenventa`");
            expect(settings).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
        } finally {
            await db.destroy();
        }
    });
});
