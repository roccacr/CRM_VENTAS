import { describe, expect, it, vi } from "vitest";

import { ContractOrdersService } from "../../src/modules/crm/sales/sales-orders/contract-orders.service.js";

const row = (source: "native" | "legacy", sortId: string) => ({ source, sortId, id: source === "native" ? "01ARZ3NDEKTSV4RRFFQ69G5FAV" : sortId, businessId: "ORDER", state: "contract_pending_send" as const, sequence: 0 });
function setup() {
    const tx = { isTransaction: true };
    const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles: [{ code: "formalizacion", status: "active" }] }) };
    const snapshot = { readSnapshot: vi.fn().mockImplementation((read: (transaction: object) => Promise<unknown>) => read(tx)) };
    const repository = { page: vi.fn().mockResolvedValue([row("native", "42")]) };
    const legacy = { enabled: () => true, orders: vi.fn().mockResolvedValue([row("legacy", "901"), row("legacy", "902")]) };
    return { service: new ContractOrdersService(identity as never, snapshot as never, repository, legacy), tx, identity, repository, legacy };
}

describe("contract orders bounded native-first pages", () => {
    it("fills native then nonmigrated legacy in the same read snapshot and hides internal sort keys", async () => {
        const f = setup();
        expect(await f.service.list("session", { queue: "send", limit: 2 })).toEqual({ items: [expect.objectContaining({ source: "native", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" }), expect.objectContaining({ source: "legacy", id: "901" })], nextCursor: "legacy:901" });
        expect(f.repository.page).toHaveBeenCalledWith(f.tx, "send", "0", 3);
        expect(f.legacy.orders).toHaveBeenCalledWith(f.tx, "send", "0", 2);
        const result = await f.service.list("session", { queue: "send", limit: 2 });
        expect(result.items[0]).not.toHaveProperty("sortId");
    });
    it("continues legacy without restarting the native phase", async () => {
        const f = setup();
        await f.service.list(undefined, { queue: "send", limit: 1, cursor: "legacy:900" });
        expect(f.repository.page).not.toHaveBeenCalled();
        expect(f.legacy.orders).toHaveBeenCalledWith(f.tx, "send", "900", 2);
    });
    it("keeps the next cursor native while native has another page", async () => {
        const f = setup();
        f.repository.page.mockResolvedValue([row("native", "42"), row("native", "43")]);
        expect(await f.service.list(undefined, { queue: "send", limit: 1 })).toMatchObject({ nextCursor: "native:42" });
        expect(f.legacy.orders).not.toHaveBeenCalled();
    });
    it("rejects no-role users before any page lookup", async () => {
        const f = setup();
        f.identity.getCurrentUser.mockResolvedValue({ roles: [] });
        await expect(f.service.list(undefined, { queue: "send", limit: 2 })).rejects.toMatchObject({ status: 403 });
        expect(f.repository.page).not.toHaveBeenCalled();
        expect(f.legacy.orders).not.toHaveBeenCalled();
    });
    it.each([{ queue: "bank" }, { queue: "send", limit: 201 }, { queue: "send", limit: null }, { queue: "send", cursor: "legacy:2147483648" }, { queue: "send", cursor: "native:18446744073709551616" }, { queue: "send", cursor: "anything" }])("rejects invalid bounded query: %j", async (query) => {
        const f = setup();
        await expect(f.service.list(undefined, query as never)).rejects.toMatchObject({ status: 400 });
        expect(f.repository.page).not.toHaveBeenCalled();
    });
    it("does not return native-only partial pages when enabled legacy fails", async () => {
        const f = setup();
        f.legacy.orders.mockRejectedValue(new Error("offline"));
        await expect(f.service.list(undefined, { queue: "send", limit: 2 })).rejects.toMatchObject({ status: 503 });
    });
});
