import { expect, it } from "vitest";

import { calendarEventInput, calendarLink, calendarParticipant } from "../../src/modules/crm/calendar/calendar.contract.js";
import { calendarDetails } from "../../src/modules/crm/calendar/calendar.repository.js";

it("requires exactly one participant identity", () => {
    expect(calendarParticipant.safeParse({}).success).toBe(false);
    expect(calendarParticipant.safeParse({ userId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", email: "guest@example.com" }).success).toBe(false);
    expect(calendarParticipant.safeParse({ userId: "01ARZ3NDEKTSV4RRFFQ69G5FAV" }).success).toBe(true);
    expect(calendarParticipant.safeParse({ email: "guest@example.com" }).success).toBe(true);
    expect(calendarParticipant.safeParse({ email: "invalid" }).success).toBe(false);
});
it("accepts source-aware links and bounded Teams metadata without arbitrary fields", () => {
    expect(calendarLink.safeParse({ entityType: "sales_order", source: "legacy", id: "123" }).success).toBe(true);
    expect(calendarLink.safeParse({ entityType: "account", source: "native", id: "123" }).success).toBe(false);
    expect(calendarEventInput.shape.details.safeParse({ reference: "ref", teamsRequested: true }).success).toBe(true);
    expect(calendarDetails({ reference: "ref", teamsRequested: false, secret: "hidden" })).toEqual({ reference: "ref", teamsRequested: false });
});

it.each([
    { entityType: "note", source: "legacy", id: "12" },
    { entityType: "lead", source: "legacy", id: "0" },
    { entityType: "lead", source: "legacy", id: "12x" },
    { entityType: "lead", source: "native", id: "12" },
    { entityType: "lead", source: "native", id: "81ARZ3NDEKTSV4RRFFQ69G5FAV" },
])("rejects invalid source identities %j", (link) => {
    expect(calendarLink.safeParse(link).success).toBe(false);
});
it("accepts native ULID links and normalizes participant email", () => {
    expect(calendarLink.safeParse({ entityType: "note", source: "native", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" }).success).toBe(true);
    expect(calendarParticipant.parse({ email: " GUEST@EXAMPLE.COM " })).toEqual({ email: "guest@example.com" });
});
