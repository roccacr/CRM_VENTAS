import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { expect, it, vi } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import type { CalendarRow } from "../../src/modules/crm/calendar/calendar.contract.js";
import { CalendarNotificationsService, saveCalendarNotifications } from "../../src/modules/crm/calendar/calendar-notifications.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const profile = {
    user: { publicId: id },
    roles: [],
    orgUnits: [{ code: "mercadeo", status: "active" }],
    permissions: [
        { code: "mercadeo.calendar.read", effect: "allow", scope: "self" },
        { code: "formalizacion.calendar.read", effect: "deny", scope: "self" },
    ],
} as unknown as IdentityProfile;
function fixture() {
    const queries: CompiledQuery[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                return Promise.resolve({ rows: [] });
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => new Driver(), createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const identity = { getCurrentUser: vi.fn().mockResolvedValue(profile) };
    return { db, queries, identity, service: new CalendarNotificationsService(identity as never, { db } as never) };
}
it("filters bell metadata and read receipts by recipient, current participation, expiry and explicit denies", async () => {
    const f = fixture();
    try {
        expect(await f.service.list("session")).toEqual({ items: [], unreadCount: 0 });
        await f.service.read("session", id);
        expect(f.queries).toHaveLength(2);
        expect(f.queries[0]?.sql).toContain("ORDER BY (n.read_at_calendar_notification IS NULL) DESC");
        for (const query of f.queries) {
            expect(query.parameters).toContain(id);
            expect(query.parameters).toContain("formalizacion");
            expect(query.sql).toContain("p.revoked_at_calendar_participant IS NULL");
            expect(query.sql).toContain("expires_at_calendar_notification>UTC_TIMESTAMP(3)");
            expect(query.sql).toContain("o.code_org_unit NOT IN");
        }
        expect(f.queries[1]?.sql).toContain("COALESCE(n.read_at_calendar_notification,UTC_TIMESTAMP(3))");
    } finally {
        await f.db.destroy();
    }
});
it("acknowledges every notification for the opened event only for its authorized recipient, including cancellation", async () => {
    const f = fixture();
    try {
        await f.service.acknowledge("session", id);
        expect(f.queries).toHaveLength(1);
        expect(f.queries[0]?.sql).toContain("e.public_id_calendar_event=");
        expect(f.queries[0]?.sql).toContain("COALESCE(n.read_at_calendar_notification,UTC_TIMESTAMP(3))");
        expect(f.queries[0]?.sql).not.toContain("e.status_calendar_event<>'cancelled'");
        expect(f.queries[0]?.sql).toContain("u.public_id_user=");
        expect(f.queries[0]?.parameters).toContain(id);
    } finally {
        await f.db.destroy();
    }
});
it("does not query metadata without any readable CRM calendar", async () => {
    const f = fixture();
    f.identity.getCurrentUser.mockResolvedValue({ ...profile, permissions: [] });
    try {
        expect(await f.service.list("session")).toEqual({ items: [], unreadCount: 0 });
        expect(f.queries).toHaveLength(0);
    } finally {
        await f.db.destroy();
    }
});
it("writes one versioned invitation or update per internal attendee, excluding actor in SQL", async () => {
    const f = fixture();
    const after = { internalId: 5, version: 2, participants: [{ userId: id }, { userId: "new" }, { userId: "new" }, { email: "guest@example.test" }] } as unknown as CalendarRow;
    try {
        await f.db.transaction().execute((tx) => saveCalendarNotifications(tx, { participants: [{ userId: id }] } as CalendarRow, after, 9));
        expect(f.queries).toHaveLength(2);
        expect(f.queries[0]?.parameters).toContain("event_updated");
        expect(f.queries[1]?.parameters).toContain("invitation");
        for (const query of f.queries) {
            expect(query.sql).toContain("u.id_user<>");
            expect(query.sql).toContain("ON DUPLICATE KEY UPDATE");
            expect(query.parameters).toContain("2");
        }
    } finally {
        await f.db.destroy();
    }
});
