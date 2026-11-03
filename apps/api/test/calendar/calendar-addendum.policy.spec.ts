import { expect, it } from "vitest";

import { calendarEventInput, type CalendarInput, type CalendarRow } from "../../src/modules/crm/calendar/calendar.contract.js";
import { calendarAddendumRelations, readCalendarAddendumLock } from "../../src/modules/crm/calendar/calendar-addendum.policy.js";

const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const order = { entityType: "sales_order" as const, source: "native" as const, id };
const lead = { entityType: "lead" as const, source: "native" as const, id: "01ARZ3NDEKTSV4RRFFQ69G5FAX" };
const input: CalendarInput = { moduleCode: "formalizacion", typeId: id, title: "Adéndum", start: "2026-11-03T14:00:00Z", end: "2026-11-03T15:00:00Z", allDay: false, operationId: "550e8400-e29b-41d4-a716-446655440000", details: {}, links: [order, lead] };
const before = { originModule: "formalizacion", typeCode: "adendum", links: [order, lead], details: { addendumRelations: { order, lead } } } as CalendarRow;

it.each([[], [lead], [order], [order, lead, { ...order, id: lead.id }], [order, lead, { ...lead, id: order.id }]].map((links) => ({ links })))("requires exactly one order and one client: %j", ({ links }) => {
    expect(() => calendarAddendumRelations({ ...input, links }, null, "adendum")).toThrow(/exactamente una orden/);
});
it("allows ordinary event types without business relationships", () => {
    expect(calendarAddendumRelations({ ...input, links: [] }, null, "tarea")).toBeNull();
});
it("keeps both identities frozen when changing type away, including a later edit", () => {
    const frozen = calendarAddendumRelations(input, before, "tarea");
    expect(frozen).toEqual({ order, lead });
    const task = { ...before, typeCode: "tarea", details: { addendumRelations: frozen } };
    expect(() => calendarAddendumRelations({ ...input, links: [{ ...order, id: lead.id }, lead] }, task, "tarea")).toThrow(/no pueden cambiarse/);
    expect(() => calendarAddendumRelations({ ...input, links: [order, { ...lead, id: order.id }] }, task, "tarea")).toThrow(/no pueden cambiarse/);
    const { links: _links, ...omitted } = input;
    expect(calendarAddendumRelations(omitted, task, "tarea")).toEqual(frozen);
});
it("fails closed for malformed stored locks and rejects client-forged metadata", () => {
    expect(() => readCalendarAddendumLock({ addendumRelations: {} })).toThrow(/histórica/);
    expect(calendarEventInput.safeParse({ ...input, details: { addendumRelations: { order, lead } } }).success).toBe(false);
});
