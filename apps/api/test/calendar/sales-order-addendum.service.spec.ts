import { expect, it, vi } from "vitest";

import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { SalesOrderAddendumService } from "../../src/modules/crm/sales/sales-orders/sales-order-addendum.js";

const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const identity = { source: "native", id };
const body = { ...identity, status: "completed", expectedVersion: 3, operationId: "550e8400-e29b-41d4-a716-446655440000" };
function setup() {
    const profile = { user: { publicId: "actor" }, roles: [{ code: "formalizacion", status: "active" }], orgUnits: [{ code: "formalizacion", status: "active" }], permissions: ["formalizacion.orders.read", "formalizacion.orders.addendum.read", "formalizacion.orders.addendum.update", "formalizacion.calendar.read"].map((code) => ({ code, effect: "allow", scope: "own_area", source: "role" })) } as unknown as IdentityProfile;
    const repository = {
        read: vi.fn().mockResolvedValue({ ...identity, status: "pending", version: 3, changedAt: null, note: null }),
        result: (value: object) => ({ schemaVersion: 1, ...value }),
        change: vi.fn().mockResolvedValue({ schemaVersion: 1, ...identity, status: "completed", version: 4, changedAt: null, note: null, replayed: false }),
        future: vi.fn().mockResolvedValue({ schemaVersion: 1, ...identity, blocked: false, existing: null }),
        markManually: vi.fn().mockResolvedValue({ schemaVersion: 1, ...identity, status: "pending", version: 4, note: null, changedAt: null, replayed: false }),
        summary: vi.fn().mockResolvedValue({ total: 3 }),
    };
    const service = new SalesOrderAddendumService({ getCurrentUser: vi.fn().mockResolvedValue(profile) } as never, repository as never);
    return { profile, repository, service };
}
it("reads and changes only the server-authorized order; actor cannot be provided by the caller", async () => {
    const f = setup();
    expect(await f.service.read("session", identity)).toMatchObject({ status: "pending", canUpdate: true });
    expect(await f.service.change("session", body)).toMatchObject({ status: "completed", canUpdate: true, replayed: false });
    expect(f.repository.change).toHaveBeenCalledWith({ ...body, actorPublicId: "actor" });
    await expect(f.service.change("session", { ...body, actorPublicId: "forged" })).rejects.toMatchObject({ status: 400 });
});
it.each(["formalizacion.orders.read", "formalizacion.orders.addendum.update"])("honors an explicit deny for %s without touching business data", async (code) => {
    const f = setup();
    f.profile.permissions.push({ code, effect: "deny", scope: null, source: "override" });
    await expect(f.service.change("session", body)).rejects.toMatchObject({ status: 403 });
    expect(f.repository.change).not.toHaveBeenCalled();
    if (code.endsWith("addendum.update")) expect(await f.service.read("session", identity)).toMatchObject({ canUpdate: false });
    else await expect(f.service.read("session", identity)).rejects.toMatchObject({ status: 403 });
});
it("cannot infer order access from Owner alone or from the addendum grant", async () => {
    const f = setup();
    f.profile.roles = [{ code: "owner", status: "active" }] as IdentityProfile["roles"];
    f.profile.permissions = f.profile.permissions.filter(({ code }) => code !== "formalizacion.orders.read");
    await expect(f.service.read("session", identity)).rejects.toMatchObject({ status: 403 });
    expect(f.repository.read).not.toHaveBeenCalled();
});
it.each([{ status: "sent" }, { status: "pending" }, { status: "forged" }, { expectedVersion: -1 }, { operationId: "invalid" }, { id: "unknown" }])("rejects invalid direct transitions: %j", async (changes) => {
    const f = setup();
    await expect(f.service.change("session", { ...body, ...changes })).rejects.toMatchObject({ status: 400 });
    expect(f.repository.change).not.toHaveBeenCalled();
});
it("checks future events through the authorized current calendar, with optional current-event exclusion", async () => {
    const f = setup();
    expect(await f.service.future("session", { ...identity, excludeEventId: id })).toMatchObject({ blocked: false });
    expect(f.repository.future).toHaveBeenCalledWith(identity, { actorPublicId: "actor", broad: true, excludeEventId: id });
    f.profile.permissions.push({ code: "formalizacion.calendar.read", effect: "deny", scope: null, source: "override" });
    await expect(f.service.future("session", identity)).rejects.toMatchObject({ status: 403 });
});
it("sanitizes unavailable schemas and turns deadlocks into retryable conflicts", async () => {
    const f = setup();
    f.repository.read.mockRejectedValue(new Error("private SQL credentials"));
    await expect(f.service.read("session", identity)).rejects.toMatchObject({ status: 503, message: "No fue posible gestionar el adéndum de la orden." });
    f.repository.change.mockRejectedValue(Object.assign(new Error("private SQL"), { code: "ER_LOCK_DEADLOCK" }));
    await expect(f.service.change("session", body)).rejects.toMatchObject({ status: 409 });
});
it("requires the explicit manual mark grant and stores a normalized required reason without creating an event", async () => {
    const f = setup();
    const command = { ...identity, expectedVersion: 3, operationId: body.operationId, note: "  Documento pendiente  " };
    await expect(f.service.markPending("session", command)).rejects.toMatchObject({ status: 403 });
    expect(f.repository.markManually).not.toHaveBeenCalled();
    f.profile.permissions.push({ code: "formalizacion.orders.addendum.mark_pending", effect: "allow", scope: "all_areas", source: "override" });
    expect(await f.service.markPending("session", command)).toMatchObject({ canMarkPending: true, status: "pending" });
    expect(f.repository.markManually).toHaveBeenCalledWith({ ...identity, expectedVersion: 3, operationId: body.operationId, note: "Documento pendiente", actorPublicId: "actor" });
    for (const note of [undefined, "   ", "ab"]) await expect(f.service.markPending("session", { ...command, note })).rejects.toMatchObject({ status: 400 });
    await expect(f.service.markPending("session", { ...command, note: "x".repeat(2001) })).rejects.toMatchObject({ status: 400 });
    f.profile.permissions.push({ code: "formalizacion.orders.addendum.mark_pending", effect: "deny", scope: null, source: "override" });
    await expect(f.service.markPending("session", command)).rejects.toMatchObject({ status: 403 });
});
it("requires marker read even with separate mutation grants, while future calendar checks remain independent", async () => {
    const f = setup();
    f.profile.permissions.push({ code: "formalizacion.orders.addendum.mark_pending", effect: "allow", scope: "all_areas", source: "override" }, { code: "formalizacion.orders.addendum.read", effect: "deny", scope: null, source: "override" });
    await expect(f.service.read("session", identity)).rejects.toMatchObject({ status: 403 });
    await expect(f.service.change("session", body)).rejects.toMatchObject({ status: 403 });
    await expect(f.service.markPending("session", { ...identity, expectedVersion: 3, operationId: body.operationId })).rejects.toMatchObject({ status: 403 });
    expect(f.repository.read).not.toHaveBeenCalled();
    expect(f.repository.change).not.toHaveBeenCalled();
    expect(await f.service.future("session", identity)).toMatchObject({ blocked: false });
});
it("permits only the banner count with its independent permission, without granting order access", async () => {
    const f = setup();
    f.profile.permissions = [{ code: "formalizacion.home.addendum.read", effect: "allow", scope: "own_area", source: "role" }];
    expect(await f.service.summary("session")).toEqual({ total: 3 });
    await expect(f.service.read("session", identity)).rejects.toMatchObject({ status: 403 });
    f.profile.permissions.push({ code: "formalizacion.home.addendum.read", effect: "deny", scope: null, source: "override" });
    await expect(f.service.summary("session")).rejects.toMatchObject({ status: 403 });
    expect(f.repository.summary).toHaveBeenCalledOnce();
});

it("allows authorized readers to record sent without either mutation grant and preserves strict input", async () => {
    const f = setup();
    f.profile.permissions = f.profile.permissions.filter((p) => !p.code.endsWith("addendum.update"));
    const command = { ...identity, expectedVersion: 3, operationId: body.operationId };
    expect(await f.service.markSent("session", command)).toMatchObject({ canMarkSent: true, canUpdate: false });
    expect(f.repository.change).toHaveBeenCalledWith({ ...command, status: "sent", actorPublicId: "actor" });
    expect(await f.service.read("session", identity)).toMatchObject({ canMarkSent: true });
    await expect(f.service.markSent("session", { ...command, status: "completed" })).rejects.toMatchObject({ status: 400 });
    f.profile.permissions.push({ code: "formalizacion.orders.addendum.read", effect: "deny", scope: null, source: "override" });
    await expect(f.service.markSent("session", command)).rejects.toMatchObject({ status: 403 });
});
