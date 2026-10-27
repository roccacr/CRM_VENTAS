import { describe, expect, it } from "vitest";

import type { AppointmentIdentityResolvers, LegacyAppointmentEvidence, NativeAppointmentEvidence } from "../../src/modules/crm/marketing/marketing-appointments.contract.js";
import { buildMarketingAppointments } from "../../src/modules/crm/marketing/marketing-appointments.model.js";
import { createMarketingWindow } from "../../src/modules/crm/marketing/marketing-home.contract.js";
const window = createMarketingWindow("month", new Date("2026-10-23T18:00:00Z"));
const entity = (id: string) => ({ id, publicId: id, name: id });
const identities: AppointmentIdentityResolvers = { nativeSeller: entity, nativeProject: entity, legacySeller: entity, legacyProject: entity };
const native: NativeAppointmentEvidence = { typeCount: 1, aliases: [], cohorts: [{ id: "lead-A", date: "2026-10-20", sellerId: "seller-A", projectId: "p" }], events: [] };
const legacy: LegacyAppointmentEvidence = { cohorts: [], events: [], invalidDates: 0 };
const event = { id: "lead-A", eventId: "event-A", date: "2026-10-21", sellerId: "seller-A", projectId: "p", status: "completed" as const, attendance: null };
describe("appointment read model", () => {
    it("counts one lead with multiple appointments and one unique event with repeated links", () => {
        const result = buildMarketingAppointments({ native: { ...native, events: [event, event, { ...event, eventId: "event-B" }] }, legacy, provider: "netsuite" }, identities, { window });
        expect(result.data.available).toBe(true);
        if (!result.data.available) throw Error("Unavailable");
        expect(result.data.events).toHaveLength(2);
        expect(result.data.events[0]?.links).toEqual([{ sellerId: "seller-A", projectId: "p" }]);
        expect(result.data.leadsWithAppointment).toEqual([{ date: "2026-10-20", sellerId: "seller-A", projectId: "p", withAppointment: 1 }]);
        expect(result.data.events[0]?.attendance).toBeNull();
    });
    it("does not count cancelled-only appointments as a scheduled visit", () => {
        const result = buildMarketingAppointments({ native: { ...native, events: [{ ...event, status: "cancelled" }] }, legacy, provider: "netsuite" }, identities, { window });
        expect(result.data).toMatchObject({ available: true, leadsWithAppointment: [] });
    });
    it("uses future appointments for lead conversion without counting them as visits in the current period", () => {
        const result = buildMarketingAppointments({ native: { ...native, events: [{ ...event, date: "2026-11-01", status: "scheduled" }] }, legacy, provider: "netsuite" }, identities, { window });
        expect(result.data).toMatchObject({ available: true, events: [], leadsWithAppointment: [{ withAppointment: 1 }] });
    });
    it("attributes an old appointment to the canonical native lead owner when identities match", () => {
        const alias = { id: "lead-A", system: "netsuite", externalId: "100", sellerId: "seller-A", projectId: "p" };
        const old = { id: "old-1", providerId: "100", providerMatches: 1, sellerReference: "old-seller", projectReference: "old-p", projectName: null };
        const result = buildMarketingAppointments({ native: { ...native, aliases: [alias] }, legacy: { ...legacy, cohorts: [{ ...old, date: "2026-10-20" }], events: [{ ...old, eventId: "old-event", date: "2026-10-21", status: "completed", attendance: null }] }, provider: "netsuite" }, identities, { window });
        if (!result.data.available) throw Error("Unavailable");
        expect(result.data.leadsWithAppointment).toEqual([{ date: "2026-10-20", sellerId: "seller-A", projectId: "p", withAppointment: 1 }]);
        expect(result.data.events[0]?.links).toEqual([{ sellerId: "seller-A", projectId: "p" }]);
    });
    it("filters event links and cohort counts to the permitted lead owners", () => {
        const result = buildMarketingAppointments({ native: { ...native, events: [event] }, legacy, provider: "netsuite" }, identities, { window, sellerScope: new Set(["other"]) });
        expect(result.data).toMatchObject({ available: true, events: [], leadsWithAppointment: [] });
    });
});

it("rejects impossible legacy appointment dates and times", async () => {
    const { legacyAppointmentDate } = await import("../../src/integrations/legacy-crm/legacy-marketing-appointments.reader.js");
    for (const date of ["2026-99-99T10:00", "2026-02-30T10:00", "2026-10-23T24:00", "2026-10-23T10:80", "not a date"]) expect(legacyAppointmentDate(date)).toBeNull();
    expect(legacyAppointmentDate("2026-10-23T10:30:00")).toBe("2026-10-23");
});
it("does not recreate an excluded legacy cohort when native creation is outside coverage", () => {
    const alias = { id: "lead-A", system: "netsuite", externalId: "100", sellerId: "seller-A", projectId: "p" };
    const old = { id: "old", providerId: "100", providerMatches: 1, sellerReference: "old-seller", projectReference: "old-p", projectName: null };
    const result = buildMarketingAppointments({ native: { ...native, cohorts: [], aliases: [alias] }, legacy: { ...legacy, cohorts: [{ ...old, date: "2026-10-20" }], events: [{ ...old, eventId: "old-event", date: "2026-10-21", status: "completed", attendance: null }] }, provider: "netsuite" }, identities, { window });
    expect(result.data).toMatchObject({ available: true, leadsWithAppointment: [], events: [{ links: [{ sellerId: "seller-A" }] }] });
});

it("reports orphan appointments only in the global quality summary", () => {
    const sources = { native, legacy: { ...legacy, unresolvedEventIds: ["orphan-1", "orphan-1"] }, provider: "netsuite" };
    expect(buildMarketingAppointments(sources, identities, { window }).data).toMatchObject({ available: true, events: [], quality: { unresolvedLinks: 1 } });
    expect(buildMarketingAppointments(sources, identities, { window, sellerScope: new Set(["seller-A"]) }).data).toMatchObject({ available: true, quality: { unresolvedLinks: 0 } });
});
