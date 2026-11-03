import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacyMarketingLeadsReportReader } from "../../src/integrations/legacy-crm/legacy-marketing-leads-report.reader.js";
import { buildMarketingLeadsReport } from "../../src/modules/crm/marketing/marketing-leads-report.model.js";
import { MarketingLeadsReportRepository } from "../../src/modules/crm/marketing/marketing-leads-report.repository.js";

describe("qualification SQL evidence projections", () => {
    it.each(["scheduled", "completed"] as const)("keeps promoted %s appointments valid with the actual SQL date format", async (status) => {
        const driver = new DummyDriver();
        driver.acquireConnection = async () => {
            const connection = await DummyDriver.prototype.acquireConnection.call(driver);
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                let rows: object[] = [];
                if (query.sql.includes(" AS hasSalesOrder")) rows = [{ id: "one", providerId: "99", sellerId: "seller", projectId: "project", campaignId: "campaign", ad: null, qualified: 0, hasEstimate: 0, hasSalesOrder: 0, lost: 0, dayNumber: 20760 }];
                if (query.sql.includes("LEFT JOIN crm_calendar_event n")) rows = [{ id: "promoted", leadId: "99", status, date: query.sql.includes("'%Y-%m-%dT%H:%i:%s'") ? "2026-11-03T09:30:00" : "2026-11-03" }];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        };
        const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
        try {
            await db.transaction().execute(async (tx) => {
                const legacy = await new LegacyMarketingLeadsReportReader({ isConfigured: () => true } as never).read(tx);
                expect(legacy.events).toEqual([{ id: "promoted", leadId: "99", status, invalidDate: false }]);
                const empty = { ...legacy, leads: [], events: [] };
                const report = buildMarketingLeadsReport(empty, legacy, { period: "all", qualification: "qualified", now: new Date("2026-11-03T18:00:00Z"), legacyEnabled: true });
                expect(report.sources.legacy).toBe(1);
                expect(report.rows[0]?.[status]).toBe(1);
            });
        } finally {
            await db.destroy();
        }
    });
    it("uses actual lead foreign keys, normalizes SQL booleans and never writes", async () => {
        const queries: CompiledQuery[] = [];
        const driver = new DummyDriver();
        driver.acquireConnection = async () => {
            const connection = await DummyDriver.prototype.acquireConnection.call(driver);
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                const rows = query.sql.includes(" AS hasSalesOrder") ? [{ id: "one", qualified: 0, hasEstimate: 1, hasSalesOrder: 1, lost: 0, dayNumber: 20760 }] : [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        };
        const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
        try {
            await db.transaction().execute(async (tx) => {
                const native = await new MarketingLeadsReportRepository().readNative(tx);
                const legacy = await new LegacyMarketingLeadsReportReader({ isConfigured: () => true } as never).read(tx);
                expect(native.leads[0]).toMatchObject({ qualified: false, hasSalesOrder: true });
                expect(legacy.leads[0]).toMatchObject({ qualified: false, hasEstimate: true, hasSalesOrder: true });
            });
            const projection = queries.map((query) => query.sql).join("\n");
            expect(projection).toContain("l.is_qualified_lead AS qualified");
            expect(projection).toContain("o.lead_id_sales_order=l.id_lead AND o.deleted_at_sales_order IS NULL");
            expect(projection).toContain("e.idLead_est=l.idinterno_lead");
            expect(projection).toContain("o.id_ov_lead=l.idinterno_lead");
            expect(projection).toContain("n.legacy_calendar_id_calendar_event=c.id_calendar");
            expect(projection).toContain("x.source_calendar_event_link='legacy'");
            expect(projection).toContain("CAST(l.id_lead AS CHAR)=x.entity_public_id_calendar_event_link");
            expect(projection).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER)\b/i);
        } finally {
            await db.destroy();
        }
    });
});
