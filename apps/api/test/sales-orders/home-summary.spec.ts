import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeSummaryService } from "../../src/modules/crm/sales/sales-orders/home-summary.service.js";

const counts = { contracts: { toSend: 2, pendingSignature: 3 }, banking: 4, bankingInProgress: 0, balance: 5, transferPending: 6, transferSigned: 7, closedThisYear: 8 };
function fixture(roles = [{ code: "formalizacion", status: "active" }]) {
    const tx = {};
    const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles, permissions: [{ code: "formalizacion.home.stages.read", effect: "allow" }] }) };
    const repository = { readSnapshot: vi.fn(async (read: (transaction: object) => Promise<unknown>) => read(tx)), aggregate: vi.fn().mockResolvedValue(counts) };
    const legacy = { enabled: vi.fn(() => true), aggregate: vi.fn().mockResolvedValue({ counts, duplicatesExcluded: 9 }), orderLabels: vi.fn().mockResolvedValue([]) };
    return { tx, identity, repository, legacy, service: new HomeSummaryService(identity as never, repository as never, legacy) };
}
afterEach(() => vi.useRealTimers());
describe("Home aggregate", () => {
    it("combines two aggregate rows in one snapshot with Costa Rica year boundaries", async () => {
        vi.useFakeTimers().setSystemTime(new Date("2027-01-01T05:59:59.999Z"));
        const f = fixture();
        const result = await f.service.summary("session");
        expect(result).toEqual({ schemaVersion: 1, observedAt: "2027-01-01T05:59:59.999Z", period: { year: 2026, timeZone: "America/Costa_Rica", start: "2026-01-01T06:00:00.000Z", endExclusive: "2027-01-01T06:00:00.000Z" }, counts: { contracts: { toSend: 4, pendingSignature: 6 }, banking: 8, bankingInProgress: 0, balance: 10, transferPending: 12, transferSigned: 14, closedThisYear: 16 }, sources: { native: counts, legacy: counts, legacyEnabled: true, duplicatesExcluded: 9 } });
        expect(f.repository.aggregate).toHaveBeenCalledExactlyOnceWith(f.tx, result.period);
        expect(f.legacy.aggregate).toHaveBeenCalledExactlyOnceWith(f.tx, result.period);
        expect(f.repository.readSnapshot).toHaveBeenCalledOnce();
    });
    it("starts the new business year at 06:00 UTC", async () => {
        vi.useFakeTimers().setSystemTime(new Date("2027-01-01T06:00:00Z"));
        expect((await fixture().service.summary()).period.year).toBe(2027);
    });
    it.each([[], [{ code: "formalizacion", status: "inactive" }], [{ code: "owner", status: "active" }]].map((roles) => ({ roles })))("denies without effective read permissions regardless of role labels: $roles", async ({ roles }) => {
        const f = fixture(roles);
        f.identity.getCurrentUser.mockResolvedValue({ roles, permissions: [] });
        await expect(f.service.summary()).rejects.toMatchObject({ status: 403 });
        expect(f.repository.readSnapshot).not.toHaveBeenCalled();
        expect(f.legacy.aggregate).not.toHaveBeenCalled();
    });
    it("omits the disabled legacy query and reports zero legacy contributions", async () => {
        const f = fixture();
        f.legacy.enabled.mockReturnValue(false);
        const result = await f.service.summary();
        expect(result.counts).toEqual(counts);
        expect(result.sources.legacy.closedThisYear).toBe(0);
        expect(result.sources.legacyEnabled).toBe(false);
        expect(f.legacy.aggregate).not.toHaveBeenCalled();
    });
    it.each(["repository", "legacy"] as const)("fails closed on %s failure", async (source) => {
        const f = fixture();
        f[source].aggregate.mockRejectedValue(new Error("private database error"));
        await expect(f.service.summary()).rejects.toMatchObject({ status: 503 });
    });
});

it("masks forbidden banner counts in both sources for contracts-only reads", async () => {
    const f = fixture();
    f.identity.getCurrentUser.mockResolvedValue({ roles: [{ code: "formalizacion", status: "active" }], permissions: [{ code: "formalizacion.home.contracts.read", effect: "allow" }] });
    const result = await f.service.summary();
    expect(result.counts).toEqual({ contracts: { toSend: 4, pendingSignature: 6 }, banking: 0, bankingInProgress: 0, balance: 0, transferPending: 0, transferSigned: 0, closedThisYear: 0 });
    for (const source of [result.sources.native, result.sources.legacy]) expect(source).toEqual({ contracts: { toSend: 2, pendingSignature: 3 }, banking: 0, bankingInProgress: 0, balance: 0, transferPending: 0, transferSigned: 0, closedThisYear: 0 });
    expect(result.sources.duplicatesExcluded).toBe(0);
});

it("recent activity uses only the authenticated actor and resolves legacy order labels in one batch", async () => {
    const f = fixture();
    f.identity.getCurrentUser.mockResolvedValue({ user: { publicId: "actor" }, roles: [{ code: "formalizacion", status: "active" }], permissions: [{ code: "formalizacion.orders.read", effect: "allow" }] });
    const row = { id: "event", source: "legacy", orderId: "271", action: "approval_change", at: "2026-10-28T20:00:00Z", fromState: "pending_approval", toState: "contract_pending_send", approval: "approved" };
    Object.assign(f.repository, { recentActivity: vi.fn().mockResolvedValue([row]), nativeOrderLabels: vi.fn().mockResolvedValue([]) });
    f.legacy.orderLabels.mockResolvedValue([{ id: "271", number: "BC552" }] as never);
    const result = await f.service.recentActivity("session");
    expect(result.items).toEqual([{ id: row.id, action: row.action, at: row.at, fromState: row.fromState, toState: row.toState, approval: row.approval, orderNumber: "BC552" }]);
    expect(Reflect.get(f.repository, "recentActivity")).toHaveBeenCalledExactlyOnceWith(f.tx, "actor");
    expect(f.legacy.orderLabels).toHaveBeenCalledExactlyOnceWith(f.tx, ["271"]);
});
it("denies recent activity before SQL when the independent order permission is absent", async () => {
    const f = fixture();
    await expect(f.service.recentActivity()).rejects.toMatchObject({ status: 403 });
    expect(f.repository.readSnapshot).not.toHaveBeenCalled();
});
