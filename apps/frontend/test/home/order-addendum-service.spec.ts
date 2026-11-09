import { beforeEach, expect, it, vi } from "vitest";

import { apiRequest } from "../../src/services/api/api-client";
import { getOrderAddendum, getPendingAddendumCount, markOrderAddendumPending, markOrderAddendumSent, updateOrderAddendum } from "../../src/services/formalization/order-addendum-service";

vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
const state = { schemaVersion: 1, source: "legacy", id: "78", status: "pending", version: 1, changedAt: "2026-11-03T12:00:00.000000Z", canUpdate: true };
beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(apiRequest).mockResolvedValue(state);
});
it("reads the marker by exact normalized Habita identity", async () => {
    expect(await getOrderAddendum({ source: "legacy", id: "legacy:78" })).toEqual(state);
    expect(apiRequest).toHaveBeenCalledWith("/formalization/orders/addendum?source=legacy&id=78");
});
it("uses the BFF mutation and preserves the caller retry/version without automatic HTTP replay", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ...state, status: "completed", version: 2, replayed: false });
    const command = { source: "legacy" as const, id: "legacy:78", status: "completed" as const, expectedVersion: 1, operationId: "73da206b-67e7-46e6-8434-98b626448539" };
    expect(await updateOrderAddendum(command)).toMatchObject({ status: "completed", version: 2, replayed: false });
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/formalization/orders/addendum", { method: "POST", body: { ...command, id: "78" }, retryOnUnauthorized: false });
});
it.each([
    { ...state, schemaVersion: 2 },
    { ...state, status: "none" },
    { ...state, version: "1" },
    { ...state, version: -1 },
    { ...state, changedAt: "invalid" },
    { ...state, canUpdate: "true" },
    { ...state, id: "another-order" },
])("rejects malformed marker responses", async (response) => {
    vi.mocked(apiRequest).mockResolvedValue(response);
    await expect(getOrderAddendum({ source: "legacy", id: "78" })).rejects.toThrow();
});
it("does not send an invalid identity to the API", async () => {
    await expect(getOrderAddendum({ source: "legacy", id: "78/other" })).rejects.toThrow("Identidad de orden inválida.");
    expect(apiRequest).not.toHaveBeenCalled();
});
it.each(["  Nota de la orden  "])("marks pending without creating a calendar event and normalizes the required reason %s", async (note) => {
    vi.mocked(apiRequest).mockResolvedValue({ ...state, note: note.trim() || null, canMarkPending: false, replayed: false });
    const command = { source: "legacy" as const, id: "legacy:78", expectedVersion: 3, operationId: "73da206b-67e7-46e6-8434-98b626448539", note };
    const saved = await markOrderAddendumPending(command);
    expect(saved.note).toBe(note.trim() || null);
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/formalization/orders/addendum/pending", { method: "POST", body: { source: "legacy", id: "78", expectedVersion: 3, operationId: command.operationId, ...(note.trim() ? { note: note.trim() } : {}) }, retryOnUnauthorized: false });
});
it("rejects an oversized note before making a request", async () => {
    await expect(markOrderAddendumPending({ source: "legacy", id: "78", expectedVersion: 0, operationId: "id", note: "a".repeat(2001) })).rejects.toThrow("2000");
    expect(apiRequest).not.toHaveBeenCalled();
});
it.each([
    { ...state, note: { secret: true } },
    { ...state, canMarkPending: "true" },
])("does not infer note or manual authority from malformed metadata", async (response) => {
    vi.mocked(apiRequest).mockResolvedValue(response);
    await expect(getOrderAddendum({ source: "legacy", id: "78" })).rejects.toThrow();
});
it.each([0, 7])("reads an authoritative pending count of %s", async (total) => {
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, total });
    expect(await getPendingAddendumCount()).toBe(total);
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/formalization/addendum/summary");
});
it.each([null, undefined, "0", -1, 1.5])("does not replace an invalid count with zero: %s", async (total) => {
    vi.mocked(apiRequest).mockResolvedValue({ total });
    await expect(getPendingAddendumCount()).rejects.toThrow();
});

it.each(["", "   ", "ab"])("requires a reason before requesting pending: %s", async (note) => {
    await expect(markOrderAddendumPending({ source: "legacy", id: "78", expectedVersion: 0, operationId: "id", note })).rejects.toThrow("motivo");
    expect(apiRequest).not.toHaveBeenCalled();
});
it("records sent through its dedicated endpoint for an authorized reader", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ...state, status: "sent", canUpdate: false, canMarkSent: true, replayed: false });
    const command = { source: "legacy" as const, id: "legacy:78", expectedVersion: 1, operationId: "same-operation" };
    expect(await markOrderAddendumSent(command)).toMatchObject({ status: "sent", canMarkSent: true });
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/formalization/orders/addendum/sent", { method: "POST", body: { ...command, id: "78" }, retryOnUnauthorized: false });
});
