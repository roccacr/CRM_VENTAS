import { describe, expect, it } from "vitest";

import { calendarEventColors, eventSignals, typeFilters, visibleEvents } from "../../src/modules/calendar/calendar-view-tools";
import type { CalendarDescriptor, CalendarEvent, OutlookEventDetail } from "../../src/services/calendar/calendar-service";

const detail = (patch: Partial<OutlookEventDetail>): OutlookEventDetail => ({ organizer: null, attendees: [], attendeeCount: 0, isOrganizer: false, myResponse: null, isOnlineMeeting: false, joinUrl: null, isRecurring: false, showAs: null, sensitivity: null, importance: null, webLink: null, ...patch });
const event = (patch: Partial<CalendarEvent>): CalendarEvent => ({ id: "e", source: "native", originModule: "formalizacion", typeId: "t", typeCode: "tarea", title: "Reunión", description: null, location: null, start: "2026-11-03T13:30:00Z", end: "2026-11-03T14:00:00Z", allDay: false, status: "scheduled", version: 1, canEdit: true, formKey: "formalizacion.general.v1", details: {}, ...patch });
const calendar = (moduleCode: CalendarDescriptor["moduleCode"], codes: string[]): CalendarDescriptor => ({ moduleCode, label: moduleCode, color: "#000000", canCreate: true, canUpdate: true, types: codes.map((code) => ({ id: `${moduleCode}-${code}`, code, label: code.toUpperCase(), color: "#111111", formKey: "x" })) });

it("keeps module identity separate from the shared type color, including synchronized Outlook events", () => {
    const formalization = { ...calendar("formalizacion", ["reunion"]), color: "#b4325a" };
    const sales = { ...calendar("ventas", ["reunion"]), color: "#147849" };
    const colors = [formalization, sales];
    expect(calendarEventColors(event({ typeId: "historical-id", typeCode: "reunion", outlookId: "remote" }), colors)).toMatchObject({ moduleColor: "#b4325a", typeColor: "#111111", moduleLabel: "formalizacion", typeLabel: "REUNION" });
    expect(calendarEventColors(event({ originModule: "ventas", typeId: "ventas-reunion", typeCode: "reunion" }), colors)).toMatchObject({ moduleColor: "#147849", typeColor: "#111111" });
    expect(calendarEventColors(event({ source: "outlook", originModule: null, typeCode: "", typeId: "" }), colors)).toMatchObject({ moduleColor: "#0369A1", typeColor: "#0369A1", moduleLabel: "Outlook" });
});

describe("event signals", () => {
    it("marks series, tentative, private and cancelled events like Outlook does", () => {
        const outlook = event({ source: "outlook", originModule: null, outlookDetail: detail({ isRecurring: true, showAs: "tentative", sensitivity: "private" }) });
        expect(eventSignals(outlook)).toEqual(["cal-event--outlook", "cal-event--recurring", "cal-event--tentative", "cal-event--private"]);
        expect(eventSignals(event({ status: "cancelled" }))).toEqual(["cal-event--cancelled"]);
        expect(eventSignals(event({}))).toEqual([]);
    });
    it("treats a tentative reply as tentative even when the slot shows as busy", () => {
        expect(eventSignals(event({ source: "outlook", outlookDetail: detail({ showAs: "busy", myResponse: "tentativelyAccepted" }) }))).toContain("cal-event--tentative");
    });
});
describe("type filters", () => {
    it("lists each type once across the selected calendars only", () => {
        const calendars = [calendar("formalizacion", ["tarea", "reunion"]), calendar("ventas", ["tarea", "cita"]), calendar("mercadeo", ["seguimiento"])];
        expect(typeFilters(calendars, ["formalizacion", "ventas"]).map((type) => type.code)).toEqual(["tarea", "reunion", "cita"]);
    });
});
describe("visible events", () => {
    const events = [event({ id: "a", title: "Revisión de Cartera", typeCode: "tarea" }), event({ id: "b", title: "Visita", typeCode: "cita", location: "Oficina Central" }), event({ id: "c", source: "outlook", originModule: null, typeCode: "", title: "Stand Up" })];
    const all = { query: "", hiddenTypes: new Set<string>(), showOutlook: true };
    it("searches title and place ignoring case and accents", () => {
        expect(visibleEvents(events, { ...all, query: "revision" }).map((row) => row.id)).toEqual(["a"]);
        expect(visibleEvents(events, { ...all, query: "CENTRAL" }).map((row) => row.id)).toEqual(["b"]);
    });
    it("hides unchecked types and the Outlook feed without touching the rest", () => {
        expect(visibleEvents(events, { ...all, hiddenTypes: new Set(["cita"]) }).map((row) => row.id)).toEqual(["a", "c"]);
        expect(visibleEvents(events, { ...all, showOutlook: false }).map((row) => row.id)).toEqual(["a", "b"]);
    });
});
