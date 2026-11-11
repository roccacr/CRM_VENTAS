import fc from "fast-check";
import { expect, it, vi } from "vitest";

import { FollowUpService } from "../../src/modules/crm/sales/sales-orders/follow-up.service.js";
import { orderTimingIdentity } from "../../src/modules/crm/sales/sales-orders/order-timing.contract.js";
const publicId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const row = { id: publicId, source: "native", number: "OV-1", nativeCode: "OV-1", client: null, project: null, unit: null, responsible: null, stateCode: "unclassified", stateSince: null, completedThisYear: false };
function setup(code = "formalizacion.orders.read") {
    const profile = { roles: [{ code: "formalizacion", status: "active" }], permissions: [{ code, effect: "allow", scope: "self" }] };
    const native = { findRecordAuthority: vi.fn(), readRecord: vi.fn().mockResolvedValue(row), read: vi.fn() };
    const legacy = { enabled: () => true, projection: vi.fn(), readRecord: vi.fn().mockResolvedValue({ ...row, id: "legacy:208", source: "legacy" }), read: vi.fn() };
    const authority = { find: vi.fn().mockResolvedValue({ id: "1", publicId, active: true }) };
    const snapshot = { readSnapshot: vi.fn(async (run: (tx: object) => Promise<unknown>) => run({})) };
    native.findRecordAuthority = authority.find;
    const service = new FollowUpService({ getCurrentUser: () => Promise.resolve(profile) } as never, native as never, legacy, snapshot as never);
    return { service, native, legacy, authority, snapshot, profile };
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
it("never falls back for deleted native authority, missing native identity or database failure", async () => {
    const f = setup();
    f.authority.find.mockResolvedValue({ id: "1", publicId, active: false, deleted: true });
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

it("reads inactive native authority without falling back to legacy", async () => {
    const f = setup();
    f.authority.find.mockResolvedValue({ id: "1", publicId, active: false, deleted: false });
    await expect(f.service.record("session", { source: "legacy", id: "208" })).resolves.toMatchObject({ id: publicId, source: "native" });
    expect(f.legacy.readRecord).not.toHaveBeenCalled();
});

it("property: inactive reads preserve deny precedence, deletion and native authority", async () => {
    await fc.assert(
        fc.asyncProperty(fc.boolean(), fc.boolean(), fc.boolean(), fc.boolean(), async (active, deleted, granted, denied) => {
            const f = setup();
            if (!granted) f.profile.permissions = [];
            if (denied) f.profile.permissions.push({ code: "formalizacion.orders.read", effect: "deny", scope: "self" });
            f.authority.find.mockResolvedValue({ publicId, active, deleted });
            const result = f.service.record("session", { source: "legacy", id: "85" });
            if (!granted || denied) await expect(result).rejects.toMatchObject({ status: 403 });
            else if (deleted) await expect(result).rejects.toMatchObject({ status: 404 });
            else await expect(result).resolves.toMatchObject({ id: publicId, source: "native" });
            expect(f.legacy.readRecord).not.toHaveBeenCalled();
            expect(f.native.read).not.toHaveBeenCalled();
        }),
        { numRuns: 100, seed: 20261111 },
    );
});
it("fuzz: malformed identities never reach a database snapshot", async () => {
    await fc.assert(
        fc.asyncProperty(
            fc.anything().filter((value) => !orderTimingIdentity.safeParse(value).success),
            async (input) => {
                const f = setup();
                await expect(f.service.record("session", input)).rejects.toMatchObject({ status: 400 });
                expect(f.snapshot.readSnapshot).not.toHaveBeenCalled();
            },
        ),
        { numRuns: 100, seed: 20261111 },
    );
});
