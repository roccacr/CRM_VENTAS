import { describe, expect, it, vi } from "vitest";

import type { CalendarRow } from "../../src/modules/crm/calendar/calendar.contract.js";
import type { CalendarRepository } from "../../src/modules/crm/calendar/calendar.repository.js";
import { CalendarService } from "../../src/modules/crm/calendar/calendar.service.js";
import { calendarAccess, calendarRouteAccess } from "../../src/modules/crm/calendar/calendar-access.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const event: CalendarRow = { internalId: 7, ownerPublicId: "actor", id, source: "native", originModule: "formalizacion", typeId: id, typeCode: "tarea", formKey: "formalizacion.general.v1", title: "Reunión", description: null, location: null, start: "2026-10-28T14:00:00.000Z", end: "2026-10-28T15:00:00.000Z", allDay: 0, status: "scheduled", version: 1, details: { reference: "Referencia", secret: "never" } };
const command = { moduleCode: "formalizacion", typeId: id, title: "Reunión", start: event.start, end: event.end, allDay: false, details: {}, operationId: "550e8400-e29b-41d4-a716-446655440000" };
const query = { moduleCodes: "formalizacion", contextModule: "formalizacion", start: "2026-10-01T06:00:00Z", end: "2026-11-01T06:00:00Z" };
function setup(scope = "own_area") {
    const profile = {
        user: { publicId: "actor" },
        roles: [],
        orgUnits: [
            { code: "formalizacion", status: "active" },
            { code: "mercadeo", status: "active" },
        ],
        permissions: ["read", "create", "update"].map((action) => ({ code: `formalizacion.calendar.${action}`, effect: "allow", scope })),
    } as unknown as IdentityProfile;
    const repository = { read: vi.fn(async (run: (tx: object) => Promise<unknown>) => run({})), types: vi.fn().mockResolvedValue([{ id, moduleCode: "formalizacion", code: "tarea", label: "Evento", color: "#496180", formKey: event.formKey }]), list: vi.fn().mockResolvedValue([event]), save: vi.fn<CalendarRepository["save"]>().mockResolvedValue(event) };
    const legacy = { enabled: () => true, list: vi.fn().mockResolvedValue([]) };
    const lookup = { lookup: vi.fn().mockResolvedValue({ items: [] }), validateLinks: vi.fn().mockResolvedValue(undefined), canManageLinks: vi.fn().mockResolvedValue(true), selectionOptions: vi.fn().mockResolvedValue({}) };
    const service = new CalendarService({ getCurrentUser: vi.fn().mockResolvedValue(profile) } as never, repository as never, legacy, lookup as never);
    return { profile, repository, legacy, lookup, service };
}
describe("global calendar authorization and bounded contract", () => {
    it("checks the current module and lookup contract before searching any business resource", async () => {
        const f = setup();
        await expect(f.service.lookup("session", { moduleCode: "mercadeo", kind: "leads", search: "Francisco" })).rejects.toMatchObject({ status: 403 });
        expect(f.lookup.lookup).not.toHaveBeenCalled();
        await expect(f.service.lookup("session", { moduleCode: "formalizacion", kind: "unknown", search: "Francisco" })).rejects.toMatchObject({ status: 400 });
        expect(f.lookup.lookup).not.toHaveBeenCalled();
        await expect(f.service.lookup("session", { moduleCode: "formalizacion", kind: "notes", search: "" })).resolves.toEqual({ items: [] });
        expect(f.lookup.lookup).toHaveBeenCalledWith(f.profile, { moduleCode: "formalizacion", kind: "notes", search: "" });
    });
    it("requires membership and exact allow, with explicit deny prevailing", () => {
        const f = setup();
        expect(calendarRouteAccess(f.profile, "read")).toBe(true);
        expect(calendarAccess(f.profile, "mercadeo", "read").allowed).toBe(false);
        f.profile.permissions.push({ code: "formalizacion.calendar.read", effect: "deny", scope: null, source: "override" });
        expect(calendarAccess(f.profile, "formalizacion", "create").allowed).toBe(false);
        expect(calendarRouteAccess(f.profile, "read")).toBe(false);
    });
    it("does not treat an owner label or an unknown scope as a bypass", () => {
        const f = setup("future_scope");
        f.profile.roles = [{ code: "owner", status: "active" }] as never;
        expect(calendarRouteAccess(f.profile, "update")).toBe(false);
    });
    it("does not let broad editing permissions widen an own-only read scope", () => {
        const f = setup("self");
        f.profile.permissions.push({ code: "formalizacion.calendar.update", effect: "allow", scope: "all_areas", source: "role" });
        expect(calendarAccess(f.profile, "formalizacion", "update")).toEqual({ allowed: true, ownOnly: true });
    });
    it("rejects any unauthorized overlay before reading either source", async () => {
        const f = setup();
        await expect(f.service.list("session", { ...query, moduleCodes: "formalizacion,mercadeo" })).rejects.toMatchObject({ status: 403 });
        expect(f.repository.read).not.toHaveBeenCalled();
        expect(f.legacy.list).not.toHaveBeenCalled();
    });
    it.each([{ moduleCodes: "formalizacion,formalizacion" }, { moduleCodes: "unknown" }, { end: "2026-10-01T06:00:00Z" }, { end: "2027-10-01T06:00:00Z" }, { actor: "forged" }])("rejects malformed or unbounded reads before SQL %j", async (change) => {
        const f = setup();
        await expect(f.service.list("session", { ...query, ...change })).rejects.toMatchObject({ status: 400 });
        expect(f.repository.read).not.toHaveBeenCalled();
    });
    it("returns authorized configuration, never internal module/type storage keys", async () => {
        const f = setup();
        const result = await f.service.calendars("session");
        expect(result.calendars).toHaveLength(1);
        expect(result.calendars[0]).toMatchObject({ moduleCode: "formalizacion", canCreate: true, canUpdate: true });
        expect(result.calendars[0]?.types[0]).not.toHaveProperty("moduleCode");
    });
    it("combines sources in one snapshot and strips ownership/private metadata", async () => {
        const f = setup("self");
        f.legacy.list.mockResolvedValue([{ ...event, id: "legacy:8", source: "legacy" }]);
        const result = await f.service.list("session", query);
        expect(result.events).toHaveLength(2);
        expect(f.repository.list).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ broadModules: [], actorPublicId: "actor" }));
        expect(result.events[0]).not.toHaveProperty("ownerPublicId");
        expect(result.events[0]).not.toHaveProperty("internalId");
        expect(result.events[0]?.details).toEqual({ reference: "Referencia" });
        expect(result.events.find((row) => row.source === "legacy")?.canEdit).toBe(false);
    });
    it("disables editing overlays even when the user can edit the origin", async () => {
        const f = setup();
        f.profile.permissions.push({ code: "mercadeo.calendar.read", effect: "allow", scope: "self", source: "role" });
        const result = await f.service.list("session", { ...query, contextModule: "mercadeo" });
        expect(result.events[0]?.canEdit).toBe(false);
    });
    it("keeps invitations event-only and excludes origins with an explicit read deny", async () => {
        const f = setup();
        f.profile.permissions.push({ code: "mercadeo.calendar.read", effect: "deny", scope: null, source: "override" });
        f.repository.list.mockResolvedValue([{ ...event, originModule: "mercadeo", participants: [{ email: "private@example.com" }], links: [{ entityType: "note", source: "native", id }] }]);
        const result = await f.service.list("session", query);
        expect(f.repository.list).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ excludedInviteModules: ["mercadeo"] }));
        expect(result.events[0]?.canEdit).toBe(false);
        expect(result.events[0]?.participants).toBeUndefined();
        expect(result.events[0]?.links).toBeUndefined();
    });
    it("hides private link identities from an otherwise authorized editor", async () => {
        const f = setup();
        f.repository.list.mockResolvedValue([{ ...event, links: [{ entityType: "note", source: "native", id }] }]);
        f.lookup.canManageLinks.mockResolvedValue(false);
        const result = await f.service.list("session", query);
        expect(result.events[0]).toMatchObject({ canEdit: true, linksEditable: false });
        expect(result.events[0]?.links).toBeUndefined();
    });
    it("rejects replacing private relations but permits editing other fields without losing them", async () => {
        const f = setup();
        const before: CalendarRow = { ...event, links: [{ entityType: "note", source: "native", id }] };
        f.lookup.canManageLinks.mockResolvedValue(false);
        f.repository.save.mockImplementation(async (...args) => {
            const validate = args[4];
            await validate?.({} as never, before);
            return before;
        });
        await expect(f.service.save("session", { ...command, expectedVersion: 1, links: [] }, id)).rejects.toMatchObject({ status: 403 });
        expect(f.lookup.validateLinks).not.toHaveBeenCalled();
        const result = await f.service.save("session", { ...command, expectedVersion: 1 }, id);
        expect(result.event).toMatchObject({ linksEditable: false });
        expect(result.event.links).toBeUndefined();
    });
    it("does not represent failed legacy reads or truncated ranges as an empty success", async () => {
        const f = setup();
        f.legacy.list.mockRejectedValueOnce(new Error("private database detail"));
        await expect(f.service.list("session", query)).rejects.toMatchObject({ status: 503 });
        f.repository.list.mockResolvedValue(Array.from({ length: 501 }, () => event));
        await expect(f.service.list("session", query)).rejects.toMatchObject({ status: 409 });
    });
    it("requires write permission and strict command content before persistence", async () => {
        const f = setup();
        await expect(f.service.save("session", { ...command, organizer: "forged" })).rejects.toMatchObject({ status: 400 });
        f.profile.permissions.push({ code: "formalizacion.calendar.create", effect: "deny", scope: null, source: "override" });
        await expect(f.service.save("session", command)).rejects.toMatchObject({ status: 403 });
        expect(f.repository.save).not.toHaveBeenCalled();
    });
    it("uses exclusive Costa Rica midnight boundaries for all-day events", async () => {
        const f = setup();
        await expect(f.service.save("session", { ...command, allDay: true })).rejects.toMatchObject({ status: 400 });
        await f.service.save("session", { ...command, allDay: true, start: "2026-10-28T06:00:00Z", end: "2026-10-29T06:00:00Z" });
        expect(f.repository.save).toHaveBeenCalledOnce();
    });
    it("rejects a legacy update and requires a version for native updates", async () => {
        const f = setup();
        await expect(f.service.save("session", { ...command, expectedVersion: 1 }, "legacy:8")).rejects.toMatchObject({ status: 400 });
        await expect(f.service.save("session", command, id)).rejects.toMatchObject({ status: 400 });
        expect(f.repository.save).not.toHaveBeenCalled();
    });
});
