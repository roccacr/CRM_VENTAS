import { afterEach, expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import { getProjectDistribution } from "../../src/services/formalization/project-distribution-service";
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
const response = () => ({ schemaVersion: 1, observedAt: "2026-11-03T18:00:00.000Z", totalOrders: 4, series: ["approvals", "send", "addendum"], projects: [{ id: "legacy-project:1", name: "Amara", total: 4, counts: { approvals: 1, send: 3, addendum: 2 } }] });
afterEach(() => vi.resetAllMocks());
it("reads the complete aggregate and preserves overlapping addendum without summing it into orders", async () => {
    vi.mocked(apiRequest).mockResolvedValue(response());
    expect(await getProjectDistribution()).toEqual(response());
    expect(apiRequest).toHaveBeenCalledWith("/formalization/home/project-distribution");
});
it.each([
    { ...response(), totalOrders: 3 },
    { ...response(), series: ["unknown"] },
    { ...response(), series: ["send", "send"] },
    { ...response(), projects: [{ id: null, name: "Sin proyecto", total: 4, counts: { approvals: 1, send: -1, addendum: 2 } }] },
    { ...response(), projects: [{ id: null, name: "Sin proyecto", total: 4, counts: { approvals: 1, send: 5, addendum: 2 } }] },
    { ...response(), series: ["send"], projects: [{ id: null, name: "Sin proyecto", total: 4, counts: { send: 3, approvals: 1 } }] },
    { ...response(), observedAt: "invalid" },
])("rejects malformed, partial or unadvertised aggregate data", async (value) => {
    vi.mocked(apiRequest).mockResolvedValue(value);
    await expect(getProjectDistribution()).rejects.toThrow();
});
