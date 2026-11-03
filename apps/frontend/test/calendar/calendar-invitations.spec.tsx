import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { CalendarNotificationList } from "../../src/modules/calendar/CalendarNotifications";
import { OutlookEventEdit } from "../../src/modules/calendar/OutlookEventEdit";
import { apiRequest } from "../../src/services/api/api-client";
import { type CalendarEvent, getCalendarNotifications } from "../../src/services/calendar/calendar-service";
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
afterEach(() => {
    cleanup();
    vi.mocked(apiRequest).mockReset();
});
const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
it("links a bell invitation to the calendar detail and keeps read separate from RSVP", () => {
    const mark = vi.fn().mockResolvedValue(undefined);
    render(<CalendarNotificationList model={{ items: [{ id, eventId: id, title: "Firma", start: "2026-11-04T15:00:00Z", moduleCode: "formalizacion", contextModule: "ventas", organizer: "Ana", kind: "invitation", readAt: null }], unreadCount: 1, failure: "", mark, refresh: vi.fn() }} onOpen={vi.fn()} />);
    expect(screen.getByRole("link", { name: /Firma/ })).toHaveAttribute("href", `/home/sales/calendar?date=2026-11-04&event=${id}`);
    fireEvent.click(screen.getByRole("button", { name: "Marcar aviso de Firma como leído" }));
    expect(mark).toHaveBeenCalledWith(expect.objectContaining({ id }));
});
it("validates calendar bell metadata independently of notes", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ items: [], unreadCount: 0 });
    expect(await getCalendarNotifications()).toEqual({ items: [], unreadCount: 0 });
    vi.mocked(apiRequest).mockResolvedValue({ items: [], unreadCount: -1 });
    await expect(getCalendarNotifications()).rejects.toThrow();
});
it.each([false, undefined])("does not offer editing without Graph organizer confirmation (%s)", (isOrganizer) => {
    const event = { canEdit: true, title: "Firma", start: "2026-11-04T15:00:00Z", end: "2026-11-04T16:00:00Z", outlookVersion: "v1", outlookDetail: { isOrganizer } } as unknown as CalendarEvent;
    render(<OutlookEventEdit event={event} moduleCode="ventas" onSaved={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Editar mi evento" })).not.toBeInTheDocument();
});
it("submits only the organizer's basic event fields with the observed Outlook version", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    const event = { id: "outlook-remote", canEdit: true, title: "Firma", location: "Sala", start: "2026-11-04T15:00:00Z", end: "2026-11-04T16:00:00Z", allDay: false, outlookVersion: "v1", outlookDetail: { isOrganizer: true } } as unknown as CalendarEvent;
    render(<OutlookEventEdit event={event} moduleCode="ventas" onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "Editar mi evento" }));
    fireEvent.change(screen.getByLabelText("Nombre del evento *"), { target: { value: "Firma actualizada" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios en Outlook" }));
    await waitFor(() => {
        expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(apiRequest).toHaveBeenCalledWith("/calendar/outlook-events/outlook-remote", expect.objectContaining({ method: "PATCH", body: expect.objectContaining({ expectedVersion: "v1", title: "Firma actualizada", moduleCode: "ventas" }) as unknown }));
});

it("loads organizer-owned Outlook events when the server grants editing", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, outlookStatus: "connected", events: [{ id: "owned-outlook", source: "outlook", originModule: null, typeId: "", typeCode: "", formKey: "outlook.readonly", title: "Mi reunión", description: null, location: null, start: "2026-11-04T15:00:00Z", end: "2026-11-04T16:00:00Z", allDay: false, status: "scheduled", version: 0, canEdit: true, linksEditable: false, details: {} }] });
    const { getCalendarEvents } = await import("../../src/services/calendar/calendar-service");
    const result = await getCalendarEvents(["ventas"], { start: "2026-11-01T06:00:00Z", end: "2026-12-01T06:00:00Z" }, "ventas");
    expect(result[0]?.canEdit).toBe(true);
});
