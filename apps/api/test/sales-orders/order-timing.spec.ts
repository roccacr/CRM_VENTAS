import { describe, expect, it, vi } from "vitest";

import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { orderTimingIdentity, orderTimingQuery } from "../../src/modules/crm/sales/sales-orders/order-timing.contract.js";
import { OrderTimingService } from "../../src/modules/crm/sales/sales-orders/order-timing.service.js";

const publicId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
function setup() {
    const profile = { roles: [{ code: "formalizacion", name: "Formalizacion", status: "active" }], permissions: [{ code: "formalizacion.orders.read", effect: "allow", scope: "all_areas", source: "role" }], user: { publicId: "actor" } } as IdentityProfile;
    const repository = { find: vi.fn().mockResolvedValue(undefined), read: vi.fn().mockResolvedValue({ total: 0, summary: { startedAt: null, finishedAt: null, totalSeconds: null, knownSeconds: 0, complete: false }, items: [] }) };
    const legacy = { enabled: () => true, find: vi.fn().mockResolvedValue({ id: "901", publicId: "legacy:901", active: true, pendingApproval: false, approved: 1, rawStage: "contract_pending_send", contractSigned: 0, completedThisYear: 0, ownerId: "actor" }), read: vi.fn().mockResolvedValue({ total: 0, summary: { startedAt: null, finishedAt: null, totalSeconds: null, knownSeconds: 0, complete: false }, items: [] }) };
    const snapshot = { readSnapshot: async (read: (tx: object) => Promise<unknown>) => read({}) };
    const service = new OrderTimingService({ getCurrentUser: () => Promise.resolve(profile) } as IdentityService, repository, legacy, snapshot as never);
    return { profile, repository, legacy, service };
}
describe("per-visit order timing", () => {
    it("validates native/public and legacy identities without guessing provider IDs", () => {
        expect(orderTimingIdentity.parse({ source: "legacy", id: "legacy:901" })).toEqual({ source: "legacy", id: "901" });
        expect(orderTimingIdentity.safeParse({ source: "native", id: "901" }).success).toBe(false);
        expect(orderTimingIdentity.safeParse({ source: "legacy", id: "1 OR 1=1" }).success).toBe(false);
        expect(orderTimingQuery.parse({})).toEqual({ page: 1, pageSize: 50 });
        expect(orderTimingQuery.safeParse({ pageSize: 101 }).success).toBe(false);
    });
    it("blocks a direct deny before either database reader", async () => {
        const f = setup();
        f.profile.permissions.push({ code: "formalizacion.orders.read", effect: "deny", scope: null, source: "override" });
        await expect(f.service.read("session", { source: "legacy", id: "901" }, {})).rejects.toMatchObject({ status: 403 });
        expect(f.repository.find).not.toHaveBeenCalled();
        expect(f.legacy.find).not.toHaveBeenCalled();
    });
    it("keeps native authority for a legacy pointer without touching old history", async () => {
        const f = setup();
        f.repository.find.mockResolvedValue({ id: "42", publicId, active: true, pendingApproval: false, approved: 1, rawStage: "contract_pending_send", contractSigned: 0, completedThisYear: 0, ownerId: "actor" });
        const response = await f.service.read("session", { source: "legacy", id: "901" }, {});
        expect(response.order).toEqual({ source: "native", id: publicId });
        expect(f.legacy.find).not.toHaveBeenCalled();
        expect(f.legacy.read).not.toHaveBeenCalled();
    });
    it("does not fall back when an existing native alias is inactive", async () => {
        const f = setup();
        f.repository.find.mockResolvedValue({ id: "42", publicId, active: false, pendingApproval: false, approved: 1, rawStage: "contract_pending_send", contractSigned: 0, completedThisYear: 0, ownerId: "actor" });
        await expect(f.service.read("session", { source: "legacy", id: "901" }, {})).rejects.toMatchObject({ status: 404 });
        expect(f.legacy.find).not.toHaveBeenCalled();
    });
    it("reads real legacy timing and keeps unknown process dates null", async () => {
        const f = setup();
        const response = await f.service.read("session", { source: "legacy", id: "901" }, { page: 2, pageSize: 10 });
        expect(f.legacy.read).toHaveBeenCalledWith(expect.anything(), "901", { offset: 10, limit: 10 });
        expect(response.summary).toEqual({ startedAt: null, finishedAt: null, totalSeconds: null, knownSeconds: 0, complete: false });
    });
    it("reads an active pending-approval order with detail permission alone", async () => {
        const f = setup();
        f.legacy.find.mockResolvedValue({ id: "901", publicId: "legacy:901", active: true, pendingApproval: true, ownerId: "actor" });
        await expect(f.service.read("session", { source: "legacy", id: "901" }, {})).resolves.toMatchObject({ order: { id: "legacy:901" } });
        expect(f.legacy.read).toHaveBeenCalled();
    });
    it("reads other sellers with a self read grant", async () => {
        const f = setup();
        f.profile.permissions = [{ code: "formalizacion.orders.read", effect: "allow", scope: "self", source: "override" }];
        f.legacy.find.mockResolvedValue({ id: "901", publicId: "legacy:901", active: true, pendingApproval: false, approved: 1, rawStage: "contract_pending_send", contractSigned: 0, completedThisYear: 0, ownerId: "another" });
        await expect(f.service.read("session", { source: "legacy", id: "901" }, {})).resolves.toMatchObject({ order: { id: "legacy:901" } });
        expect(f.legacy.read).toHaveBeenCalled();
    });
});
