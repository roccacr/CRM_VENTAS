import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeSummaryService } from "../../src/modules/crm/sales/sales-orders/home-summary.service.js";

const counts = { contracts: { toSend: 2, pendingSignature: 3 }, banking: 4, balance: 5, transferPending: 6, transferSigned: 7, closedThisYear: 8 };
function fixture(roles = [{ code: "formalizacion", status: "active" }]) {
    const tx = {};
    const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles, permissions: [{ code: "formalizacion.home.stages.read", effect: "allow" }] }) };
    const repository = { readSnapshot: vi.fn(async (read: (transaction: object) => Promise<unknown>) => read(tx)), aggregate: vi.fn().mockResolvedValue(counts) };
    const legacy = { enabled: vi.fn(() => true), aggregate: vi.fn().mockResolvedValue({ counts, duplicatesExcluded: 9 }) };
    return { tx, identity, repository, legacy, service: new HomeSummaryService(identity as never, repository as never, legacy) };
}
afterEach(() => vi.useRealTimers());
describe("Home aggregate", () => {
    it("combines two aggregate rows in one snapshot with Costa Rica year boundaries", async () => {
        vi.useFakeTimers().setSystemTime(new Date("2027-01-01T05:59:59.999Z"));
        const f = fixture();
        const result = await f.service.summary("session");
        expect(result).toEqual({ schemaVersion: 1, observedAt: "2027-01-01T05:59:59.999Z", period: { year: 2026, timeZone: "America/Costa_Rica", start: "2026-01-01T06:00:00.000Z", endExclusive: "2027-01-01T06:00:00.000Z" }, counts: { contracts: { toSend: 4, pendingSignature: 6 }, banking: 8, balance: 10, transferPending: 12, transferSigned: 14, closedThisYear: 16 }, sources: { native: counts, legacy: counts, legacyEnabled: true, duplicatesExcluded: 9 } });
        expect(f.repository.aggregate).toHaveBeenCalledExactlyOnceWith(f.tx, result.period);
        expect(f.legacy.aggregate).toHaveBeenCalledExactlyOnceWith(f.tx, result.period);
        expect(f.repository.readSnapshot).toHaveBeenCalledOnce();
    });
    it("starts the new business year at 06:00 UTC", async () => {
        vi.useFakeTimers().setSystemTime(new Date("2027-01-01T06:00:00Z"));
        expect((await fixture().service.summary()).period.year).toBe(2027);
    });
    it.each([[], [{ code: "formalizacion", status: "inactive" }], [{ code: "owner", status: "active" }]].map((roles) => ({ roles })))("denies without an active base role before snapshot: $roles", async ({ roles }) => {
        const f = fixture(roles);
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
