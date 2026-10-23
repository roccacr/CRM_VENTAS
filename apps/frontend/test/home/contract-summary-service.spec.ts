import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import { getContractSummary } from "../../src/services/formalization/contract-summary-service";

vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
const summary = { schemaVersion: 1, observedAt: "2026-10-22T20:00:00.000Z", total: 9, toSend: 6, pendingSignature: 3, sources: { native: { toSend: 4, pendingSignature: 2 }, legacy: { toSend: 2, pendingSignature: 1 }, legacyEnabled: true, duplicatesExcluded: 5 } };
beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

it.each([true, false])("reads a validated safe aggregate and logs only in DEV=%s", async (development) => {
    vi.stubEnv("DEV", development);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.mocked(apiRequest).mockResolvedValue({ ...summary, secret: "never log" });
    expect(await getContractSummary()).toEqual(summary);
    expect(apiRequest).toHaveBeenCalledWith("/formalization/contracts/summary");
    if (development) expect(log).toHaveBeenCalledWith("[Formalization API: contracts/summary] Incoming aggregate", summary);
    else expect(log).not.toHaveBeenCalled();
});

it.each([
    null,
    {},
    { ...summary, schemaVersion: 2 },
    { ...summary, observedAt: "invalid" },
    { ...summary, total: "9" },
    ...[-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].flatMap((value) => [
        { ...summary, toSend: value },
        { ...summary, sources: { ...summary.sources, native: { ...summary.sources.native, pendingSignature: value } } },
        { ...summary, sources: { ...summary.sources, duplicatesExcluded: value } },
    ]),
    { ...summary, sources: { ...summary.sources, legacyEnabled: "true" } },
])("rejects malformed summaries without a zero fallback: %j", async (payload) => {
    vi.mocked(apiRequest).mockResolvedValue(payload);
    await expect(getContractSummary()).rejects.toThrow("Invalid contract summary");
});

it("propagates source failures", async () => {
    const error = new Error("offline");
    vi.mocked(apiRequest).mockRejectedValue(error);
    await expect(getContractSummary()).rejects.toBe(error);
});
