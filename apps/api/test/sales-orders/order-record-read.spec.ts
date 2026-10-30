import { expect, it, vi } from "vitest";

import { FollowUpService } from "../../src/modules/crm/sales/sales-orders/follow-up.service.js";
const publicId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const row = { id: publicId, source: "native", number: "OV-1", nativeCode: "OV-1", client: null, project: null, unit: null, responsible: null, stateCode: "unclassified", stateSince: null, completedThisYear: false };
function setup(code = "formalizacion.orders.read") {
    const profile = { roles: [{ code: "formalizacion", status: "active" }], permissions: [{ code, effect: "allow", scope: "self" }] };
    const native = { findRecordAuthority: vi.fn(), readRecord: vi.fn().mockResolvedValue(row), read: vi.fn() };
    const legacy = { enabled: () => true, readRecord: vi.fn().mockResolvedValue({ ...row, id: "legacy:208", source: "legacy" }), read: vi.fn() };
    const authority = { find: vi.fn().mockResolvedValue({ id: "1", publicId, active: true }) };
    const snapshot = { readSnapshot: vi.fn(async (run: (tx: object) => Promise<unknown>) => run({})) };
    native.findRecordAuthority = authority.find;
    const service = new FollowUpService({ getCurrentUser: () => Promise.resolve(profile) } as never, native as never, legacy, snapshot as never);
    return { service, native, legacy, authority, snapshot };
}
it("returns only an exact active unclassified item, native first for a legacy alias", async () => {
    const f = setup();
    const result = await f.service.record("session", { source: "legacy", id: "208" });
    expect(result).toMatchObject({ id: publicId, source: "native", state: { code: "unclassified" } });
    expect(result).not.toHaveProperty("counts");
    expect(result).not.toHaveProperty("projects");
    expect(f.native.readRecord).toHaveBeenCalledWith(expect.anything(), publicId, expect.anything());
    expect(f.legacy.readRecord).not.toHaveBeenCalled();
    expect(f.native.read).not.toHaveBeenCalled();
});
it("uses the legacy exact projection only if no native authority exists", async () => {
    const f = setup();
    f.authority.find.mockResolvedValue(undefined);
    expect(await f.service.record("session", { source: "legacy", id: "legacy:208" })).toMatchObject({ id: "legacy:208", source: "legacy" });
    expect(f.legacy.readRecord).toHaveBeenCalledWith(expect.anything(), "208", expect.anything());
});
it("never falls back for inactive native authority, missing native identity or database failure", async () => {
    const f = setup();
    f.authority.find.mockResolvedValue({ id: "1", publicId, active: false });
    await expect(f.service.record("session", { source: "legacy", id: "208" })).rejects.toMatchObject({ status: 404 });
    f.authority.find.mockResolvedValue(undefined);
    await expect(f.service.record("session", { source: "native", id: publicId })).rejects.toMatchObject({ status: 404 });
    f.authority.find.mockRejectedValue(new Error("database"));
    await expect(f.service.record("session", { source: "legacy", id: "208" })).rejects.toMatchObject({ status: 503 });
    expect(f.legacy.readRecord).not.toHaveBeenCalled();
});
it("rejects banner-only permission and malformed identities before SQL", async () => {
    const f = setup("formalizacion.home.stages.read");
    await expect(f.service.record("session", { source: "legacy", id: "208" })).rejects.toMatchObject({ status: 403 });
    expect(f.snapshot.readSnapshot).not.toHaveBeenCalled();
    const g = setup();
    await expect(g.service.record("session", { source: "legacy", id: "1 OR 1=1" })).rejects.toMatchObject({ status: 400 });
    expect(g.snapshot.readSnapshot).not.toHaveBeenCalled();
});
