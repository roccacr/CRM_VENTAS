import { describe, expect, it } from "vitest";

import { appointmentCaption, summarizeAppointmentEvents } from "../../src/modules/home/marketing-appointments.model";
import type { MarketingAppointmentEvent } from "../../src/services/marketing/home-summary-service";
const period = { start: new Date(2026, 9, 1), end: new Date(2026, 9, 23) };
const event: MarketingAppointmentEvent = {
    id: "e",
    date: "2026-10-20",
    status: "completed",
    attendance: null,
    links: [
        { sellerId: "A", projectId: "X" },
        { sellerId: "B", projectId: "Y" },
    ],
};
describe("appointment event metrics", () => {
    it("counts a multi-lead event once when multiple selected owners match", () => {
        expect(summarizeAppointmentEvents([event], period, { sellers: ["A", "B"], projects: [] }).completed).toBe(1);
    });
    it("never matches owner from one link and project from a different lead", () => {
        expect(summarizeAppointmentEvents([event], period, { sellers: ["A"], projects: ["Y"] }).completed).toBe(0);
    });
    it("uses the event date rather than captured cohorts and separates explicit attendance", () => {
        const totals = summarizeAppointmentEvents([event, { ...event, id: "outside", date: "2026-09-30" }, { ...event, id: "verified", attendance: "attended" }, { ...event, id: "cancelled", status: "cancelled" }, { ...event, id: "pending", status: "scheduled" }], period, { sellers: [], projects: [] });
        expect(totals).toEqual({ completed: 2, pending: 1, cancelled: 1, attended: 1, missed: 0, unverified: 1 });
        expect(appointmentCaption(totals)).toContain("1 sin verificar");
    });
    it("does not interpret completed legacy appointments as attendance", () => {
        const totals = summarizeAppointmentEvents([event], period, { sellers: [], projects: [] });
        expect(totals.attended).toBe(0);
        expect(appointmentCaption(totals)).toContain("No hay información suficiente para confirmar quién asistió");
    });
});
