import { expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import { getOrderBankAssignment, saveOrderBankAssignment, unlinkOrderBankAssignment } from "../../src/services/formalization/order-bank-assignment-service";
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
it("reads the exact legacy order and version zero", async () => {
    const snapshot = { source: "legacy", id: "78", version: 0, bank: null, advisor: null, changedAt: null };
    vi.mocked(apiRequest).mockResolvedValue(snapshot);
    expect(await getOrderBankAssignment({ source: "legacy", id: "legacy:78" })).toEqual(snapshot);
    expect(apiRequest).toHaveBeenCalledWith("/formalization/orders/legacy/78/bank-assignment", expect.anything());
});
it("rejects malformed assignments", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "78", version: -1, bank: null, advisor: null, changedAt: null });
    await expect(getOrderBankAssignment({ source: "legacy", id: "78" })).rejects.toThrow();
});
it("does not replay an assignment and supports cancellation", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ source: "legacy", id: "78", version: 0, bank: null, advisor: null, changedAt: null });
    const body = { bankPublicId: "bank", advisorPublicId: "advisor", expectedVersion: 0, reason: "Asignar contacto" };
    const signal = new AbortController().signal;
    await saveOrderBankAssignment({ source: "legacy", id: "78" }, body, signal);
    expect(apiRequest).toHaveBeenLastCalledWith("/formalization/orders/legacy/78/bank-assignment", { method: "POST", body, retryOnUnauthorized: false, signal });
});
it("unlinks the exact order without replay and parses a cleared versioned assignment", async () => {
    const snapshot = { source: "legacy", id: "78", version: 3, bank: null, advisor: null, changedAt: "2026-11-03T10:00:00Z" };
    vi.mocked(apiRequest).mockResolvedValue(snapshot);
    const signal = new AbortController().signal;
    const body = { expectedVersion: 2, reason: "Cambio de financiamiento" };
    expect(await unlinkOrderBankAssignment({ source: "legacy", id: "legacy:78" }, body, signal)).toEqual(snapshot);
    expect(apiRequest).toHaveBeenLastCalledWith("/formalization/orders/legacy/78/bank-assignment/unlink", { method: "POST", body, retryOnUnauthorized: false, signal });
});
