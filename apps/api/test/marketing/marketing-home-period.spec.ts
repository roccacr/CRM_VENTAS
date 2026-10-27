import { describe, expect, it } from "vitest";

import { createMarketingWindow, marketingHomeQuery } from "../../src/modules/crm/marketing/marketing-home.contract.js";

const now = new Date("2026-10-24T02:00:00.000Z");
describe("marketing ranges in Costa Rica", () => {
    it.each([
        ["day", "2026-10-23"],
        ["week", "2026-10-19"],
        ["month", "2026-10-01"],
        ["year", "2026-01-01"],
    ] as const)("uses the correct %s boundary and local day", (period, from) => {
        const value = createMarketingWindow(period, now);
        expect(value.today).toBe("2026-10-23");
        expect(value.selected.start).toBe(from);
        expect(value.selected.end).toBe("2026-10-23");
        expect(value.endEpoch).toBe(Date.parse("2026-10-24T06:00:00.000Z") / 1000);
    });
    it("clamps a month comparison without overflowing February", () => {
        expect(createMarketingWindow("month", new Date("2026-04-01T03:00:00Z")).comparison).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    });
    it("defaults month and rejects arbitrary dates and unknown fields", () => {
        expect(marketingHomeQuery.parse({})).toEqual({ period: "month" });
        expect(marketingHomeQuery.safeParse({ period: "all" }).success).toBe(false);
        expect(marketingHomeQuery.safeParse({ period: "month", start: "1900-01-01" }).success).toBe(false);
    });
});

it("compares the same calendar date across leap years", () => {
    expect(createMarketingWindow("year", new Date("2024-03-01T12:00:00Z")).comparison).toEqual({ start: "2023-01-01", end: "2023-03-01" });
    expect(createMarketingWindow("year", new Date("2024-02-29T12:00:00Z")).comparison.end).toBe("2023-02-28");
});

it("compares a closed short month with the entire previous month", () => {
    expect(createMarketingWindow("month", new Date("2026-02-28T12:00:00Z")).comparison.end).toBe("2026-01-31");
});

it("compares a completed April with all of March", () => {
    expect(createMarketingWindow("month", new Date("2026-04-30T12:00:00Z")).comparison).toEqual({ start: "2026-03-01", end: "2026-03-31" });
});
