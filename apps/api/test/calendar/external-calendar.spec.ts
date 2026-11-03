import { afterEach, expect, it, vi } from "vitest";

import { Microsoft365CalendarService } from "../../src/integrations/microsoft365/microsoft365-calendar.service.js";
import { ExternalCalendarError } from "../../src/modules/crm/calendar/external-calendar.port.js";
afterEach(() => vi.unstubAllGlobals());
it("checks each room's real schedule without treating missing or failed results as free", async () => {
    const time = (dateTime: string) => ({ dateTime, timeZone: "UTC" });
    vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
            Response.json({
                value: [
                    { scheduleId: "free@test.test", scheduleItems: [] },
                    { scheduleId: "busy@test.test", scheduleItems: [{ status: "tentative", start: time("2026-11-03T15:30:00"), end: time("2026-11-03T16:30:00") }] },
                    { scheduleId: "boundary@test.test", scheduleItems: [{ status: "busy", start: time("2026-11-03T14:00:00"), end: time("2026-11-03T15:00:00") }] },
                    { scheduleId: "error@test.test", error: { responseCode: "5006" } },
                ],
            }),
        ),
    );
    expect(await new Microsoft365CalendarService().roomAvailability("token", { start: "2026-11-03T15:00:00Z", end: "2026-11-03T16:00:00Z", addresses: ["free@test.test", "busy@test.test", "boundary@test.test", "error@test.test", "missing@test.test"] })).toEqual({ "free@test.test": "available", "busy@test.test": "busy", "boundary@test.test": "available", "error@test.test": "unknown", "missing@test.test": "unknown" });
});
it("reads the exact visible interval including free personal events with immutable IDs", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ value: [{ id: "immutable", subject: "Personal", showAs: "free", start: { dateTime: "2026-11-03T15:00:00", timeZone: "UTC" }, end: { dateTime: "2026-11-03T16:00:00", timeZone: "UTC" }, location: { displayName: "Oficina" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const slot = { start: "2026-11-01T06:00:00Z", end: "2026-12-01T06:00:00Z" };
    const result = await new Microsoft365CalendarService().events("token", slot);
    expect(result).toMatchObject([{ id: "immutable", title: "Personal", location: "Oficina" }]);
    const url = new URL(fetchMock.mock.calls[0]?.[0] as string);
    expect(url.searchParams.get("startDateTime")).toBe(slot.start);
    expect(url.searchParams.get("endDateTime")).toBe(slot.end);
    expect(new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get("Prefer")).toContain('IdType="ImmutableId"');
});
it("reads the full text body rather than truncating an editable event to bodyPreview", async () => {
    const description = "Descripción completa. ".repeat(100);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ value: [{ id: "full", "@odata.etag": 'W/"new"', iCalUId: "shared-uid", subject: "Firma", bodyPreview: "Descripción…", body: { contentType: "text", content: description }, start: { dateTime: "2026-11-03T15:00:00", timeZone: "UTC" }, end: { dateTime: "2026-11-03T16:00:00", timeZone: "UTC" } }] })));
    const result = await new Microsoft365CalendarService().events("token", { start: "2026-11-03T06:00:00Z", end: "2026-11-04T06:00:00Z" });
    expect(result[0]).toMatchObject({ description, version: 'W/"new"', uid: "shared-uid" });
});
it("preserves private content of the current mailbox for editing without redacting it into storage", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ value: [{ id: "private-own", sensitivity: "private", subject: "Título privado", body: { contentType: "text", content: "Descripción privada" }, location: { displayName: "Oficina privada" }, start: { dateTime: "2026-11-03T15:00:00", timeZone: "UTC" }, end: { dateTime: "2026-11-03T16:00:00", timeZone: "UTC" } }] })));
    expect((await new Microsoft365CalendarService().events("token", { start: "2026-11-03T06:00:00Z", end: "2026-11-04T06:00:00Z" }))[0]).toMatchObject({ title: "Título privado", description: "Descripción privada", location: "Oficina privada" });
});
it("reads organizer, attendees and meeting facts read-only, trusting only Microsoft links", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
        Response.json({
            value: [
                {
                    id: "meeting",
                    subject: "Globe / daily",
                    start: { dateTime: "2026-11-03T13:30:00", timeZone: "UTC" },
                    end: { dateTime: "2026-11-03T14:00:00", timeZone: "UTC" },
                    organizer: { emailAddress: { name: "Ana Lopez", address: "ana@rocca.test" } },
                    attendees: [
                        { type: "required", emailAddress: { name: "Eduardo", address: "edu@rocca.test" }, status: { response: "accepted" } },
                        { type: "optional", emailAddress: { name: "Rodolfo", address: "rod@rocca.test" }, status: { response: "notResponded" } },
                    ],
                    isOrganizer: false,
                    responseStatus: { response: "tentativelyAccepted" },
                    isOnlineMeeting: true,
                    onlineMeeting: { joinUrl: "https://teams.microsoft.com/l/meetup-join/abc" },
                    type: "occurrence",
                    showAs: "busy",
                    importance: "high",
                    webLink: "https://evil.example/owa/?itemid=1",
                },
            ],
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const [event] = await new Microsoft365CalendarService().events("token", { start: "2026-11-01T06:00:00Z", end: "2026-12-01T06:00:00Z" });
    expect(event?.outlook).toEqual({
        organizer: { name: "Ana Lopez", email: "ana@rocca.test" },
        attendees: [
            { name: "Eduardo", email: "edu@rocca.test", kind: "required", response: "accepted" },
            { name: "Rodolfo", email: "rod@rocca.test", kind: "optional", response: "notResponded" },
        ],
        attendeeCount: 2,
        isOrganizer: false,
        myResponse: "tentativelyAccepted",
        isOnlineMeeting: true,
        joinUrl: "https://teams.microsoft.com/l/meetup-join/abc",
        isRecurring: true,
        showAs: "busy",
        sensitivity: null,
        importance: "high",
        webLink: null,
    });
    expect(new URL(fetchMock.mock.calls[0]?.[0] as string).searchParams.get("$select")).toContain("attendees");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("GET");
});
it("sanitizes Graph permission failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("secret-provider-body", { status: 403 })));
    await expect(new Microsoft365CalendarService().rooms("secret-token")).rejects.toEqual(new ExternalCalendarError("consent_required"));
});
it("does not advertise failed participant schedules as available", async () => {
    vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((url: string) => Promise.resolve(Response.json(url.includes("calendarView") ? { value: [] } : url.includes("getSchedule") ? { value: [{ scheduleId: "a@test.test", error: { responseCode: "5006" } }] } : { meetingTimeSuggestions: [] }))),
    );
    const result = await new Microsoft365CalendarService().availability("token", { start: "2026-11-03T15:00:00Z", end: "2026-11-03T16:00:00Z", emails: ["a@test.test"] });
    expect(result.incomplete).toBe(true);
    expect(result.suggestions).toEqual([]);
});
it("reports overlapping events, excludes cancelled and self, and hides private titles", async () => {
    const event = { id: "busy", subject: "Private subject", sensitivity: "private", showAs: "busy", start: { dateTime: "2026-11-03T15:00:00", timeZone: "UTC" }, end: { dateTime: "2026-11-03T16:00:00", timeZone: "UTC" }, isAllDay: false };
    vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((url: string) => Promise.resolve(Response.json(url.includes("calendarView") ? { value: [event, { ...event, id: "self" }, { ...event, id: "cancelled", isCancelled: true }] } : { meetingTimeSuggestions: [] }))),
    );
    const result = await new Microsoft365CalendarService().availability("token", { start: "2026-11-03T15:30:00Z", end: "2026-11-03T16:30:00Z", emails: [], excludeId: "self" });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.title).toBe("Evento privado");
    expect(result.conflicts).toHaveLength(1);
});

it("creates Teams with resource attendance and uses ETag on updates", async () => {
    const remote = { id: "remote/id", "@odata.etag": 'W/"1"', onlineMeeting: { joinUrl: "https://teams.microsoft.com/l/meetup-join/test" }, attendees: [{ type: "resource", emailAddress: { address: "room@test.test" }, status: { response: "accepted" } }] };
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(Response.json(remote)));
    vi.stubGlobal("fetch", fetchMock);
    const event = { id: "native", title: "Firma", description: null, location: "Sala", start: "2026-11-04T15:00:00Z", end: "2026-11-04T16:00:00Z", allDay: 0, details: { teamsRequested: true } } as Parameters<Microsoft365CalendarService["write"]>[1]["event"];
    const service = new Microsoft365CalendarService();
    const result = await service.write("token", { event, emails: ["colleague@test.test"], remoteId: null, remoteVersion: null, transactionId: "stable-id", roomAddress: "room@test.test" });
    expect(result).toMatchObject({ roomStatus: "accepted", joinUrl: remote.onlineMeeting.joinUrl });
    const options = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(options.body as string)).toMatchObject({
        transactionId: "stable-id",
        isOnlineMeeting: true,
        onlineMeetingProvider: "teamsForBusiness",
        attendees: [
            { type: "required", emailAddress: { address: "colleague@test.test" } },
            { type: "resource", emailAddress: { address: "room@test.test" } },
        ],
    });
    await service.write("token", { event, emails: [], remoteId: "remote/id", remoteVersion: 'W/"1"', transactionId: "stable-id" });
    expect(fetchMock.mock.calls[1]?.[0]).toContain("remote%2Fid");
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("PATCH");
    expect(new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get("If-Match")).toBe('W/"1"');
});

it("serializes all-day dates at Costa Rica midnight for Graph", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: "all-day", "@odata.etag": "version" }));
    vi.stubGlobal("fetch", fetchMock);
    const event = { title: "Todo el día", description: null, location: null, start: "2026-11-04T06:00:00Z", end: "2026-11-05T06:00:00Z", allDay: 1, details: {} } as Parameters<Microsoft365CalendarService["write"]>[1]["event"];
    await new Microsoft365CalendarService().write("token", { event, emails: [], remoteId: null, remoteVersion: null, transactionId: "stable" });
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(request.body as string)).toMatchObject({ isAllDay: true, start: { dateTime: "2026-11-04T00:00:00", timeZone: "Central America Standard Time" }, end: { dateTime: "2026-11-05T00:00:00", timeZone: "Central America Standard Time" } });
});
it.each([false, undefined])("refuses Outlook PATCH when Graph does not confirm organizer (%s)", async (isOrganizer) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: "remote", "@odata.etag": "v1", isOrganizer }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new Microsoft365CalendarService().patchOwnEvent("token", "remote", { title: "Edit", location: "", start: "2026-11-03T15:00:00Z", end: "2026-11-03T16:00:00Z", allDay: false, expectedVersion: "v1" })).rejects.toMatchObject({ code: "conflict" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
});
it("edits an organizer's Outlook event with its ETag while preserving guests and Teams body", async () => {
    const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(Response.json({ id: "remote", "@odata.etag": "v1", isOrganizer: true }))
        .mockResolvedValueOnce(Response.json({ id: "remote", "@odata.etag": "v2", isOrganizer: true }));
    vi.stubGlobal("fetch", fetchMock);
    await new Microsoft365CalendarService().patchOwnEvent("token", "remote", { title: "Edit", location: "Office", start: "2026-11-03T15:00:00Z", end: "2026-11-03T16:00:00Z", allDay: false, expectedVersion: "v1" });
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(request.headers).get("If-Match")).toBe("v1");
    expect(JSON.parse(request.body as string)).toMatchObject({ subject: "Edit" });
    expect(JSON.parse(request.body as string)).not.toHaveProperty("attendees");
    expect(JSON.parse(request.body as string)).not.toHaveProperty("body");
});
it("preserves an Outlook all-day event's original zone and boundaries when editing its title", async () => {
    const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(Response.json({ id: "remote", "@odata.etag": "v1", isOrganizer: true }))
        .mockResolvedValueOnce(Response.json({ id: "remote", "@odata.etag": "v2", isOrganizer: true }));
    vi.stubGlobal("fetch", fetchMock);
    await new Microsoft365CalendarService().patchOwnEvent("token", "remote", { title: "Changed", location: "", start: "2026-11-03T00:00:00Z", end: "2026-11-04T00:00:00Z", allDay: true, expectedVersion: "v1" });
    const body: unknown = JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string);
    expect(body).toEqual({ subject: "Changed", location: { displayName: "" } });
});

it("cancels an organizer event and accepts Microsoft's empty 202 response", async () => {
    const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(Response.json({ id: "remote", "@odata.etag": 'W/"1"', isOrganizer: true }))
        .mockResolvedValueOnce(new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    await new Microsoft365CalendarService().cancel("token", "remote", 'W/"1"', "Cambio de agenda");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/me/events/remote/cancel");
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: "POST", body: JSON.stringify({ comment: "Cambio de agenda" }) });
});
it("treats an already absent Outlook event as cancelled without sending another request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await new Microsoft365CalendarService().cancel("token", "remote", null, "Motivo");
    expect(fetchMock).toHaveBeenCalledTimes(1);
});
it.each([
    { isOrganizer: false, version: 'W/"1"' },
    { isOrganizer: true, version: 'W/"changed"' },
])("rejects cancellation without organizer ownership or with stale Outlook version %j", async ({ isOrganizer, version }) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: "remote", "@odata.etag": version, isOrganizer }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new Microsoft365CalendarService().cancel("token", "remote", 'W/"1"', "Motivo")).rejects.toBeInstanceOf(ExternalCalendarError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
});
