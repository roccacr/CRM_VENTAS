import { describe, expect, it } from "vitest";

import type { ReportLead, ReportSource } from "../../src/modules/crm/marketing/marketing-leads-report.contract.js";
import { buildMarketingLeadsReport } from "../../src/modules/crm/marketing/marketing-leads-report.model.js";

const now = new Date("2026-10-26T18:00:00Z");
const lead = (overrides: Partial<ReportLead> = {}): ReportLead => ({ id: "1", date: "2026-10-20", sellerId: "seller", projectId: "project", campaignId: "campaign", ad: null, lost: false, ...overrides });
const source = (leads: ReportLead[] = []): ReportSource => ({ leads, users: [{ id: "seller", name: "Ana", email: "ana@example.test" }], projects: [{ id: "project", name: "Proyecto" }], campaigns: [{ id: "campaign", name: "Campaña" }], userAliases: [], projectAliases: [], campaignAliases: [], leadAliases: [], events: [] });
const legacy = (leads: ReportLead[] = []): ReportSource => ({ ...source(leads), owners: [{ reference: "10", name: "Ana", email: "ana@example.test" }] });

describe("captured lead report cohorts", () => {
    it("counts every lead once with completed precedence and cancelled-only as no appointment", () => {
        const native = source([lead(), lead({ id: "2", ad: "undefined", lost: true }), lead({ id: "3", ad: "Anuncio" })]);
        native.events = [
            { id: "a", leadId: "1", status: "scheduled", invalidDate: false },
            { id: "b", leadId: "1", status: "completed", invalidDate: false },
            { id: "c", leadId: "2", status: "cancelled", invalidDate: false },
        ];
        const result = buildMarketingLeadsReport(native, legacy(), { period: "month", now, legacyEnabled: true });
        expect(result.rows.reduce((sum, row) => sum + row.leads, 0)).toBe(3);
        expect(result.rows.find((row) => row.completed)?.completed).toBe(1);
        expect(result.rows.reduce((sum, row) => sum + row.noAppointment, 0)).toBe(2);
        expect(result.rows.reduce((sum, row) => sum + row.lost, 0)).toBe(1);
        expect(result.ads).toHaveLength(2);
        expect(result.ads.some((ad) => ad.name === "Sin anuncio registrado")).toBe(true);
        expect(JSON.stringify(result)).not.toContain("example.test");
    });
    it("native aliases supersede legacy cohorts and retain uniquely linked legacy appointments", () => {
        const native = source([lead({ date: "2026-10-21" })]);
        native.leadAliases = [{ id: "1", system: "netsuite", externalId: "99" }];
        const old = legacy([lead({ id: "old", providerId: "99", sellerId: "10", date: "2026-10-01" })]);
        old.events = [{ id: "event", leadId: "99", status: "completed", invalidDate: false }];
        const result = buildMarketingLeadsReport(native, old, { period: "all", now, legacyEnabled: true });
        expect(result.sources).toEqual({ native: 1, legacy: 0, duplicatesExcluded: 1, legacyEnabled: true });
        expect(result.rows).toEqual([expect.objectContaining({ date: "2026-10-21", leads: 1, completed: 1 })]);
        expect(result.coverage.start).toBe("2026-10-21");
    });
    it("keeps same-email customer leads and source-scoped campaign identities separate", () => {
        const result = buildMarketingLeadsReport(source([lead()]), legacy([lead({ sellerId: "10" }), lead({ id: "2", sellerId: "10" })]), { period: "month", now, legacyEnabled: true });
        expect(result.sources.legacy).toBe(2);
        expect(result.campaigns).toHaveLength(2);
        expect(result.sellers).toHaveLength(1);
    });
    it("does not assign an ambiguous provider reference appointment or shadow either lead", () => {
        const native = source([lead()]);
        native.leadAliases = [{ id: "1", system: "netsuite", externalId: "99" }];
        const old = legacy([lead({ id: "a", providerId: "99", sellerId: "10" }), lead({ id: "b", providerId: "99", sellerId: "10" })]);
        old.events = [{ id: "a", leadId: "99", status: "completed", invalidDate: false }];
        const result = buildMarketingLeadsReport(native, old, { period: "month", now, legacyEnabled: true });
        expect(result.sources.duplicatesExcluded).toBe(0);
        expect(result.rows.reduce((sum, row) => sum + row.completed, 0)).toBe(0);
        expect(result.quality.ambiguousLeadReferences).toBe(2);
    });
    it("limits rows, catalogs, coverage and quality to the authorized owners", () => {
        const native = source([lead(), lead({ id: "hidden", date: "2020-01-01", sellerId: "hidden", campaignId: "secret" })]);
        const result = buildMarketingLeadsReport(native, legacy([lead({ id: "old", sellerId: "unlinked", date: null })]), { period: "all", now, legacyEnabled: true, sellerScope: new Set(["seller"]) });
        expect(result.coverage.start).toBe("2026-10-20");
        expect(result.quality.invalidDates).toBe(0);
        expect(JSON.stringify(result)).not.toContain("secret");
        expect(result.sources.native).toBe(1);
    });
    it("uses Costa Rica day and Monday week with only selected-period rows", () => {
        const result = buildMarketingLeadsReport(source([lead({ date: "2026-10-25" }), lead({ id: "2", date: "2026-10-26" })]), legacy(), { period: "week", now: new Date("2026-10-26T02:00:00Z"), legacyEnabled: false });
        expect(result.today).toBe("2026-10-25");
        expect(result.range).toEqual({ start: "2026-10-19", end: "2026-10-25" });
        expect(result.rows).toHaveLength(1);
    });
    it("retains missing captions and does not bridge ambiguous configured seller aliases by email", () => {
        const native = source();
        native.userAliases = [
            { id: "seller", system: "netsuite", externalId: "10" },
            { id: "another", system: "netsuite", externalId: "10" },
        ];
        const old = legacy([lead({ sellerId: "10", campaignId: "", campaignName: "", projectId: "", projectName: "" })]);
        old.campaigns = [];
        const result = buildMarketingLeadsReport(native, old, { period: "month", now, legacyEnabled: true });
        expect(result.sellers[0]?.publicId).toBeNull();
        expect(result.campaigns[0]?.name).toBe("Sin campaña registrada");
        expect(result.projects[0]?.name).toBe("Sin proyecto registrado");
        expect(result.quality.unresolvedSellers).toBe(1);
        expect(result.quality.unresolvedCampaigns).toBe(1);
    });
    it("keeps native creation authority when an old duplicate falls inside the selected month", () => {
        const native = source([lead({ date: "2026-09-20" })]);
        native.leadAliases = [{ id: "1", system: "netsuite", externalId: "99" }];
        const result = buildMarketingLeadsReport(native, legacy([lead({ providerId: "99", date: "2026-10-20", sellerId: "10" })]), { period: "month", now, legacyEnabled: true });
        expect(result.rows).toHaveLength(0);
        expect(result.sources.duplicatesExcluded).toBe(1);
        expect(result.coverage.start).toBe("2026-09-20");
    });
    it("rejects impossible lead dates from cohorts and counts their visible quality issue", () => {
        const result = buildMarketingLeadsReport(source([lead({ date: "2026-02-30" })]), legacy(), { period: "all", now, legacyEnabled: false });
        expect(result.rows).toHaveLength(0);
        expect(result.coverage.start).toBe("2026-10-26");
        expect(result.quality.invalidDates).toBe(1);
    });
});

it("unifies loss reasons across sources, preserves unknowns and counts each authoritative lead once", () => {
    const native = source([lead({ lost: true, lossReason: { code: "budget", name: "Presupuesto" } })]);
    native.leadAliases = [{ id: "1", system: "netsuite", externalId: "99" }];
    const old = legacy([lead({ id: "shadow", providerId: "99", lost: true, lossReason: { code: "location", name: "Ubicación" } }), lead({ id: "old", sellerId: "10", lost: true, lossReason: { code: "budget", name: "Presupuesto" } }), lead({ id: "unknown", sellerId: "10", lost: true }), lead({ id: "active", sellerId: "10", lost: false, lossReason: { code: "budget", name: "Presupuesto" } })]);
    const result = buildMarketingLeadsReport(native, old, { period: "month", now, legacyEnabled: true });
    const reasons = result.rows.flatMap((row) => row.lossReasons);
    expect(reasons.filter((row) => row.code === "budget").reduce((sum, row) => sum + row.count, 0)).toBe(2);
    expect(reasons.filter((row) => row.code === "unrecorded").reduce((sum, row) => sum + row.count, 0)).toBe(1);
    expect(reasons.some((row) => row.code === "location")).toBe(false);
    expect(reasons.reduce((sum, row) => sum + row.count, 0)).toBe(result.rows.reduce((sum, row) => sum + row.lost, 0));
});

it("does not resurrect a legacy loss reason when the native authority is no longer lost", () => {
    const native = source([lead({ lost: false })]);
    native.leadAliases = [{ id: "1", system: "netsuite", externalId: "99" }];
    const old = legacy([lead({ providerId: "99", lost: true, lossReason: { code: "budget", name: "Presupuesto" } })]);
    const result = buildMarketingLeadsReport(native, old, { period: "month", now, legacyEnabled: true });
    expect(result.rows.reduce((sum, row) => sum + row.lost, 0)).toBe(0);
    expect(result.rows.flatMap((row) => row.lossReasons)).toEqual([]);
});

describe("effective qualification", () => {
    it("qualifies manual, valid appointment and commercial evidence only", () => {
        const native = source([lead({ id: "manual", qualified: true }), lead({ id: "cita" }), lead({ id: "estimate", hasEstimate: true }), lead({ id: "order", hasSalesOrder: true }), lead({ id: "none" }), lead({ id: "cancelled" })]);
        native.events = [
            { id: "a", leadId: "cita", status: "completed", invalidDate: false },
            { id: "c", leadId: "cancelled", status: "cancelled", invalidDate: false },
        ];
        const result = buildMarketingLeadsReport(native, legacy(), { period: "all", qualification: "qualified", now, legacyEnabled: false });
        expect(result.sources.native).toBe(4);
        expect(result.qualification).toBe("qualified");
    });
});

describe("qualification partitions and authority", () => {
    it("partitions all measures and sources across every period with stable scoped coverage", () => {
        const native = source([lead({ id: "old", date: "2020-01-01" }), lead({ id: "qualified", date: "2026-10-26", qualified: true, lost: true }), lead({ id: "plain", date: "2026-10-26" }), lead({ id: "hidden", sellerId: "hidden", date: "2010-01-01", qualified: true })]);
        for (const period of ["day", "week", "month", "all"] as const) {
            const reports = (["all", "qualified", "unqualified"] as const).map((qualification) => buildMarketingLeadsReport(native, legacy(), { period, qualification, now, legacyEnabled: false, sellerScope: new Set(["seller"]) }));
            expect(reports.map((r) => r.coverage)).toEqual(Array(3).fill({ start: "2020-01-01", end: "2026-10-26" }));
            for (const measure of ["leads", "noAppointment", "scheduled", "completed", "lost"] as const) {
                const values = reports.map((r) => r.rows.reduce((sum, row) => sum + row[measure], 0));
                expect(values[0]).toBe((values[1] ?? 0) + (values[2] ?? 0));
            }
        }
    });
    it("merges promoted commercial evidence, retains native manual authority and excludes ambiguous commercial references", () => {
        const native = source([lead({ id: "promoted" }), lead({ id: "manual" })]);
        native.leadAliases = [
            { id: "promoted", system: "netsuite", externalId: "99" },
            { id: "manual", system: "netsuite", externalId: "98" },
        ];
        const old = legacy([lead({ id: "old", providerId: "99", hasEstimate: true }), lead({ id: "conflict", providerId: "98", qualified: true }), lead({ id: "a", providerId: "97", hasSalesOrder: true }), lead({ id: "b", providerId: "97", hasSalesOrder: true })]);
        const result = buildMarketingLeadsReport(native, old, { period: "all", qualification: "qualified", now, legacyEnabled: true });
        expect(result.sources).toEqual({ native: 1, legacy: 0, duplicatesExcluded: 1, legacyEnabled: true });
    });
});

describe("native calendar links to legacy primary keys", () => {
    it.each(["scheduled", "completed", "cancelled"] as const)("resolves exact PK despite ambiguous provider: %s", (status) => {
        const old = legacy([lead({ id: "a", providerId: "99" }), lead({ id: "b", providerId: "99" })]);
        old.events = [{ id: "newCRM", leadId: "legacy-pk:a", status, invalidDate: false }];
        const result = buildMarketingLeadsReport(source(), old, { period: "all", qualification: "qualified", now, legacyEnabled: true });
        expect(result.sources.legacy).toBe(status === "cancelled" ? 0 : 1);
    });
    it("combines exact-PK appointment after native promotion without duplicating the cohort", () => {
        const native = source([lead()]);
        native.leadAliases = [{ id: "1", system: "netsuite", externalId: "99" }];
        const old = legacy([lead({ id: "a", providerId: "99" })]);
        old.events = [{ id: "CRM", leadId: "legacy-pk:a", status: "completed", invalidDate: false }];
        const result = buildMarketingLeadsReport(native, old, { period: "all", qualification: "qualified", now, legacyEnabled: true });
        expect(result.sources.native).toBe(1);
        expect(result.sources.legacy).toBe(0);
        expect(result.rows[0]?.completed).toBe(1);
    });
});
