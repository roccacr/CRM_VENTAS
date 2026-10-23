import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import { getHomeSummary } from "../../src/services/formalization/home-summary-service";

vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
const counts = { contracts: { toSend: 6, pendingSignature: 3 }, banking: 4, balance: 5, transferPending: 6, transferSigned: 7, closedThisYear: 8 };
const summary = { schemaVersion: 1, observedAt: "2026-10-23T12:00:00.000Z", period: { year: 2026, timeZone: "America/Costa_Rica", start: "2026-01-01T06:00:00.000Z", endExclusive: "2027-01-01T06:00:00.000Z" }, counts, sources: { native: counts, legacy: counts, legacyEnabled: true, duplicatesExcluded: 2 } };
beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

it.each([true, false])("logs only validated aggregate fields in DEV=%s", async (development) => {
    vi.stubEnv("DEV", development);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.mocked(apiRequest).mockResolvedValue({ ...summary, customer: { email: "secret@example.test" }, counts: { ...counts, secret: "discard" } });
    await getHomeSummary();
    if (development) expect(log).toHaveBeenCalledExactlyOnceWith("[Formalization API: home/summary] Incoming aggregate", summary);
    else expect(log).not.toHaveBeenCalled();
    log.mockClear();
    vi.mocked(apiRequest).mockResolvedValue({ ...summary, counts: { ...counts, banking: -1 } });
    await expect(getHomeSummary()).rejects.toThrow("Invalid home summary");
    expect(log).not.toHaveBeenCalled();
});

it("reads one typed aggregate and strips unexpected fields", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ...summary, secret: "discard" });
    expect(await getHomeSummary()).toEqual(summary);
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/formalization/home/summary");
});

it.each([
    null,
    {},
    { ...summary, schemaVersion: 2 },
    { ...summary, observedAt: "invalid" },
    { ...summary, period: { ...summary.period, year: "2026" } },
    { ...summary, period: { ...summary.period, timeZone: "invalid" } },
    { ...summary, period: { ...summary.period, endExclusive: summary.period.start } },
    { ...summary, sources: { ...summary.sources, legacyEnabled: "true" } },
    ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "2"].flatMap((value) => [
        ...["banking", "balance", "transferPending", "transferSigned", "closedThisYear"].map((key) => ({ ...summary, counts: { ...counts, [key]: value } })),
        { ...summary, counts: { ...counts, contracts: { ...counts.contracts, toSend: value } } },
        { ...summary, sources: { ...summary.sources, native: { ...counts, banking: value } } },
        { ...summary, sources: { ...summary.sources, legacy: { ...counts, contracts: { ...counts.contracts, pendingSignature: value } } } },
        { ...summary, sources: { ...summary.sources, duplicatesExcluded: value } },
    ]),
])("rejects invalid aggregate %j", async (payload) => {
    vi.mocked(apiRequest).mockResolvedValue(payload);
    await expect(getHomeSummary()).rejects.toThrow("Invalid home summary");
});

it("propagates unavailable sources without manufacturing zero", async () => {
    const error = new Error("unavailable");
    vi.mocked(apiRequest).mockRejectedValue(error);
    await expect(getHomeSummary()).rejects.toBe(error);
});
