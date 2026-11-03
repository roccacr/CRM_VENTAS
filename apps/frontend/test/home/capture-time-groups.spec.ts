import { describe, expect, it } from "vitest";

import { captureGroupingForPeriod, capturePeriodChoices, captureTimeGroups, validateCaptureRange } from "../../src/modules/marketing/capture-time-groups";
import { EMPTY_VALUES } from "../../src/modules/marketing/lead-capture-report";
const catalogs = { sellers: [], projects: [{ id: "p", name: "Proyecto Uno" }], campaigns: [{ id: "c", name: "Campaña" }], ads: [{ id: "a", name: "Anuncio" }] };
const row = (date: string, leads: number) => ({ ...EMPTY_VALUES, leads, noAppointment: leads, date, sellerId: "s", projectId: "p", campaignId: "c", adId: "a" });
describe("capture date selection and calendar groups", () => {
    it("validates complete ordered dates without silently swapping or accepting future days", () => {
        expect(validateCaptureRange({ from: "2026-01-01", to: "2026-02-01" }, "2026-11-03")).toBeNull();
        for (const value of [
            { from: "", to: "2026-01-01" },
            { from: "2026-02-30", to: "2026-03-01" },
            { from: "2026-02-01", to: "2026-01-01" },
            { from: "2026-11-01", to: "2026-12-01" },
        ])
            expect(validateCaptureRange(value, "2026-11-03")).not.toBeNull();
    });
    it("compares the same project across months, retaining an empty month and chronological order", () => {
        const groups = captureTimeGroups([row("2026-03-10", 4), row("2026-01-31", 2)], { catalogs, depth: 1, measure: "leads", grouping: "month", range: { from: "2026-01-01", to: "2026-03-31" } });
        expect(groups.map((g) => g.value)).toEqual([2, 0, 4]);
        expect(groups.every((g) => g.path.includes("Proyecto Uno"))).toBe(true);
        expect(new Set(groups.map((g) => g.colorKey)).size).toBe(1);
    });
    it("uses Monday weeks and keeps separate years", () => {
        const rows = [row("2025-12-31", 2), row("2026-01-04", 3), row("2026-01-05", 4)];
        expect(captureTimeGroups(rows, { catalogs, depth: 1, measure: "leads", grouping: "week", range: { from: "2025-12-31", to: "2026-01-05" } }).map((g) => g.value)).toEqual([5, 4]);
        expect(captureTimeGroups(rows, { catalogs, depth: 1, measure: "leads", grouping: "year", range: { from: "2025-12-31", to: "2026-01-05" } }).map((g) => g.value)).toEqual([2, 7]);
    });
});

it("keeps loss reasons and their total when comparing months", () => {
    const input = [
        { ...row("2026-01-01", 3), lost: 2, lossReasons: [{ code: "budget", name: "Presupuesto", count: 2 }] },
        { ...row("2026-02-01", 4), lost: 1 },
    ];
    const groups = captureTimeGroups(input, { catalogs, depth: 1, measure: "lossReasons", grouping: "month", range: { from: "2026-01-01", to: "2026-02-28" } });
    expect(groups.reduce((sum, g) => sum + g.value, 0)).toBe(3);
    expect(groups.filter((g) => g.path.includes("Sin motivo registrado")).reduce((sum, g) => sum + g.value, 0)).toBe(1);
});

it("derives the chart scale from the only period selection", () => {
    const range = { from: "2026-01-01", to: "2026-01-03" };
    for (const period of ["day", "week", "month", "quarter", "year"] as const) expect(captureGroupingForPeriod(period, range)).toBe(period);
    expect(captureGroupingForPeriod("custom", range)).toBe("day");
    expect(captureGroupingForPeriod("custom", { from: "2026-01-01", to: "2026-02-15" })).toBe("week");
    expect(captureGroupingForPeriod("custom", { from: "2026-01-01", to: "2026-10-01" })).toBe("month");
    expect(captureGroupingForPeriod("custom", { from: "2024-01-01", to: "2026-10-01" })).toBe("year");
});
it("groups calendar quarters without mixing years", () => {
    const groups = captureTimeGroups([row("2025-12-31", 2), row("2026-01-01", 3), row("2026-04-01", 4)], { catalogs, depth: 1, measure: "leads", grouping: "quarter", range: { from: "2025-12-31", to: "2026-04-01" } });
    expect(groups.map((g) => g.path[0])).toEqual(["T4 2025", "T1 2026", "T2 2026"]);
    expect(groups.map((g) => g.value)).toEqual([2, 3, 4]);
});

it("offers named calendar periods across years and includes empty months", () => {
    const choices = capturePeriodChoices("month", { from: "2025-12-15", to: "2026-03-05" });
    expect(choices.map((item) => item.value)).toEqual(["2025-12-01", "2026-01-01", "2026-02-01", "2026-03-01"]);
    expect(choices[1]?.label).toMatch(/enero.*2026/);
    expect(choices[0]?.range).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(choices[3]?.range.to).toBe("2026-03-05");
    expect(capturePeriodChoices("week", { from: "2025-12-31", to: "2026-01-06" }).map((item) => item.value)).toEqual(["2025-12-29", "2026-01-05"]);
    expect(capturePeriodChoices("year", { from: "2024-08-01", to: "2026-11-03" }).map((item) => item.label)).toEqual(["2024", "2025", "2026"]);
});
it("compares only chosen months for each project without counting a month in between", () => {
    const periods = [
        { from: "2026-01-01", to: "2026-01-31" },
        { from: "2026-03-01", to: "2026-03-31" },
    ];
    const groups = captureTimeGroups([row("2026-01-10", 2), row("2026-02-10", 9), row("2026-03-10", 4)], { catalogs, depth: 1, measure: "leads", grouping: "month", range: { from: "2026-01-01", to: "2026-03-31" }, periods });
    expect(groups.map((item) => item.value)).toEqual([2, 4]);
    expect(groups.every((item) => item.path.includes("Proyecto Uno"))).toBe(true);
});
