import { describe, expect, it, vi } from "vitest";

import { getCaptureReport, parseCaptureReport } from "../../src/services/marketing/lead-report-service";
import { captureResponse } from "./fixtures/capture-report";
const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: api.request }));
type Fixture = ReturnType<typeof captureResponse>;
const invalidResponses: readonly [string, (value: Fixture) => unknown][] = [
    ["a different schema", (value) => ({ ...value, schemaVersion: 2 })],
    ["a different requested period", (value) => ({ ...value, period: "day" })],
    ["a missing catalog", (value) => ({ ...value, campaigns: undefined })],
    ["a disconnected catalog row", (value) => ({ ...value, sellers: [] })],
    ["duplicate catalog identities", (value) => ({ ...value, sellers: [...value.sellers, ...value.sellers] })],
    ["duplicate aggregate rows", (value) => ({ ...value, rows: [...value.rows, ...value.rows] })],
    ["negative counters", (value) => ({ ...value, rows: value.rows.map((row) => ({ ...row, lost: -1 })) })],
    ["nonintegral counters", (value) => ({ ...value, rows: value.rows.map((row) => ({ ...row, leads: 1.5 })) })],
    ["broken cohort partitions", (value) => ({ ...value, rows: value.rows.map((row) => ({ ...row, noAppointment: row.noAppointment + 1 })) })],
    ["too many lost leads", (value) => ({ ...value, rows: value.rows.map((row) => ({ ...row, lost: row.leads + 1 })) })],
    ["mismatched source counts", (value) => ({ ...value, sources: { ...value.sources, legacy: 0 } })],
    ["legacy rows from a disabled source", (value) => ({ ...value, sources: { ...value.sources, legacyEnabled: false } })],
    ["an invalid local day", (value) => ({ ...value, today: "2026-02-30" })],
    ["an invalid observation timestamp", (value) => ({ ...value, observedAt: "invalid" })],
    ["rows outside the selected range", (value) => ({ ...value, rows: value.rows.map((row) => ({ ...row, date: "2020-01-01" })) })],
    ["a missing quality count", (value) => ({ ...value, quality: { ...value.quality, ambiguousLeadReferences: undefined } })],
];
describe("capture report service", () => {
    it("reads only the canonical protected endpoint through the existing API client", async () => {
        api.request.mockResolvedValueOnce(captureResponse());
        const value = await getCaptureReport("month");
        expect(api.request).toHaveBeenLastCalledWith("/marketing/leads/report?period=month");
        expect(value.rows.length).toBeGreaterThan(0);
    });
    it.each(invalidResponses)("rejects %s before publishing counters", (_, change) => {
        expect(() => parseCaptureReport(change(captureResponse()), "month")).toThrow();
    });
    it("preserves nullable public identities without deriving photos from names", () => {
        const response = captureResponse();
        const parsed = parseCaptureReport({ ...response, sellers: response.sellers.map((seller) => ({ ...seller, publicId: null })) }, "month");
        expect(parsed.sellers.every((seller) => seller.publicId === null)).toBe(true);
    });
});
