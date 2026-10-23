import { describe, expect, it, vi } from "vitest";

import { ContractSummaryService } from "../../src/modules/crm/sales/sales-orders/contract-summary.service.js";

const role = { code: "formalizacion", name: "Formalizacion", status: "active" };
function setup(roles = [role]) {
    const transaction = { isTransaction: true };
    const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles, permissions: [{ code: "formalizacion.home.stages.read", effect: "allow" }] }) };
    const repository = { readSnapshot: vi.fn().mockImplementation((read: (tx: object) => Promise<unknown>) => read(transaction)), countNative: vi.fn().mockResolvedValue({ toSend: 2, pendingSignature: 1 }) };
    const migrated = { migratedIds: vi.fn().mockResolvedValue([4]) };
    const legacy = {
        enabled: () => true,
        pending: vi
            .fn()
            .mockResolvedValueOnce([
                { id: 3, state: "contract_pending_send" },
                { id: 4, state: "contract_pending_signature" },
                { id: 9, state: "contract_pending_signature" },
            ])
            .mockResolvedValue([]),
    };
    return { service: new ContractSummaryService(identity as never, repository as never, migrated as never, legacy), repository, migrated, legacy, transaction };
}

describe("contract summary authority and membership", () => {
    it("combines both exclusive counts with native identity priority", async () => {
        const f = setup();
        expect(await f.service.summary("session")).toMatchObject({ schemaVersion: 1, total: 5, toSend: 3, pendingSignature: 2, sources: { native: { toSend: 2, pendingSignature: 1 }, legacy: { toSend: 1, pendingSignature: 1 }, duplicatesExcluded: 1, legacyEnabled: true } });
        expect(f.migrated.migratedIds).toHaveBeenCalledWith([3, 4, 9], f.transaction);
        expect(f.repository.countNative).toHaveBeenCalledWith(f.transaction);
        expect(f.legacy.pending.mock.calls).toEqual([[0, f.transaction]]);
    });
    it.each([[], [{ ...role, status: "inactive" }], [{ ...role, code: "owner" }], [{ ...role, code: "jefe_formalizacion" }]].map((roles) => ({ roles })))("rejects missing active base role before source reads: $roles", async ({ roles }) => {
        const f = setup(roles);
        await expect(f.service.summary()).rejects.toMatchObject({ status: 403 });
        expect(f.repository.countNative).not.toHaveBeenCalled();
        expect(f.legacy.pending).not.toHaveBeenCalled();
    });
    it("retains native only when legacy is explicitly retired", async () => {
        const f = setup();
        f.legacy.enabled = () => false;
        expect(await f.service.summary()).toMatchObject({ total: 3, sources: { legacyEnabled: false } });
        expect(f.legacy.pending).not.toHaveBeenCalled();
    });
    it("fails instead of returning a partial or false zero when a source fails", async () => {
        const f = setup();
        f.legacy.pending.mockReset().mockRejectedValue(new Error("offline"));
        await expect(f.service.summary()).rejects.toMatchObject({ status: 503 });
    });
    it("does not consult legacy after native fails", async () => {
        const f = setup();
        f.repository.countNative.mockRejectedValue(new Error("offline"));
        await expect(f.service.summary()).rejects.toMatchObject({ status: 503 });
        expect(f.legacy.pending).not.toHaveBeenCalled();
    });
    it("rejects a stalled legacy cursor rather than looping", async () => {
        const f = setup();
        f.legacy.pending.mockReset().mockResolvedValue([{ id: 0, state: "contract_pending_send" }]);
        await expect(f.service.summary()).rejects.toMatchObject({ status: 503 });
    });
    it("continues after a full page and stops after the short final page", async () => {
        const f = setup();
        f.migrated.migratedIds.mockResolvedValue([]);
        f.legacy.pending
            .mockReset()
            .mockResolvedValueOnce(Array.from({ length: 500 }, (_, i) => ({ id: i + 1, state: "contract_pending_send" })))
            .mockResolvedValueOnce([{ id: 501, state: "contract_pending_signature" }]);
        expect(await f.service.summary()).toMatchObject({ toSend: 502, pendingSignature: 2 });
        expect(f.legacy.pending.mock.calls).toEqual([
            [0, f.transaction],
            [500, f.transaction],
        ]);
    });
});
