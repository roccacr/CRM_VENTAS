import { describe, expect, it } from "vitest";

import { createSummaryDouble } from "../../scripts/performance/home-summary-double.js";
import { generateOrders, oracle } from "../../scripts/performance/home-summary-synthetic.js";

describe("real Home read path with fake SQL results (not SQL execution)", () => {
    it("queues concurrent transactions behind ten simulated connections and releases every slot", async () => {
        const f = createSummaryDouble(oracle(generateOrders(100)), 1);
        try {
            await Promise.all(Array.from({ length: 25 }, () => f.service.summary("synthetic")));
            expect(f.pool).toMatchObject({ limit: 10, activeConnections: 0, maxActiveConnections: 10, peakQueue: 15 });
            expect(f.metrics).toEqual({ native: 25, legacy: 25, transactions: 25 });
        } finally {
            await f.db.destroy();
        }
    });
    it.each([100, 2000])("compiles two bounded aggregate calls for %i synthetic orders", async (size) => {
        const expected = oracle(generateOrders(size));
        const f = createSummaryDouble(expected);
        try {
            const summary = await f.service.summary("synthetic");
            expect(summary.counts).toEqual(expected.counts);
            expect(summary.sources.duplicatesExcluded).toBe(expected.duplicatesExcluded);
            expect(f.metrics).toEqual({ native: 1, legacy: 1, transactions: 1 });
            expect(f.settings).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
            for (const query of f.queries) {
                expect(query.sql).toContain("SUM(");
                expect(query.sql).toContain("ORDER BY latest.sequence_sales_order_state_event DESC LIMIT 1");
                expect(query.sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|FOR UPDATE)\b|LIMIT 500|OFFSET/);
                expect(query.parameters).toHaveLength(2);
            }
            expect(f.queries[1]?.sql).toContain("EXISTS(SELECT 1 FROM crm_sales_order n WHERE n.id_old_produccion_sales_order=o.id_ov)");
            // A second request must consult both sources again, without a counter cache.
            await f.service.summary("synthetic");
            expect(f.metrics).toEqual({ native: 2, legacy: 2, transactions: 2 });
        } finally {
            await f.db.destroy();
        }
    });
});
