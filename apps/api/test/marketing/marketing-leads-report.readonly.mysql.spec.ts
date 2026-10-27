import "reflect-metadata";

import { readFileSync, writeFileSync } from "node:fs";

import { ConfigService } from "@nestjs/config";
import { parse } from "dotenv";
import { sql } from "kysely";
import { describe, expect, it } from "vitest";

import { DatabaseService } from "../../src/database/database.service.js";
import { LegacyMarketingLeadsReportReader } from "../../src/integrations/legacy-crm/legacy-marketing-leads-report.reader.js";
import { MarketingHomeRepository } from "../../src/modules/crm/marketing/marketing-home.repository.js";
import { buildMarketingLeadsReport } from "../../src/modules/crm/marketing/marketing-leads-report.model.js";
import { MarketingLeadsReportRepository } from "../../src/modules/crm/marketing/marketing-leads-report.repository.js";

describe.skipIf(process.env.CRM_CAPTURE_REPORT_LIVE !== "true")("capture report explicit read-only live verification", () => {
    it("matches all/month direct SQL counts in one read-only snapshot", async () => {
        const env = parse(readFileSync(".env"));
        expect(env.DB_NAME).toBe("CRM_THINK_V2");
        expect(env.DB_SSL).toBe("true");
        const database = new DatabaseService(new ConfigService({ ...env, DB_PORT: Number(env.DB_PORT), DB_SSL: true }));
        try {
            const snapshot = new MarketingHomeRepository(database);
            const evidence = await snapshot.readSnapshot(async (tx) => {
                const native = await new MarketingLeadsReportRepository().readNative(tx);
                const legacy = await new LegacyMarketingLeadsReportReader({ isConfigured: () => true } as never).read(tx);
                const now = new Date();
                const all = buildMarketingLeadsReport(native, legacy, { period: "all", now, legacyEnabled: true });
                const month = buildMarketingLeadsReport(native, legacy, { period: "month", now, legacyEnabled: true });
                const direct = await sql<{ leads: string | number; lost: string | number }>`SELECT COUNT(*) AS leads,SUM(BINARY segimineto_lead='07-LEAD-PERDIDO') AS lost FROM ${sql.table("crmdatabase-api.leads")}`.execute(tx);
                expect(native.leads).toHaveLength(0);
                expect(all.sources.legacy).toBe(Number(direct.rows[0]?.leads));
                expect(all.rows.reduce((sum, row) => sum + row.lost, 0)).toBe(Number(direct.rows[0]?.lost));
                const totals = (report: typeof all) => report.rows.reduce((sum, row) => ({ leads: sum.leads + row.leads, noAppointment: sum.noAppointment + row.noAppointment, scheduled: sum.scheduled + row.scheduled, completed: sum.completed + row.completed, lost: sum.lost + row.lost }), { leads: 0, noAppointment: 0, scheduled: 0, completed: 0, lost: 0 });
                const cohort = totals(all);
                expect(cohort.leads).toBe(cohort.noAppointment + cohort.scheduled + cohort.completed);
                for (const report of [all, month]) {
                    const startEpoch = Date.parse(report.range.start + "T06:00:00Z") / 1000;
                    const endEpoch = Date.parse(report.range.end + "T06:00:00Z") / 1000 + 86400;
                    const verification = await sql<{ leads: number | string; completed: number | string; scheduled: number | string; lost: number | string }>`SELECT /*+ MAX_EXECUTION_TIME(5000) */ COUNT(*) AS leads,
                        SUM(BINARY l.segimineto_lead='07-LEAD-PERDIDO') AS lost,
                        SUM(COALESCE(a.completed,0)=1 AND r.matches=1 AND l.idinterno_lead>0) AS completed,
                        SUM(COALESCE(a.completed,0)=0 AND COALESCE(a.scheduled,0)=1 AND r.matches=1 AND l.idinterno_lead>0) AS scheduled
                        FROM ${sql.table("crmdatabase-api.leads")} l
                        LEFT JOIN (SELECT idinterno_lead,COUNT(*) AS matches FROM ${sql.table("crmdatabase-api.leads")} GROUP BY idinterno_lead) r ON r.idinterno_lead=l.idinterno_lead
                        LEFT JOIN (SELECT id_lead,MAX(LOWER(TRIM(accion_calendar))='completado') AS completed,MAX(LOWER(TRIM(accion_calendar))='pendiente') AS scheduled
                            FROM ${sql.table("crmdatabase-api.calendars")} WHERE LOWER(TRIM(tipo_calendar))='cita' GROUP BY id_lead) a ON a.id_lead=l.idinterno_lead
                        WHERE l.creado_lead>=FROM_UNIXTIME(${startEpoch}) AND l.creado_lead<FROM_UNIXTIME(${endEpoch})`.execute(tx);
                    const expected = verification.rows[0];
                    if (!expected) throw new Error("Direct SQL returned no aggregate row.");
                    const observed = totals(report);
                    expect(observed.leads).toBe(Number(expected.leads));
                    expect(observed.lost).toBe(Number(expected.lost));
                    expect(observed.completed).toBe(Number(expected.completed));
                    expect(observed.scheduled).toBe(Number(expected.scheduled));
                }
                if (process.env.CRM_CAPTURE_REPORT_OUTPUT_PREFIX) {
                    writeFileSync(process.env.CRM_CAPTURE_REPORT_OUTPUT_PREFIX + "-month.json", JSON.stringify(month));
                    writeFileSync(process.env.CRM_CAPTURE_REPORT_OUTPUT_PREFIX + "-all.json", JSON.stringify(all));
                }
                return { observedAt: now.toISOString(), all: { range: all.range, totals: cohort, quality: all.quality, sources: all.sources }, month: { range: month.range, totals: totals(month), quality: month.quality }, nativeUsers: native.users.length };
            });
            console.log(JSON.stringify(evidence));
        } finally {
            await database.onModuleDestroy();
        }
    }, 60000);
});
