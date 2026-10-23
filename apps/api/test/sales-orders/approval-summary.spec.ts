import { describe, expect, it, vi } from "vitest";

import { ApprovalSummaryService } from "../../src/modules/crm/sales/sales-orders/approval-summary.service.js";

describe("approval summary", () => {
    const permission = { code: "formalizacion.home.approvals.read", effect: "allow", scope: "all_areas", source: "role" };
    function setup(permissions = [permission]) {
        const transaction = { isTransaction: true };
        const identity = { getCurrentUser: vi.fn().mockResolvedValue({ permissions }) };
        const repository = { readSnapshot: vi.fn().mockImplementation((read: (tx: object) => Promise<unknown>) => read(transaction)), countPending: vi.fn().mockResolvedValue(2), migratedIds: vi.fn().mockResolvedValue([4]) };
        const legacy = { enabled: () => true, pendingIds: vi.fn().mockResolvedValueOnce([3, 4]).mockResolvedValue([]) };
        const service = new ApprovalSummaryService(identity as never, repository as never, legacy);
        return { service, repository, legacy, transaction };
    }
    it("counts native orders and only non-migrated legacy orders", async () => {
        const { service } = setup();
        expect(await service.summary("session")).toMatchObject({ total: 3, sources: { native: 2, legacy: 1, duplicatesExcluded: 1 } });
    });
    it("rejects missing permission before querying either source", async () => {
        const { service, repository, legacy } = setup([]);
        await expect(service.summary("session")).rejects.toMatchObject({ status: 403 });
        expect(repository.countPending).not.toHaveBeenCalled();
        expect(legacy.pendingIds).not.toHaveBeenCalled();
    });
    it("explicit denial overrides role allowance", async () => {
        const { service } = setup([permission, { ...permission, effect: "deny" }]);
        await expect(service.summary("session")).rejects.toMatchObject({ status: 403 });
    });
    it("does not report a partial count when legacy fails", async () => {
        const { service, legacy } = setup();
        legacy.pendingIds.mockReset().mockRejectedValue(new Error("unavailable"));
        await expect(service.summary("session")).rejects.toMatchObject({ status: 503 });
    });
    it("supports retiring the legacy connection without querying it", async () => {
        const { service, legacy } = setup();
        legacy.enabled = () => false;
        expect(await service.summary("session")).toMatchObject({ total: 2, sources: { legacy: 0, legacyEnabled: false } });
        expect(legacy.pendingIds).not.toHaveBeenCalled();
    });
    it("never falls back to a legacy-only count when native fails", async () => {
        const { service, repository, legacy } = setup();
        repository.countPending.mockRejectedValue(new Error("offline"));
        await expect(service.summary("session")).rejects.toMatchObject({ status: 503 });
        expect(legacy.pendingIds).not.toHaveBeenCalled();
    });
    it("uses the final legacy identity as the next page cursor", async () => {
        const { service, legacy, repository } = setup();
        repository.migratedIds.mockResolvedValue([]);
        legacy.pendingIds
            .mockReset()
            .mockResolvedValueOnce(Array.from({ length: 500 }, (_, i) => i + 1))
            .mockResolvedValueOnce([509]);
        expect(await service.summary("session")).toMatchObject({ total: 503 });
        expect(legacy.pendingIds.mock.calls).toEqual([
            [0, expect.anything()],
            [500, expect.anything()],
        ]);
    });
    it("does not request an empty page after the final short page", async () => {
        const { service, legacy } = setup();
        await service.summary("session");
        expect(legacy.pendingIds.mock.calls).toEqual([[0, expect.anything()]]);
    });
    it("counts both sources and migrated aliases in one read snapshot", async () => {
        const f = setup();
        await f.service.summary("session");
        expect(f.repository.readSnapshot).toHaveBeenCalledOnce();
        expect(f.repository.countPending).toHaveBeenCalledWith(f.transaction);
        expect(f.legacy.pendingIds).toHaveBeenCalledWith(0, f.transaction);
        expect(f.repository.migratedIds).toHaveBeenCalledWith([3, 4], f.transaction);
    });
});
