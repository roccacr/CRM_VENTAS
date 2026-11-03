import { describe, expect, it } from "vitest";

import { acceptedSummary, groupAttendees, initials, invitees, whoLine } from "../../src/modules/calendar/calendar-outlook-people";
import type { OutlookAttendee, OutlookEventDetail } from "../../src/services/calendar/calendar-service";

const attendee = (name: string, response: OutlookAttendee["response"], kind: OutlookAttendee["kind"] = "required"): OutlookAttendee => ({ name, email: `${name.toLowerCase().replace(" ", "")}@rocca.test`, kind, response });
const detail = (attendees: OutlookAttendee[]): OutlookEventDetail => ({ organizer: { name: "Ana Lopez", email: "analopez@rocca.test" }, attendees, attendeeCount: attendees.length, isOrganizer: false, myResponse: null, isOnlineMeeting: true, joinUrl: null, isRecurring: false, showAs: null, sensitivity: null, importance: null, webLink: null });

describe("Outlook attendees", () => {
    it("shows the organizer on their own, not again among the attendees or in the counts", () => {
        const withOrganizer = { ...detail([attendee("Ana Lopez", "notResponded"), attendee("Eduardo", "accepted")]) };
        expect(invitees(withOrganizer).map((person) => person.name)).toEqual(["Eduardo"]);
        expect(acceptedSummary(withOrganizer)).toBe("1 de 1 han aceptado");
    });
    const list = [attendee("Eduardo", "accepted"), attendee("Rodolfo", "notResponded"), attendee("Kenneth", "none"), attendee("Sala 1", "accepted", "resource"), attendee("Luis", "declined")];
    it("groups replies like Outlook and leaves empty groups out", () => {
        expect(groupAttendees(list).map((group) => [group.label, group.items.length])).toEqual([
            ["Aceptado", 2],
            ["Rechazado", 1],
            ["Sin respuesta", 2],
        ]);
    });
    it("counts people only, not rooms, in the accepted summary", () => {
        expect(acceptedSummary(detail(list))).toBe("1 de 4 han aceptado");
        expect(acceptedSummary(detail([]))).toBeNull();
    });
    it("lists the first names and how many remain", () => {
        expect(whoLine(detail(list))).toBe("Ana Lopez, Eduardo, Rodolfo y 2 más");
        expect(whoLine(detail([attendee("Eduardo", "accepted")]))).toBe("Ana Lopez, Eduardo");
    });
    it("builds initials from names or e-mail", () => {
        expect(initials({ name: "José Pablo Jiménez", email: null })).toBe("JP");
        expect(initials({ name: null, email: "ana@rocca.test" })).toBe("AR");
    });
});
