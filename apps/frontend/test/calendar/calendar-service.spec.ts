import { expect, it, vi } from "vitest";

import { localToUtc, utcToLocal } from "../../src/modules/calendar/calendar-time";
import { apiRequest } from "../../src/services/api/api-client";
import { getCalendarAvailability, getCalendarEvents, getCalendars, saveCalendarEvent } from "../../src/services/calendar/calendar-service";

vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
it("converts Costa Rica wall time independently of the machine timezone", () => {
    expect(localToUtc("2026-10-28T09:30")).toBe("2026-10-28T15:30:00Z");
    expect(utcToLocal("2026-10-29T02:30:00Z")).toBe("2026-10-28T20:30:00.000");
    expect(() => localToUtc("2026-02-30T09:00")).toThrow();
});
it("rejects malformed descriptors rather than making permissions or types up", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ schemaVersion: 1, calendars: [{ moduleCode: "formalizacion", label: "Formalización", types: [] }] });
    await expect(getCalendars()).rejects.toThrow();
});
it("sends the selected modules, visible UTC interval and current module", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ schemaVersion: 1, events: [] });
    await getCalendarEvents(["ventas", "formalizacion"], { start: "2026-10-01T06:00:00Z", end: "2026-11-01T06:00:00Z" }, "formalizacion");
    const path = String(vi.mocked(apiRequest).mock.calls.at(-1)?.[0]);
    const url = new URL(path, "https://crm.test");
    expect(url.searchParams.get("moduleCodes")).toBe("ventas,formalizacion");
    expect(url.searchParams.get("contextModule")).toBe("formalizacion");
    expect(url.searchParams.get("start")).toBe("2026-10-01T06:00:00Z");
});
it("uses POST and PATCH with the same immutable module and explicit version", async () => {
    const body = { moduleCode: "ventas" as const, typeId: "type-1", title: "Seguimiento", start: "2026-10-28T15:00:00Z", end: "2026-10-28T16:00:00Z", allDay: false, details: {}, operationId: "550e8400-e29b-41d4-a716-446655440000" };
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, event: { ...body, id: "event-1", source: "native", originModule: "ventas", typeCode: "general", description: null, location: null, status: "scheduled", version: 2, canEdit: true, formKey: "ventas.general.v1" } });
    await saveCalendarEvent(body);
    expect(apiRequest).toHaveBeenLastCalledWith("/calendar/events", expect.objectContaining({ method: "POST", body, retryOnUnauthorized: false }));
    await saveCalendarEvent(body, { id: "event-1", expectedVersion: 1 });
    expect(apiRequest).toHaveBeenLastCalledWith("/calendar/events/event-1", expect.objectContaining({ method: "PATCH", body: { ...body, expectedVersion: 1 } }));
});
it("round-trips exact seconds and milliseconds through Costa Rica wall time", () => {
    const instant = "2026-10-29T02:30:47.123Z";
    expect(utcToLocal(instant)).toBe("2026-10-28T20:30:47.123");
    expect(localToUtc(utcToLocal(instant))).toBe(instant);
});

it.each([{}, { users: [{ id: "user-1", source: "native", label: "Colaborador" }] }])("accepts sparse authorized selection metadata after a confirmed save (%j)", async (selectionOptions) => {
    const body = { moduleCode: "formalizacion" as const, typeId: "type-1", title: "Tarea", start: "2026-11-04T14:00:00Z", end: "2026-11-04T15:00:00Z", allDay: false, details: {}, operationId: "550e8400-e29b-41d4-a716-446655440000" };
    const event = { ...body, id: "event-1", source: "native", originModule: "formalizacion", typeCode: "tarea", description: "Descripción", location: null, status: "scheduled", version: 1, canEdit: true, formKey: "formalizacion.general.v1", selectionOptions };
    vi.mocked(apiRequest).mockResolvedValueOnce({ schemaVersion: 1, event, delivery: { status: "synced", joinUrl: null, roomStatus: null } });
    await expect(saveCalendarEvent(body)).resolves.toMatchObject({ id: "event-1", delivery: { status: "synced" }, selectionOptions: { users: "users" in selectionOptions ? selectionOptions.users : [], notes: [], leads: [], orders: [] } });
    vi.mocked(apiRequest).mockResolvedValueOnce({ schemaVersion: 1, events: [event], outlookStatus: "connected" });
    await expect(getCalendarEvents(["formalizacion"], { start: body.start, end: body.end }, "formalizacion")).resolves.toHaveLength(1);
});
it.each([null, "invalid", [{ id: "bad", source: "legacy", label: "invalid user" }]])("rejects malformed supplied selections (%j)", async (users) => {
    const body = { moduleCode: "formalizacion" as const, typeId: "type-1", title: "Tarea", start: "2026-11-04T14:00:00Z", end: "2026-11-04T15:00:00Z", allDay: false, details: {}, operationId: "550e8400-e29b-41d4-a716-446655440000" };
    vi.mocked(apiRequest).mockResolvedValueOnce({ schemaVersion: 1, event: { ...body, id: "event-1", source: "native", originModule: "formalizacion", typeCode: "tarea", description: null, location: null, status: "scheduled", version: 1, canEdit: true, formKey: "formalizacion.general.v1", selectionOptions: { users } } });
    await expect(saveCalendarEvent(body)).rejects.toThrow("Respuesta de calendario inválida.");
});

it("preserves connected agenda with an independent missing suggestions consent", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ status: "connected", data: { events: [], conflicts: [], suggestions: [], incomplete: true, suggestionsStatus: "consent_required" } });
    const value = await getCalendarAvailability({ moduleCode: "formalizacion", start: "2026-11-04T15:00:00Z", end: "2026-11-04T16:00:00Z", userIds: [] });
    expect(value).toEqual({ status: "connected", data: { events: [], conflicts: [], suggestions: [], incomplete: true, suggestionsStatus: "consent_required" } });
});
