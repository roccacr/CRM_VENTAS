import { Logger } from "@nestjs/common";
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
    const repository = { detailRecord: vi.fn().mockResolvedValue(event), read: vi.fn(async (run: (tx: object) => Promise<unknown>) => run({})), types: vi.fn().mockResolvedValue([{ id, moduleCode: "formalizacion", code: "tarea", label: "Evento", color: "#496180", formKey: event.formKey }]), list: vi.fn().mockResolvedValue([event]), save: vi.fn<CalendarRepository["save"]>().mockResolvedValue(event) };
    const legacy = { enabled: () => true, list: vi.fn().mockResolvedValue([]) };
    const lookup = { detailSelections: vi.fn().mockResolvedValue({ links: [], participants: [], restrictedLinks: false }), lookup: vi.fn().mockResolvedValue({ items: [] }), validateLinks: vi.fn().mockResolvedValue(undefined), leadInvitationEmails: vi.fn().mockResolvedValue([]), canManageLinks: vi.fn().mockResolvedValue(true), selectionOptions: vi.fn().mockResolvedValue({}) };
    const external = { publishState: vi.fn().mockResolvedValue({ status: "crm_only" }), assertNativeEdit: vi.fn().mockResolvedValue(undefined), feed: vi.fn().mockResolvedValue({ status: "connected", events: [], links: [] }), publish: vi.fn().mockResolvedValue({ status: "crm_only" }) };
    const addendum = { prepareEvent: vi.fn().mockResolvedValue(undefined) };
    const service = new CalendarService({ getCurrentUser: vi.fn().mockResolvedValue(profile) } as never, repository as never, legacy, lookup as never, external as never, addendum as never);
    return { profile, repository, legacy, lookup, external, service, addendum };
}
describe("global calendar authorization and bounded contract", () => {
    it.each([
        ["complete", "scheduled", "completed"],
        ["cancel", "scheduled", "cancelled"],
        ["reactivate", "cancelled", "scheduled"],
        ["reactivate", "completed", "scheduled"],
    ] as const)("changes state only through a versioned organizer command: %s %s", async (action, expectedStatus, target) => {
        const f = setup();
        f.repository.detailRecord.mockResolvedValue({ ...event, status: expectedStatus });
        f.repository.save.mockResolvedValue({ ...event, status: target, version: 2 });
        await expect(f.service.changeStatus("session", id, { moduleCode: "formalizacion", action, expectedStatus, expectedVersion: 1, operationId: command.operationId, reason: "Prueba autorizada" })).resolves.toMatchObject({ event: { status: target, version: 2 } });
        expect(f.repository.save.mock.calls[0]?.[5]).toMatchObject({ status: target, expectedStatus });
        expect(f.external.publishState).toHaveBeenCalledOnce();
    });
    it("never lets an invited attendee or broad editor change someone else's state", async () => {
        const f = setup();
        f.repository.detailRecord.mockResolvedValue({ ...event, ownerPublicId: "another", participants: [{ userId: "actor" }] });
        await expect(f.service.changeStatus("session", id, { moduleCode: "formalizacion", action: "cancel", expectedStatus: "scheduled", expectedVersion: 1, operationId: command.operationId, reason: "Prueba" })).rejects.toMatchObject({ status: 403 });
        expect(f.repository.save).not.toHaveBeenCalled();
    });
    it("records only a safe internal error classification for an unconfirmed save", async () => {
        const f = setup();
        const log = vi.spyOn(Logger, "error").mockImplementation(() => undefined);
        try {
            f.repository.save.mockRejectedValue(Object.assign(new Error("private SQL and guest@example.test"), { code: "ER_BAD_FIELD_ERROR", sql: "private query", parameters: ["secret"] }));
            await expect(f.service.save("session", command)).rejects.toMatchObject({ status: 503 });
            expect(log).toHaveBeenCalledWith({ event: "calendar_operation_failed", errorName: "Error", errorCode: "ER_BAD_FIELD_ERROR" }, "CalendarService");
            expect(JSON.stringify(log.mock.calls)).not.toMatch(/private|guest@|secret/);
            expect(f.external.publish).not.toHaveBeenCalled();
        } finally {
            log.mockRestore();
        }
    });
    it("revalidates omitted effective links when converting a Task to Adéndum, but preserves hidden relations on ordinary Adéndum edits", async () => {
        const f = setup();
        const links = [
            { entityType: "sales_order" as const, source: "native" as const, id },
            { entityType: "lead" as const, source: "native" as const, id },
        ];
        let previousType = "tarea";
        f.lookup.canManageLinks.mockResolvedValue(false);
        f.repository.save.mockImplementation(async (...args) => {
            await args[4]?.({ isTransaction: true } as never, { ...event, typeCode: previousType, links }, "adendum");
            return event;
        });
        await expect(f.service.save("session", { ...command, description: "Motivo necesario", expectedVersion: 1 }, id)).rejects.toMatchObject({ status: 403 });
        expect(f.addendum.prepareEvent).not.toHaveBeenCalled();
        previousType = "adendum";
        await expect(f.service.save("session", { ...command, expectedVersion: 1 }, id)).resolves.toBeDefined();
        expect(f.addendum.prepareEvent).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ markPending: false, revealExisting: false }));
        expect(f.lookup.validateLinks).not.toHaveBeenCalled();
    });
    it.each([null, "tarea", "adendum"])("marks only new/conversion Adéndum pending, not an ordinary existing %s edit", async (previousType) => {
        const f = setup();
        const links = [
            { entityType: "sales_order" as const, source: "native" as const, id },
            { entityType: "lead" as const, source: "native" as const, id },
        ];
        f.profile.permissions.push({ code: "formalizacion.calendar.assign_lead", effect: "allow", scope: "own_area", source: "role" });
        f.repository.save.mockImplementation(async (...args) => {
            await args[4]?.({ isTransaction: true } as never, previousType ? { ...event, typeCode: previousType, links } : null, "adendum");
            return event;
        });
        await f.service.save("session", { ...command, description: "Documento requerido", links, ...(previousType ? { expectedVersion: 1 } : {}) }, previousType ? id : undefined);
        expect(f.addendum.prepareEvent).toHaveBeenCalledWith(expect.objectContaining({ isTransaction: true }), expect.objectContaining({ order: links[0], lead: links[1], markPending: previousType !== "adendum", ...(previousType ? { excludeEventId: id } : {}) }));
    });
    it("rejects an Adéndum without an order before event persistence and does not publish it", async () => {
        const f = setup();
        const writes = vi.fn();
        f.repository.save.mockImplementation(async (...args) => {
            await args[4]?.({} as never, null, "adendum");
            writes();
            return event;
        });
        await expect(f.service.save("session", command)).rejects.toMatchObject({ status: 409 });
        expect(writes).not.toHaveBeenCalled();
        expect(f.external.publish).not.toHaveBeenCalled();
        expect(f.addendum.prepareEvent).not.toHaveBeenCalled();
    });
    it.each(["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"])("returns retryable conflict after %s rather than leaking database errors", async (code) => {
        const f = setup();
        f.repository.save.mockRejectedValue(Object.assign(new Error("private SQL"), { code }));
        await expect(f.service.save("session", command)).rejects.toMatchObject({ status: 409 });
        expect(f.external.publish).not.toHaveBeenCalled();
    });
    it.each(["lead", "sales_order"] as const)("requires the dedicated permission when assigning a %s in Formalización", async (entityType) => {
        const f = setup();
        const links = [{ entityType, source: "native", id }];
        await expect(f.service.save("session", { ...command, links })).rejects.toMatchObject({ status: 403 });
        expect(f.repository.save).not.toHaveBeenCalled();
        f.profile.permissions.push({ code: "formalizacion.calendar.assign_lead", effect: "allow", scope: "own_area", source: "role" });
        await expect(f.service.save("session", { ...command, links })).resolves.toBeDefined();
        f.profile.permissions.push({ code: "formalizacion.calendar.assign_lead", effect: "deny", scope: null, source: "override" });
        await expect(f.service.save("session", { ...command, links })).rejects.toMatchObject({ status: 403 });
    });
    it("preserves existing client relations without requiring a new assignment permission, but forbids replacing them", async () => {
        const f = setup();
        const links = [{ entityType: "lead" as const, source: "native" as const, id }];
        f.repository.save.mockImplementation(async (...args) => {
            await args[4]?.({} as never, { ...event, links });
            return event;
        });
        await expect(f.service.save("session", { ...command, links, expectedVersion: 1 }, id)).resolves.toBeDefined();
        await expect(f.service.save("session", { ...command, expectedVersion: 1 }, id)).resolves.toBeDefined();
        await expect(f.service.save("session", { ...command, links: [{ ...links[0], id: "01ARZ3NDEKTSV4RRFFQ69G5FAX" }], expectedVersion: 1 }, id)).rejects.toMatchObject({ status: 403 });
    });
    it("does not require Formalización assignment access for unrelated note links or other modules", async () => {
        const f = setup();
        await expect(f.service.save("session", { ...command, links: [{ entityType: "note", source: "native", id }] })).resolves.toBeDefined();
        f.profile.permissions.push(...["read", "create"].map((action) => ({ code: `mercadeo.calendar.${action}`, effect: "allow" as const, scope: "own_area" as const, source: "role" as const })));
        await expect(f.service.save("session", { ...command, moduleCode: "mercadeo", links: [{ entityType: "lead", source: "native", id }] })).resolves.toBeDefined();
    });
    it("loads Outlook first and merges its current dates with authorized CRM metadata by remote ID", async () => {
        const f = setup();
        const remote = { id: "outlook-id", title: "Actualizado en Outlook", start: "2026-10-29T14:00:00.000Z", end: "2026-10-29T15:00:00.000Z", allDay: false };
        f.external.feed.mockResolvedValue({ status: "connected", events: [remote, { ...remote, id: "personal", title: "Personal" }], links: [{ remoteId: remote.id, eventId: id }] });
        const result = await f.service.list("session", query);
        expect(f.external.feed.mock.invocationCallOrder[0]).toBeLessThan(f.repository.list.mock.invocationCallOrder[0] ?? 0);
        expect(f.repository.list).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ externalEventIds: [id] }));
        expect(result.events).toHaveLength(2);
        expect(result.events.find((row) => row.id === id)).toMatchObject({ source: "native", title: remote.title, start: remote.start, outlookId: remote.id, details: { reference: "Referencia" } });
        expect(result.events.find((row) => row.source === "outlook")).toMatchObject({ id: "personal", originModule: null, canEdit: false, title: "Personal" });
    });
    it("does not enrich an Outlook copy with CRM relations that the actor cannot read", async () => {
        const f = setup();
        f.repository.list.mockResolvedValue([]);
        const remote = { id: "mailbox-copy", title: "Invitación propia", start: event.start, end: event.end, allDay: false, description: null, location: null };
        f.external.feed.mockResolvedValue({ status: "connected", events: [remote], links: [{ remoteId: remote.id, eventId: "restricted" }] });
        const result = await f.service.list("session", query);
        expect(result.events).toHaveLength(1);
        expect(result.events[0]).toMatchObject({ source: "outlook", originModule: null, canEdit: false, details: {} });
        expect(result.events[0]?.links).toBeUndefined();
    });
    it("does not show the old CRM date when the linked event moved outside the Outlook interval", async () => {
        const f = setup();
        f.external.feed.mockResolvedValue({ status: "connected", events: [], links: [{ remoteId: "moved", eventId: id }] });
        expect((await f.service.list("session", query)).events).toEqual([]);
    });
    it("retains CRM events and reports Outlook failures explicitly", async () => {
        const f = setup();
        f.external.feed.mockResolvedValue({ status: "consent_required", events: [], links: [] });
        const result = await f.service.list("session", query);
        expect(result.events).toHaveLength(1);
        expect(result.outlookStatus).toBe("consent_required");
    });
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
it("does not let a broad calendar editor edit another organizer's event", async () => {
    const f = setup();
    f.repository.list.mockResolvedValue([{ ...event, ownerPublicId: "another" }]);
    const result = await f.service.list("session", query);
    expect(result.events[0]?.canEdit).toBe(false);
});
it("includes the authorized lead email alongside selected collaborators and external guests", async () => {
    const f = setup();
    f.profile.permissions.push({ code: "formalizacion.calendar.assign_lead", effect: "allow", scope: "own_area", source: "role" });
    f.lookup.leadInvitationEmails.mockResolvedValue(["lead@example.test"] as never);
    f.repository.save.mockImplementation(async (...args) => {
        await args[4]?.({} as never, null, "tarea");
        return event;
    });
    await f.service.save("session", { ...command, participants: [{ email: "guest@example.test" }], links: [{ entityType: "lead", source: "native", id }] });
    expect(f.repository.save.mock.calls[0]?.[1].participants).toEqual([{ email: "guest@example.test" }, { email: "lead@example.test" }]);
});
it("rejects lead expansion over 100 participants before writing relations", async () => {
    const f = setup();
    f.profile.permissions.push({ code: "formalizacion.calendar.assign_lead", effect: "allow", scope: "own_area", source: "role" });
    f.lookup.leadInvitationEmails.mockResolvedValue(["lead@example.test"] as never);
    f.repository.save.mockImplementation(async (...args) => {
        await args[4]?.({} as never, null, "tarea");
        return event;
    });
    await expect(f.service.save("session", { ...command, participants: Array.from({ length: 100 }, (_, index) => ({ email: `guest${String(index)}@example.test` })), links: [{ entityType: "lead", source: "native", id }] })).rejects.toMatchObject({ status: 400 });
    expect(f.external.publish).not.toHaveBeenCalled();
});
it("preserves an authorized CRM detail snapshot alongside Outlook even for a non-organizer", async () => {
    const f = setup();
    f.repository.list.mockResolvedValue([{ ...event, ownerPublicId: "other", description: "Descripción CRM", links: [{ entityType: "sales_order", source: "legacy", id: "42" }] }]);
    f.external.feed.mockResolvedValue({ status: "connected", links: [{ eventId: id, remoteId: "remote" }], events: [{ id: "remote", title: "Título Outlook", description: "Descripción Outlook", start: event.start, end: event.end, allDay: false, location: null }] });
    const result = await f.service.list("session", query);
    expect(result.events[0]).toMatchObject({ title: "Título Outlook", description: "Descripción Outlook", canEdit: false, crmDetail: { title: event.title, description: "Descripción CRM", reference: "Referencia", typeLabel: "Tarea", typeColor: expect.any(String) as unknown } });
});
it("whitelists persisted CRM metadata without exposing internal JSON or ownership identifiers", async () => {
    const f = setup();
    f.repository.list.mockResolvedValue([{ ...event, storedMetadata: JSON.stringify({ typeLabel: "Tipo guardado", typeColor: "#123456", organizerName: "Ana", timezone: "America/Costa_Rica", createdAt: "2026-10-28T14:00:00Z", secret: "never expose" }) }]);
    const result = await f.service.list("session", query);
    expect(result.events[0]?.crmDetail).toMatchObject({ typeLabel: "Tipo guardado", typeColor: "#123456", organizerName: "Ana" });
    expect(result.events[0]).not.toHaveProperty("storedMetadata");
    expect(result.events[0]).not.toHaveProperty("ownerPublicId");
    expect(result.events[0]?.crmDetail).not.toHaveProperty("secret");
});

it("does not fetch CRM relation labels while listing calendar events", async () => {
    const f = setup();
    const result = await f.service.list("session", query);
    expect(result.events[0]?.crmDetail?.loaded).toBe(false);
    expect(f.lookup.detailSelections).not.toHaveBeenCalled();
});
it("loads a participant's CRM detail without granting editing or bypassing linked-record ACL", async () => {
    const f = setup("self");
    f.repository.detailRecord.mockResolvedValue({ ...event, ownerPublicId: "other", participants: [{ userId: "actor" }] });
    f.lookup.detailSelections.mockResolvedValue({ links: [{ entityType: "sales_order", source: "legacy", id: "42", label: "AVI223" }], participants: [], restrictedLinks: true });
    expect(await f.service.detail("session", id)).toMatchObject({ crmDetail: { loaded: true, title: event.title, links: [{ label: "AVI223" }], restrictedLinks: true } });
});
it.each([false, true])("does not load detail for a stranger or explicit origin deny (%s)", async (denied) => {
    const f = setup("self");
    f.repository.detailRecord.mockResolvedValue({ ...event, ownerPublicId: "other", participants: denied ? [{ userId: "actor" }] : [] });
    if (denied) f.profile.permissions.push({ code: "formalizacion.calendar.read", effect: "deny", scope: null, source: "role" });
    await expect(f.service.detail("session", id)).rejects.toMatchObject({ status: denied ? 403 : 404 });
    expect(f.lookup.detailSelections).not.toHaveBeenCalled();
});

it.each([undefined, "  ", "ab", "x".repeat(2001)])("blocks an Adendum conversion without a valid reason before marker/publish", async (description) => {
    const f = setup();
    const links = [
        { entityType: "sales_order" as const, source: "native" as const, id },
        { entityType: "lead" as const, source: "native" as const, id },
    ];
    f.repository.save.mockImplementation(async (...args) => {
        await args[4]?.({} as never, { ...event, links }, "adendum");
        return event;
    });
    await expect(f.service.save("session", { ...command, description, expectedVersion: 1 }, id)).rejects.toMatchObject({ status: 400 });
    expect(f.addendum.prepareEvent).not.toHaveBeenCalled();
    expect(f.external.publish).not.toHaveBeenCalled();
});

describe("Marketing global read is limited to calendar consultation", () => {
    it.each(["mercadeo", "jefe_mercadeo"])("lets %s read other Marketing CRM events without edit authority", async (role) => {
        const f = setup("self");
        f.profile.roles = [{ code: role, name: role, status: "active" }];
        f.profile.orgUnits = [{ code: "mercadeo", status: "active" }] as never;
        f.profile.permissions = ["read", "create", "update"].map((action) => ({ code: `mercadeo.calendar.${action}`, effect: "allow", scope: "self", source: "role" }));
        f.profile.permissions.push({ code: "mercadeo.reports.read_all", effect: "allow", scope: "self", source: "role" });
        const other = { ...event, originModule: "mercadeo" as const, ownerPublicId: "another" };
        f.repository.list.mockResolvedValue([other]);
        f.repository.detailRecord.mockResolvedValue(other);
        const result = await f.service.list("session", { ...query, moduleCodes: "mercadeo", contextModule: "mercadeo" });
        expect(f.repository.list).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ broadModules: ["mercadeo"] }));
        expect(f.legacy.list).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ broadModules: ["mercadeo"] }));
        expect(result.events[0]?.canEdit).toBe(false);
        await expect(f.service.detail("session", id)).resolves.toHaveProperty("crmDetail");
        expect(calendarAccess(f.profile, "mercadeo", "update")).toEqual({ allowed: true, ownOnly: true });
        expect(calendarAccess(f.profile, "mercadeo", "create")).toEqual({ allowed: true, ownOnly: true });
        expect(calendarAccess(f.profile, "formalizacion", "read").allowed).toBe(false);
        expect(f.external.publish).not.toHaveBeenCalled();
    });
    it.each(["absent", "denied"])("preserves own-only Marketing read when global capability is %s", (state) => {
        const f = setup("self");
        f.profile.permissions.push({ code: "mercadeo.calendar.read", effect: "allow", scope: "self", source: "role" });
        if (state === "denied") f.profile.permissions.push({ code: "mercadeo.reports.read_all", effect: "deny", scope: null, source: "override" });
        expect(calendarAccess(f.profile, "mercadeo", "read")).toEqual({ allowed: true, ownOnly: true });
    });
    it.each(["absent", "denied"])("never substitutes for a %s calendar read grant", (state) => {
        const f = setup("self");
        f.profile.permissions.push({ code: "mercadeo.reports.read_all", effect: "allow", scope: "self", source: "role" });
        if (state === "denied") f.profile.permissions.push({ code: "mercadeo.calendar.read", effect: "deny", scope: null, source: "override" });
        expect(calendarAccess(f.profile, "mercadeo", "read").allowed).toBe(false);
    });
});

it("does not widen another module or override a global read deny", () => {
    const f = setup("self");
    f.profile.permissions.push({ code: "mercadeo.calendar.read", effect: "allow", scope: "self", source: "role" }, { code: "mercadeo.reports.read_all", effect: "allow", scope: "self", source: "role" });
    expect(calendarAccess(f.profile, "formalizacion", "read")).toEqual({ allowed: true, ownOnly: true });
    f.profile.permissions.push({ code: "mercadeo.reports.read_all", effect: "deny", scope: null, source: "override" });
    expect(calendarAccess(f.profile, "mercadeo", "read")).toEqual({ allowed: true, ownOnly: true });
});

it.each(["formalizacion", "jefe_formalizaciones"])("lets %s consult other organizers without granting their editing", async (role) => {
    const f = setup("self");
    f.profile.roles = [{ code: role, name: role, status: "active" }];
    const other = { ...event, ownerPublicId: "another" };
    f.repository.list.mockResolvedValue([other]);
    f.repository.detailRecord.mockResolvedValue(other);
    const result = await f.service.list("session", query);
    expect(f.repository.list).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ broadModules: ["formalizacion"] }));
    expect(f.legacy.list).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ broadModules: ["formalizacion"] }));
    expect(result.events[0]?.canEdit).toBe(false);
    await expect(f.service.detail("session", id)).resolves.toHaveProperty("crmDetail");
    expect(calendarAccess(f.profile, "formalizacion", "update")).toEqual({ allowed: true, ownOnly: true });
    expect(f.external.publish).not.toHaveBeenCalled();
});
