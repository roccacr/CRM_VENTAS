import { ConfigService } from "@nestjs/config";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { CalendarInput, CalendarRow } from "../../src/modules/crm/calendar/calendar.contract.js";
import { CalendarExternalService } from "../../src/modules/crm/calendar/calendar-external.service.js";
import { ExternalCalendarError } from "../../src/modules/crm/calendar/external-calendar.port.js";
import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";

const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const profile = { user: { publicId: id }, auth: { currentProvider: "microsoft", microsoft: { tenantId: "tenant", homeAccountId: "account" } }, orgUnits: [{ code: "formalizacion", status: "active" }], permissions: [{ code: "formalizacion.calendar.read", effect: "allow", scope: "self" }] } as unknown as IdentityProfile;
const input: CalendarInput = { moduleCode: "formalizacion", typeId: id, title: "Prueba", start: "2026-11-04T15:00:00Z", end: "2026-11-04T16:00:00Z", allDay: false, details: {}, publishToCalendar: true, operationId: "550e8400-e29b-41d4-a716-446655440000" };
const event: CalendarRow = { ...input, id, internalId: 9, ownerPublicId: id, originModule: "formalizacion", source: "native", typeCode: "tarea", formKey: "formalizacion.general.v1", version: 1, status: "scheduled", description: null, location: null, allDay: 0, participants: [] };
function fixture(links: { remoteId: string; eventId: string; uid?: string }[] = []) {
    const queries: CompiledQuery[] = [];
    let state: Record<string, unknown> = { id_calendar_event_sync: 4, status_calendar_event_sync: "pending", last_synced_version_calendar_event_sync: null, external_event_id_calendar_event_sync: null, external_version_calendar_event_sync: null, operation_id_calendar_event_sync: `crm:${id}`, attempt_count_calendar_event_sync: 0 };
    let snapshot = structuredClone(state);
    function rowsFor(query: CompiledQuery): object[] {
        if (query.sql.includes("from `int_calendar_event_sync` as `s`")) return links;
        if (query.sql.includes("from `crm_calendar_event`")) return [{ version: 1 }];
        if (query.sql.includes("from `sec_user`")) return [{ id: 1 }];
        if (query.sql.includes("from `int_external_system`")) return [{ id: 2 }];
        if (query.sql.includes("from `int_calendar_connection`")) return [{ id: 3, owner: 1, status: "active" }];
        if (query.sql.includes("from `int_calendar_event_sync`")) return [structuredClone(state)];
        return [];
    }
    class Driver extends DummyDriver {
        override beginTransaction() {
            snapshot = structuredClone(state);
            return Promise.resolve();
        }
        override rollbackTransaction() {
            state = snapshot;
            return Promise.resolve();
        }
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                if (query.sql.startsWith("update `int_calendar_event_sync`")) {
                    [...query.sql.matchAll(/`([^`]+)` = \?/g)].forEach((match, index) => {
                        if (match[1]) state[match[1]] = query.parameters[index];
                    });
                }
                const rows = rowsFor(query);
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => new Driver(), createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const identity = { getCurrentUser: vi.fn().mockResolvedValue(profile), withMicrosoftAccess: vi.fn((_session: string, _scopes: string[], callback: (token: string) => Promise<unknown>) => callback("private-token")) };
    const remote = { id: "remote", version: 'W/"1"', joinUrl: null, roomStatus: null };
    const external = {
        cancel: vi.fn().mockResolvedValue(undefined),
        patchOwnEvent: vi.fn().mockResolvedValue({ id: "remote", version: "v2" }),
        roomAvailability: vi.fn().mockResolvedValue({}),
        events: vi.fn().mockResolvedValue([]),
        suggestions: vi.fn().mockResolvedValue([]),
        write: vi.fn().mockResolvedValue(remote),
        read: vi.fn().mockResolvedValue(remote),
        rooms: vi.fn().mockResolvedValue([]),
        availability: vi.fn().mockResolvedValue({ events: [], conflicts: [], suggestions: [], incomplete: false }),
    };
    const service = new CalendarExternalService(identity as unknown as IdentityService, { db } as DatabaseService, external, new ConfigService({ ENABLE_CALENDAR_EXTERNAL: true }));
    return {
        db,
        service,
        queries,
        external,
        identity,
        setState: (value: Record<string, unknown>) => {
            state = { ...state, ...value };
        },
    };
}
it("correlates an invited mailbox copy by the shared Outlook UID", async () => {
    const f = fixture([{ remoteId: "organizer-copy", eventId: id, uid: "shared-uid" }]);
    try {
        f.external.events.mockResolvedValue([{ id: "attendee-copy", uid: "shared-uid", title: "Invitación", start: input.start, end: input.end, allDay: false, description: null, location: null }]);
        expect((await f.service.feed("session", profile, input)).links).toEqual([{ remoteId: "attendee-copy", eventId: id }]);
    } finally {
        await f.db.destroy();
    }
});
it("keeps invitation mappings in the old interval even when Outlook no longer returns that copy", async () => {
    const f = fixture([{ remoteId: "organizer-copy", eventId: id, uid: "shared-uid" }]);
    try {
        expect((await f.service.feed("session", profile, input)).links).toEqual([{ remoteId: "organizer-copy", eventId: id }]);
        const query = f.queries.find((entry) => entry.sql.includes("from `int_calendar_event_sync` as `s`"));
        expect(query?.sql).toContain("p.status_calendar_participant='active'");
        expect(query?.sql).toContain("p.revoked_at_calendar_participant IS NULL");
        expect(query?.sql).toContain("EXISTS(SELECT 1 FROM crm_calendar_participant");
    } finally {
        await f.db.destroy();
    }
});
it("uses the Outlook version seen by the editor while preserving conditional writes", async () => {
    const f = fixture();
    try {
        await f.service.publish("session", event, { ...input, expectedOutlookVersion: 'W/"observed"' }, profile);
        expect(f.external.write.mock.calls[0]?.[1]).toMatchObject({ remoteVersion: 'W/"observed"' });
    } finally {
        await f.db.destroy();
    }
});
it("publishes by default and persists the Outlook ID against the native event", async () => {
    const f = fixture();
    try {
        const { publishToCalendar: _preference, ...defaults } = input;
        await expect(f.service.publish("session", event, defaults, profile)).resolves.toMatchObject({ status: "synced", outlookId: "remote" });
        const saved = f.queries.find((query) => query.sql.startsWith("update `int_calendar_event_sync`"));
        expect(saved?.sql).toContain("`external_event_id_calendar_event_sync` = ?");
        expect(saved?.parameters).toContain("remote");
    } finally {
        await f.db.destroy();
    }
});
it("matches only the current Microsoft account after reading Outlook", async () => {
    const f = fixture([{ remoteId: "remote", eventId: id }]);
    try {
        f.external.events.mockResolvedValue([{ id: "remote", title: "Outlook", start: input.start, end: input.end, allDay: false, description: null, location: null }]);
        const result = await f.service.feed("session", profile, input);
        expect(result.links).toEqual([{ remoteId: "remote", eventId: id }]);
        const lookup = f.queries.find((query) => query.sql.includes("from `int_calendar_event_sync` as `s`"));
        expect(lookup?.parameters).toEqual(expect.arrayContaining([id, "microsoft365", "tenant", "account", "default", "remote"]));
        expect(lookup?.sql).toContain("`c`.`owner_user_id_calendar_connection`");
    } finally {
        await f.db.destroy();
    }
});
it("replays confirmed versions without sending a second invitation", async () => {
    const f = fixture();
    try {
        await expect(f.service.publish("session", event, input, profile)).resolves.toMatchObject({ status: "synced" });
        await expect(f.service.publish("session", event, input, profile)).resolves.toMatchObject({ status: "synced" });
        expect(f.external.write).toHaveBeenCalledTimes(1);
        expect(f.external.read).toHaveBeenCalledTimes(1);
        expect(f.external.write.mock.calls[0]?.[1]).toMatchObject({ transactionId: `crm:${id}` });
    } finally {
        await f.db.destroy();
    }
});
it("keeps the remote transaction identity after an uncertain network result", async () => {
    const f = fixture();
    try {
        f.external.write.mockRejectedValueOnce(new ExternalCalendarError("unavailable"));
        await expect(f.service.publish("session", event, input, profile)).resolves.toEqual({ status: "unavailable" });
        await expect(f.service.publish("session", event, input, profile)).resolves.toMatchObject({ status: "synced" });
        expect(f.external.write.mock.calls.map((call) => (call[1] as { transactionId: string }).transactionId)).toEqual([`crm:${id}`, `crm:${id}`]);
    } finally {
        await f.db.destroy();
    }
});
it("does not publish another organizer's event or a CRM-only request", async () => {
    const f = fixture();
    try {
        await expect(f.service.publish("session", { ...event, ownerPublicId: "another" }, input, profile)).resolves.toEqual({ status: "consent_required" });
        await expect(f.service.publish("session", event, { ...input, publishToCalendar: false }, profile)).resolves.toEqual({ status: "crm_only" });
        expect(f.external.write).not.toHaveBeenCalled();
        expect(f.queries).toEqual([]);
    } finally {
        await f.db.destroy();
    }
});
it.each([false, true])("keeps a local session CRM-only even when a Microsoft identity was linked previously (%s)", async (linked) => {
    const f = fixture();
    try {
        const localProfile = { ...profile, auth: { ...profile.auth, currentProvider: "local", microsoft: linked ? profile.auth.microsoft : null } };
        await expect(f.service.publish("session", event, input, localProfile)).resolves.toEqual({ status: "crm_only" });
        expect(f.identity.withMicrosoftAccess).not.toHaveBeenCalled();
        expect(f.external.write).not.toHaveBeenCalled();
        expect(f.queries).toEqual([]);
    } finally {
        await f.db.destroy();
    }
});
it("reports an incomplete Microsoft session instead of claiming Outlook delivery", async () => {
    const f = fixture();
    try {
        await expect(f.service.publish("session", event, input, { ...profile, auth: { ...profile.auth, microsoft: null } })).resolves.toEqual({ status: "consent_required" });
        expect(f.external.write).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
it("rejects missing module permission before contacting the provider", async () => {
    const f = fixture();
    try {
        f.identity.getCurrentUser.mockResolvedValue({ ...profile, permissions: [] });
        await expect(f.service.availability("session", { moduleCode: "formalizacion", start: input.start, end: input.end })).rejects.toMatchObject({ status: 403 });
        expect(f.external.availability).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
it("preserves the CRM result when scoped consent is missing", async () => {
    const f = fixture();
    try {
        f.identity.withMicrosoftAccess.mockResolvedValueOnce(null);
        await expect(f.service.publish("session", event, input, profile)).resolves.toEqual({ status: "consent_required" });
        expect(f.external.write).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
it("only queries room addresses resolved from the authorized tenant catalog", async () => {
    const f = fixture();
    try {
        f.external.rooms.mockResolvedValue([{ address: "room@test.test", label: "Sala", capacity: 8 }]);
        const result = await f.service.rooms("session", { moduleCode: "formalizacion", start: input.start, end: input.end });
        expect(result).toMatchObject({ status: "connected", data: [{ address: "room@test.test", availability: "unknown" }] });
    } finally {
        await f.db.destroy();
    }
});

it("reuses calendar consent even when optional meeting suggestions need a new scope", async () => {
    const f = fixture();
    try {
        f.identity.withMicrosoftAccess.mockImplementation((_session, scopes, callback) => (scopes.includes("Calendars.Read.Shared") ? Promise.resolve(null) : callback("existing-token")));
        const result = await f.service.availability("session", { moduleCode: "formalizacion", start: input.start, end: input.end });
        expect(result).toMatchObject({ status: "connected", data: { events: [], suggestions: [], suggestionsStatus: "consent_required" } });
        expect(f.external.availability).toHaveBeenCalledTimes(1);
    } finally {
        await f.db.destroy();
    }
});

it("reactivation cancels an old mailbox copy before creating a new invitation, using the freshly observed Outlook version", async () => {
    const f = fixture();
    try {
        f.setState({ external_event_id_calendar_event_sync: "old", external_version_calendar_event_sync: "stale" });
        const result = await f.service.publishState("session", { ...event, status: "scheduled" }, { moduleCode: "formalizacion", action: "reactivate", expectedStatus: "cancelled", expectedVersion: 0, operationId: input.operationId, expectedOutlookVersion: "fresh" }, profile);
        expect(result.status).toBe("synced");
        expect(f.external.cancel).toHaveBeenCalledWith("private-token", "old", "fresh", expect.any(String));
        expect(f.external.write.mock.calls[0]?.[1]).toMatchObject({ remoteId: null, remoteVersion: null, transactionId: `crm:${id}:reactivate:1` });
        expect(f.external.cancel.mock.invocationCallOrder[0]).toBeLessThan(f.external.write.mock.invocationCallOrder[0] ?? 0);
    } finally {
        await f.db.destroy();
    }
});
it("never creates a replacement invitation when cancelling the old one is unconfirmed", async () => {
    const f = fixture();
    try {
        f.setState({ external_event_id_calendar_event_sync: "old" });
        f.external.cancel.mockRejectedValue(new ExternalCalendarError("unavailable"));
        const result = await f.service.publishState("session", event, { moduleCode: "formalizacion", action: "reactivate", expectedStatus: "cancelled", expectedVersion: 0, operationId: input.operationId }, profile);
        expect(result.status).toBe("unavailable");
        expect(f.external.write).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
