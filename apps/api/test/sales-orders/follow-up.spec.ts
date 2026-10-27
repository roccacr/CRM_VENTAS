import { describe, expect, it, vi } from "vitest";

import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { followUpQuery, presentFollowUpRow } from "../../src/modules/crm/sales/sales-orders/follow-up.contract.js";
import { FollowUpService } from "../../src/modules/crm/sales/sales-orders/follow-up.service.js";
import type { HomeSummaryRepository } from "../../src/modules/crm/sales/sales-orders/home-summary.repository.js";

const counts = { all: 0, approvals: 0, contracts: 0, send: 0, signature: 0, bank: 0, balance: 0, transfer: 0, signed: 0, closed: 0 };
const empty = () => ({ total: 0, counts: { ...counts }, projects: [], items: [] });
function setup(codes = ["formalizacion.home.stages.read", "formalizacion.home.approvals.read"], roles = [{ code: "formalizacion", status: "active" }]) {
    const profile = { roles, user: { publicId: "actor" }, permissions: codes.map((code) => ({ code, effect: "allow", scope: "own_area", source: "role" })) } as IdentityProfile;
    const identity = { getCurrentUser: vi.fn().mockResolvedValue(profile) } as unknown as IdentityService;
    const native = { readSnapshot: vi.fn(async (read: (tx: object) => Promise<unknown>) => read({})), read: vi.fn().mockResolvedValue(empty()) };
    const legacy = { enabled: () => true, read: vi.fn().mockResolvedValue(empty()) };
    const service = new FollowUpService(identity, native, legacy, native as unknown as HomeSummaryRepository);
    return { profile, native, legacy, service };
}

describe("Formalization follow-up", () => {
    it("defaults to a bounded all queue and rejects malformed or oversized filters", () => {
        expect(followUpQuery.parse({})).toMatchObject({ queue: "all", page: 1, pageSize: 25, search: "", projectId: "" });
        for (const value of [{ pageSize: "101" }, { page: "-1" }, { page: "1e2" }, { queue: "unknown" }, { search: "x".repeat(121) }, { projectId: "1 OR 1=1" }, { extra: "ignored" }]) expect(followUpQuery.safeParse(value).success).toBe(false);
    });
    it("authorizes before either source and never grants an Owner label a bypass", async () => {
        const { service, native, legacy } = setup([], [{ code: "owner", status: "active" }]);
        await expect(service.list("session", {})).rejects.toMatchObject({ status: 403 });
        expect(native.readSnapshot).not.toHaveBeenCalled();
        expect(legacy.read).not.toHaveBeenCalled();
    });
    it("rejects a direct stage deny before SQL", async () => {
        const { service, profile, native } = setup();
        profile.permissions.push({ code: "formalizacion.home.stages.read", effect: "deny", scope: null, source: "override" });
        await expect(service.list("session", {})).rejects.toMatchObject({ status: 403 });
        expect(native.read).not.toHaveBeenCalled();
    });
    it("rejects an approvals queue without its separate grant before SQL", async () => {
        const { service, native } = setup(["formalizacion.home.stages.read"]);
        await expect(service.list("session", { queue: "approvals" })).rejects.toMatchObject({ status: 403 });
        expect(native.read).not.toHaveBeenCalled();
    });
    it("reads native first then offsets the remaining legacy page and sums full totals", async () => {
        const { service, native, legacy } = setup();
        native.read.mockResolvedValue({ ...empty(), total: 12, counts: { ...counts, all: 12 } });
        legacy.read.mockResolvedValue({ ...empty(), total: 30, counts: { ...counts, all: 30 } });
        const result = await service.list("session", { page: "2", pageSize: "10" });
        expect(native.read).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ offset: 10, limit: 10 }), expect.anything(), expect.anything());
        expect(legacy.read).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ offset: 0, limit: 10 }), expect.anything(), expect.anything());
        expect(result.page).toEqual({ number: 2, size: 10, total: 42, totalPages: 5 });
        expect(result.counts.all).toBe(42);
        expect(native.read.mock.invocationCallOrder[0]).toBeLessThan(Number(legacy.read.mock.invocationCallOrder[0]));
    });
    it("does not return a partial native response if legacy fails", async () => {
        const { service, legacy } = setup();
        legacy.read.mockRejectedValue(new Error("source unavailable"));
        await expect(service.list("session", {})).rejects.toMatchObject({ status: 503 });
    });
    it("propagates approval restrictions to both sources and reads again without a cache", async () => {
        const { service, native, legacy } = setup(["formalizacion.home.stages.read"]);
        await service.list("session", {});
        await service.list("session", {});
        expect(native.read).toHaveBeenCalledTimes(2);
        expect(legacy.read).toHaveBeenCalledTimes(2);
        expect(native.read).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({ approvals: false }));
        expect(legacy.read).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({ approvals: false }));
    });
    it("does not invent stage age for missing evidence and supplies a read-only next step", () => {
        const row = { id: "legacy:1", source: "legacy" as const, number: "OV-1", nativeCode: null, client: null, clientEmail: null, project: null, unit: null, responsible: null, stateCode: "contract_pending_send" as const, stateSince: null, completedThisYear: false };
        const presented = presentFollowUpRow(row, new Date("2026-10-26T12:00:00Z"));
        expect(presented.state).toMatchObject({ code: "contract_pending_send", label: "Por enviar", since: null, days: null });
        expect(presented.nextStep).toBe("Registrar el envío del contrato");
        expect(presented).not.toHaveProperty("stateCode");
    });
});
