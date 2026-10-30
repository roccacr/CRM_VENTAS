import { beforeEach, expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import { getOrderHistory } from "../../src/services/formalization/order-history-service";
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
const page = { schemaVersion: 1, source: "legacy", items: [], hasMore: false, nextCursor: null, coverage: { legacyAvailable: true, legacyLinked: true, note: "Registros disponibles" } };
beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(apiRequest).mockResolvedValue(page);
});
it("reads only the selected internal order identity and escapes the cursor", async () => {
    expect(await getOrderHistory({ source: "legacy", id: "legacy:208" }, "cursor+value")).toEqual(page);
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/formalization/orders/legacy/208/history?cursor=cursor%2Bvalue");
});
it("rejects an invalid identity before sending a request", async () => {
    await expect(getOrderHistory({ source: "legacy", id: "../208" })).rejects.toThrow();
    expect(apiRequest).not.toHaveBeenCalled();
});
it.each([{ hasMore: true, nextCursor: null }, { items: "wrong" }, { coverage: null }, { schemaVersion: 2 }])("rejects malformed response %j", async (invalid) => {
    vi.mocked(apiRequest).mockResolvedValue({ ...page, ...invalid });
    await expect(getOrderHistory({ source: "legacy", id: "208" })).rejects.toThrow();
});
it("does not hide API errors with invented empty history", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error("Denied"));
    await expect(getOrderHistory({ source: "legacy", id: "208" })).rejects.toThrow("Denied");
});
