import { beforeEach, expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import { getDatabaseOrder } from "../../src/services/formalization/database-order-service";

vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
const data = { schemaVersion: 1, observedAt: "2026-10-27T12:00:00Z", source: "legacy", order: { id: "legacy:208", sourceFields: { id_ov: 208 } }, lead: null, contact: null, unitFile: null, references: [], warnings: ["lead:missing"] };
beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(apiRequest).mockResolvedValue(data);
});
it("reads the CRM record independently from the provider using internal identity", async () => {
    expect(await getDatabaseOrder({ source: "legacy", id: "legacy:208" })).toEqual(data);
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/formalization/orders/legacy/208/database");
});
it("refuses invalid identity without requesting", async () => {
    await expect(getDatabaseOrder({ source: "legacy", id: "../208" })).rejects.toThrow();
    expect(apiRequest).not.toHaveBeenCalled();
});
it("does not accept malformed snapshots", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ...data, source: "unknown" });
    await expect(getDatabaseOrder({ source: "legacy", id: "208" })).rejects.toThrow();
});
