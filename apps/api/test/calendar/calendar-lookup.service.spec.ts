import { ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult, type Transaction } from "kysely";
import { describe, expect, it } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { CalendarRepository } from "../../src/modules/crm/calendar/calendar.repository.js";
import { CalendarLookupService } from "../../src/modules/crm/calendar/calendar-lookup.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";

const actor = "01M4VECV87Y3Q3TGBBK8X2MHYX";
const target = "01M4VECV87Y3Q3TGBBK8X2MHYY";
function profile(codes = ["ventas.calendar.read", "lead.read", "ventas.notes.read"]): IdentityProfile {
    return { user: { publicId: actor, status: "active" }, roles: [], orgUnits: [{ code: "ventas", status: "active" }], permissions: codes.map((code) => ({ code, scope: "all_areas", effect: "allow", source: "role" })) } as unknown as IdentityProfile;
}
function fixture(rows: (q: CompiledQuery) => object[] = () => [], legacy = false) {
    const queries: CompiledQuery[] = [];
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                return Promise.resolve({ rows: rows(query) as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const snapshot = { read: <T>(callback: (tx: Transaction<CrmDatabase>) => Promise<T>) => db.transaction().execute(callback) } as CalendarRepository;
    const service = new CalendarLookupService(new ConfigService({ ENABLE_LEGACY_FALLBACK: legacy }), snapshot);
    return { service, queries, db, snapshot };
}
describe("CalendarLookupService", () => {
    it("hydrates 100 selected users with one bounded IN query", async () => {
        const ids = Array.from({ length: 100 }, (_, index) => actor.slice(0, 24) + String(Math.floor(index / 10)) + String(index % 10));
        const f = fixture(() => ids.map((id) => ({ id, source: "native", label: "Selected" })));
        const options = await f.db.transaction().execute((tx) => f.service.selectionOptions(tx, profile(), { links: [], participants: ids.map((userId) => ({ userId })) }));
        expect(options.users).toHaveLength(100);
        expect(f.queries).toHaveLength(1);
        expect(f.queries[0]?.parameters).toEqual([...ids, 100]);
    });
    it("discards earlier linked labels if a later relation is forbidden", async () => {
        const f = fixture(() => [{ id: target, source: "native", label: "Selected" }]);
        const options = await f.db.transaction().execute((tx) =>
            f.service.selectionOptions(tx, profile(), {
                links: [
                    { entityType: "note", source: "native", id: target },
                    { entityType: "sales_order", source: "native", id: target },
                ],
                participants: [{ userId: target }],
            }),
        );
        expect(options).toEqual({ users: [{ id: target, source: "native", label: "Selected" }] });
    });
    it("does not hide infrastructure failures during selection hydration", async () => {
        const f = fixture(() => {
            throw new Error("database unavailable");
        });
        await f.db.transaction().execute(async (tx) => {
            await expect(f.service.selectionOptions(tx, profile(), { links: [{ entityType: "lead", source: "native", id: target }], participants: [] })).rejects.toThrow("database unavailable");
        });
    });
    it("hydrates only selected public user IDs without enumerating the directory", async () => {
        const f = fixture(() => [{ id: target, source: "native", label: "Ana", secret: "hidden" }]);
        const options = await f.db.transaction().execute((tx) => f.service.selectionOptions(tx, profile(), { links: [], participants: [{ userId: target }, { email: "external@example.test" }, { userId: target }] }));
        expect(options).toEqual({ users: [{ id: target, source: "native", label: "Ana" }] });
        expect(f.queries).toHaveLength(1);
        const query = f.queries[0];
        if (!query) throw new Error("Missing exact user query");
        expect(query.sql).toContain("public_id_user IN (?)");
        expect(query.sql).not.toContain("LOCATE");
        expect(query.parameters).toContain(target);
        expect(query.parameters).not.toContain("external@example.test");
    });
    it("hydrates selected note, lead and order labels through exact resource queries", async () => {
        const f = fixture(() => [{ id: target, source: "native", label: "Selected", secondary: "Context" }]);
        const p = profile(["ventas.calendar.read", "lead.read", "ventas.notes.read", "formalizacion.orders.read"]);
        p.roles = [{ code: "formalizacion", name: "Formalizacion", status: "active" }];
        const options = await f.db.transaction().execute((tx) =>
            f.service.selectionOptions(tx, p, {
                links: [
                    { entityType: "note", source: "native", id: target },
                    { entityType: "lead", source: "native", id: target },
                    { entityType: "sales_order", source: "native", id: target },
                ],
                participants: [],
            }),
        );
        const selected = [{ id: target, source: "native", label: "Selected", secondary: "Context" }];
        expect(options).toEqual({ notes: selected, leads: selected, orders: selected });
        expect(f.queries).toHaveLength(3);
        expect(f.queries.every((query) => query.parameters.includes(target) && !query.sql.includes("LOCATE"))).toBe(true);
    });
    it("returns only participant descriptors when linked resources are restricted", async () => {
        const f = fixture(() => [{ id: target, source: "native", label: "Ana" }]);
        const options = await f.db.transaction().execute((tx) => f.service.selectionOptions(tx, profile(["ventas.calendar.read"]), { links: [{ entityType: "lead", source: "native", id: target }], participants: [{ userId: target }] }));
        expect(options).toEqual({ users: [{ id: target, source: "native", label: "Ana" }] });
        expect(f.queries).toHaveLength(1);
    });
    it("never hydrates participants without calendar access or by empty search", async () => {
        const f = fixture();
        await f.db.transaction().execute(async (tx) => {
            await expect(f.service.selectionOptions(tx, profile([]), { links: [], participants: [{ userId: target }] })).rejects.toBeInstanceOf(ForbiddenException);
            expect(await f.service.selectionOptions(tx, profile(), { links: [], participants: [{ email: "external@example.test" }] })).toEqual({});
        });
        expect(f.queries).toHaveLength(0);
    });
    it("hides unavailable relations but propagates database failures", async () => {
        const f = fixture();
        await f.db.transaction().execute(async (tx) => {
            expect(await f.service.canManageLinks(tx, profile(), [{ entityType: "lead", source: "native", id: target }])).toBe(false);
            expect(await f.service.canManageLinks(tx, profile(), [])).toBe(true);
            expect(await f.service.canManageLinks(tx, profile([]), [])).toBe(false);
        });
        const failed = fixture(() => {
            throw new Error("database unavailable");
        });
        await failed.db.transaction().execute(async (tx) => {
            await expect(failed.service.canManageLinks(tx, profile(), [{ entityType: "lead", source: "native", id: target }])).rejects.toThrow("database unavailable");
        });
    });
    it("accepts the parent limit of 100", async () => {
        const f = fixture();
        await f.service.lookup(profile(), { moduleCode: "ventas", kind: "users", search: "Ana", limit: 100 });
        expect(f.queries[0]?.parameters).toContain(100);
    });
    it("resolves explicit Nest DI using only the calendar repository and config", async () => {
        const f = fixture();
        const module = await Test.createTestingModule({ providers: [CalendarLookupService, { provide: ConfigService, useValue: new ConfigService({}) }, { provide: CalendarRepository, useValue: f.snapshot }] }).compile();
        expect(module.get(CalendarLookupService)).toBeInstanceOf(CalendarLookupService);
        await module.close();
    });
    it("restricts Formalizacion-only lead access to readable active orders", async () => {
        const f = fixture(() => [], true);
        const p = profile(["ventas.calendar.read", "formalizacion.orders.read"]);
        p.roles = [{ code: "formalizacion", name: "Formalizacion", status: "active" }];
        await f.service.lookup(p, { moduleCode: "ventas", kind: "leads", search: "Ana" });
        expect(f.queries[0]?.sql).toContain("o.lead_id_sales_order=l.id_lead");
        expect(f.queries[0]?.sql).toContain("cancelled_sales_order='no'");
        expect(f.queries[1]?.sql).toContain("o.id_ov_lead=l.idinterno_lead");
        expect(f.queries[1]?.sql).toContain("o.caida_ov=0");
    });
    it("rejects retired legacy aliases without changing caller identities or reading legacy", async () => {
        const f = fixture(() => [{ id: target }], true);
        const links = [{ entityType: "lead", source: "legacy", id: "214" }] as const;
        await f.db.transaction().execute(async (tx) => {
            await expect(f.service.validateLinks(tx, profile(), links)).rejects.toThrow("Seleccione el vínculo nativo");
        });
        expect(links).toEqual([{ entityType: "lead", source: "legacy", id: "214" }]);
        expect(f.queries).toHaveLength(1);
        expect(f.queries[0]?.sql).not.toContain("crmdatabase-api");
    });
    it("fails closed for an unknown resource scope", async () => {
        const f = fixture();
        const p = profile();
        p.permissions = p.permissions.map((entry) => (entry.code === "lead.read" && entry.effect === "allow" ? { ...entry, scope: "future_scope" } : entry));
        await expect(f.service.lookup(p, { moduleCode: "ventas", kind: "leads", search: "Ana" })).rejects.toBeInstanceOf(ForbiddenException);
        expect(f.queries).toHaveLength(0);
    });
    it("requires the selected calendar read permission before accessing data", async () => {
        const f = fixture();
        await expect(f.service.lookup(profile(), { moduleCode: "mercadeo", kind: "leads", search: "Ana" })).rejects.toBeInstanceOf(ForbiddenException);
        expect(f.queries).toHaveLength(0);
    });
    it("rejects a resource deny even with calendar access", async () => {
        const p = profile();
        p.permissions.push({ code: "lead.read", scope: null, effect: "deny", source: "override" });
        const f = fixture();
        await expect(f.service.lookup(p, { moduleCode: "ventas", kind: "leads", search: "Ana" })).rejects.toBeInstanceOf(ForbiddenException);
        expect(f.queries).toHaveLength(0);
    });
    it("bounds search and limits, rejects forged access and requires two characters for a typed lead search", async () => {
        const f = fixture();
        for (const input of [{ search: "a".repeat(101) }, { limit: 101 }, { access: "all" }]) await expect(f.service.lookup(profile(), { moduleCode: "ventas", kind: "leads", ...input })).rejects.toThrow();
        expect(await f.service.lookup(profile(), { moduleCode: "ventas", kind: "leads", search: "a" })).toEqual({ items: [] });
        expect(f.queries).toHaveLength(0);
    });
    it("returns only public user identity fields and parameterizes name/email search", async () => {
        const f = fixture(() => [{ id: target, source: "native", label: "Ana", secondary: "ana@example.test", secret: "hidden" }]);
        const result = await f.service.lookup(profile(), { moduleCode: "ventas", kind: "users", search: "a%'_" });
        expect(result).toEqual({ items: [{ id: target, source: "native", label: "Ana", secondary: "ana@example.test" }] });
        expect(f.queries[0]?.sql).toContain("normalized_email_user");
        expect(f.queries[0]?.sql).toContain("'inactive','pending'");
        expect(f.queries[0]?.sql).not.toContain("a%'_");
    });
    it("lists own and shared notes without requiring task assignment, preserving live ACL and denies", async () => {
        const f = fixture(() => [{ id: target, source: "native", label: "Pendiente" }]);
        expect(await f.service.lookup(profile(), { moduleCode: "ventas", kind: "notes", search: "" })).toEqual({ items: [{ id: target, source: "native", label: "Pendiente" }] });
        const query = f.queries[0];
        if (!query) throw new Error("Missing query");
        expect(query.sql).toContain("n.status_note IN ('open','completed')");
        expect(query.sql).not.toContain("assignee_user_id_note_task");
        expect(query.sql).toContain("revoked_at_note_participant IS NULL");
        expect(query.parameters).toContain(actor);
    });
    it("uses bounded native and legacy searches with native-first results", async () => {
        const f = fixture((q) => (q.sql.includes("crmdatabase-api") ? [{ id: "214", source: "legacy", label: "Ana legacy" }] : [{ id: target, source: "native", label: "Ana native" }]), true);
        const result = await f.service.lookup(profile(), { moduleCode: "ventas", kind: "leads", search: "Ana", limit: 2 });
        expect(result.items.map((i) => i.source)).toEqual(["native", "legacy"]);
        expect(f.queries[0]?.sql).toContain("full_name_contact");
        expect(f.queries[1]?.sql).toContain("nombre_lead");
        expect(f.queries.every((q) => q.sql.includes("LIMIT") && q.sql.includes("MAX_EXECUTION_TIME"))).toBe(true);
    });
    it("applies the existing seller scope before searching native or legacy leads", async () => {
        const f = fixture(() => [], true);

        const p = profile();
        p.permissions = p.permissions.map((p) => (p.code === "lead.read" && p.effect === "allow" ? { ...p, scope: "assigned" } : p));
        await f.service.lookup(p, { moduleCode: "ventas", kind: "leads", search: "Ana" });

        expect(f.queries[0]?.sql).toContain("owner_user_id_lead");
        expect(f.queries[0]?.parameters).toContain(actor);
        expect(f.queries[1]?.sql).toContain("idnetsuite_admin");
        expect(f.queries[1]?.parameters).toContain(actor);
    });
    it("requires formalization order access, searches tranid and suppresses only explicit mappings", async () => {
        const f = fixture(() => [], true);
        const p = profile(["ventas.calendar.read", "formalizacion.orders.read"]);
        p.roles = [{ code: "formalizacion", name: "Formalizacion", status: "active" }];
        await f.service.lookup(p, { moduleCode: "ventas", kind: "orders", search: "BC532" });
        const [native, legacy] = f.queries;
        if (!native || !legacy) throw new Error("Expected both sources");
        expect(native.sql).toContain("transaction_number_sales_order_external_reference");
        expect(native.sql).toContain("c.full_name_contact");
        expect(native.sql).toContain("p.name_project");
        expect(legacy.sql).toContain("id_ov_tranid");
        expect(legacy.sql).toContain("COUNT(*)=1");
        expect(legacy.sql).toContain("l.nombre_lead");
        expect(legacy.sql).toContain("id_old_produccion_sales_order");
        expect(legacy.sql).toContain("NOT EXISTS");
    });
    it("validates exact identities on the supplied transaction and returns no labels", async () => {
        const f = fixture(() => [{ id: target, source: "native", label: "Private" }]);
        const result = await f.db.transaction().execute((tx) => f.service.validateLinks(tx, profile(), [{ entityType: "lead", source: "native", id: target }]));
        expect(result).toEqual([{ entityType: "lead", source: "native", id: target }]);
        expect(f.queries[0]?.parameters).toContain(target);
        expect(f.queries.every((q) => q.sql.startsWith("SELECT"))).toBe(true);
    });
    it("fails closed for unavailable, malformed and unsupported legacy note links", async () => {
        const f = fixture();
        await f.db.transaction().execute(async (tx: Transaction<CrmDatabase>) => {
            for (const link of [
                { entityType: "lead", source: "native", id: target },
                { entityType: "note", source: "legacy", id: "1" },
                { entityType: "lead", source: "native", id: "bad" },
            ] as const)
                await expect(f.service.validateLinks(tx, profile(), [link])).rejects.toThrow();
        });
    });
});

it("filters orders by source-qualified leads and returns the authorized owner lead", async () => {
    const f = fixture((q) => (q.sql.includes("FROM crm_sales_order o") ? [{ id: actor, source: "native", label: "OV-1", leadId: target }] : [{ id: target, source: "native", label: "Cliente" }]));
    const p = profile(["ventas.calendar.read", "formalizacion.orders.read", "lead.read"]);
    p.roles = [{ code: "formalizacion", name: "Formalización", status: "active" }];
    const result = await f.service.lookup(p, { moduleCode: "ventas", kind: "orders", search: "OV", leads: JSON.stringify([{ entityType: "lead", source: "native", id: target }]) });
    expect(result.items).toEqual([{ id: actor, source: "native", label: "OV-1", lead: { id: target, source: "native", label: "Cliente" } }]);
    const order = f.queries.find((q) => q.sql.includes("FROM crm_sales_order o"));
    expect(order?.sql).toContain("selected.public_id_lead IN");
    expect(order?.parameters).toContain(target);
    await f.db.destroy();
});
it("resolves comma separated colleagues through bounded exact email or name matches", async () => {
    const f = fixture();
    try {
        await f.service.lookup(profile(), { moduleCode: "ventas", kind: "users", search: "ana@example.test, Luis Pérez" });
        const query = f.queries.find((q) => q.sql.includes("FROM sec_user"));
        expect(query?.sql).toContain(" OR ");
        expect(query?.parameters).toContain("ana@example.test");
        expect(query?.parameters).toContain("Luis Pérez");
        expect(query?.sql).not.toContain("ana@example.test");
    } finally {
        await f.db.destroy();
    }
});
it("loads a bounded authorized lead list before typing", async () => {
    const f = fixture((q) => (q.sql.includes("FROM crm_lead l JOIN crm_contact") ? [{ id: target, source: "native", label: "Cliente" }] : []));
    try {
        const result = await f.service.lookup(profile(), { moduleCode: "ventas", kind: "leads", search: "" });
        expect(result.items).toHaveLength(1);
        expect(f.queries.some((q) => q.sql.includes("LIMIT"))).toBe(true);
    } finally {
        await f.db.destroy();
    }
});
it("lists all authorized orders of a chosen lead without requiring a second search", async () => {
    const f = fixture((q) =>
        q.sql.includes("FROM crm_sales_order o")
            ? [
                  { id: actor, source: "native", label: "OV-1", leadId: target },
                  { id: target, source: "native", label: "OV-2", leadId: target },
              ]
            : [{ id: target, source: "native", label: "Cliente" }],
    );
    const p = profile(["ventas.calendar.read", "formalizacion.orders.read", "lead.read"]);
    p.roles = [{ code: "formalizacion", name: "Formalización", status: "active" }];
    try {
        expect((await f.service.lookup(p, { moduleCode: "ventas", kind: "orders", search: "", leads: JSON.stringify([{ entityType: "lead", source: "native", id: target }]) })).items).toHaveLength(2);
    } finally {
        await f.db.destroy();
    }
});
it.each(["self", "all_areas"] as const)("keeps seller restrictions only where needed for the initial legacy list (%s)", async (scope) => {
    const f = fixture(() => [], true);
    const actorProfile = profile();
    actorProfile.permissions = actorProfile.permissions.map((permission) => (permission.code === "lead.read" && permission.effect === "allow" ? { ...permission, scope } : permission));
    try {
        await f.service.lookup(actorProfile, { moduleCode: "ventas", kind: "leads", search: "" });
        const query = f.queries.find((query) => query.sql.includes("FROM `crmdatabase-api`.`leads` l"));
        expect(query?.sql).toContain("ORDER BY l.id_lead DESC");
        if (scope === "self") {
            expect(query?.sql).toContain("normalized_email_user");
            expect(query?.parameters).toContain(actor);
        } else expect(query?.sql).not.toContain("normalized_email_user");
    } finally {
        await f.db.destroy();
    }
});
it("exposes each readable CRM link independently and redacts an inaccessible note", async () => {
    const f = fixture((query) => (query.sql.includes("FROM crm_lead l JOIN crm_contact") ? [{ id: target, source: "native", label: "Cliente autorizado" }] : []));
    try {
        const result = await f.db.transaction().execute((tx) =>
            f.service.detailSelections(
                tx,
                profile(),
                [
                    { entityType: "note", source: "native", id: actor },
                    { entityType: "lead", source: "native", id: target },
                ],
                [{ email: "guest@example.test" }],
            ),
        );
        expect(result).toEqual({ links: [{ entityType: "lead", source: "native", id: target, label: "Cliente autorizado", canOpen: false }], participants: [{ label: "guest@example.test", email: "guest@example.test" }], restrictedLinks: true });
        expect(JSON.stringify(result)).not.toContain(actor);
    } finally {
        await f.db.destroy();
    }
});

describe("Marketing global lead lookup", () => {
    it.each(["mercadeo", "jefe_mercadeo"])("lets %s search native and legacy leads across sellers", async (role) => {
        const f = fixture(() => [], true);
        const p = profile(["mercadeo.calendar.read", "mercadeo.leads.read", "mercadeo.reports.read_all"]);
        p.roles = [{ code: role, name: role, status: "active" }];
        p.orgUnits = [{ code: "mercadeo", status: "active" }] as never;
        p.permissions = p.permissions.map((permission) => (permission.effect === "allow" ? { ...permission, scope: "self" } : permission));
        try {
            await f.service.lookup(p, { moduleCode: "mercadeo", kind: "leads", search: "Ana" });
            expect(f.queries).toHaveLength(2);
            expect(f.queries.every((query) => !query.sql.includes("u.public_id_user IN"))).toBe(true);
            expect(f.queries.every((query) => !query.parameters.includes(actor))).toBe(true);
            expect(f.queries[0]?.sql).toContain("crm_lead");
            expect(f.queries[1]?.sql).toContain("crmdatabase-api");
        } finally {
            await f.db.destroy();
        }
    });
    it.each(["absent", "denied"])("keeps seller filtering when global capability is %s", async (state) => {
        const f = fixture();
        const p = profile(["mercadeo.calendar.read", "mercadeo.leads.read"]);
        p.orgUnits = [{ code: "mercadeo", status: "active" }] as never;
        p.permissions = p.permissions.map((permission) => (permission.effect === "allow" ? { ...permission, scope: "self" } : permission));
        if (state === "denied") p.permissions.push({ code: "mercadeo.reports.read_all", effect: "deny", scope: null, source: "override" });
        try {
            await f.service.lookup(p, { moduleCode: "mercadeo", kind: "leads", search: "Ana" });
            expect(f.queries[0]?.sql).toContain("u.public_id_user IN");
            expect(f.queries[0]?.parameters).toContain(actor);
        } finally {
            await f.db.destroy();
        }
    });
    it.each(["absent", "denied"])("does not bypass a %s lead read permission", async (state) => {
        const f = fixture();
        const p = profile(["mercadeo.calendar.read", "mercadeo.reports.read_all"]);
        p.orgUnits = [{ code: "mercadeo", status: "active" }] as never;
        if (state === "denied") p.permissions.push({ code: "mercadeo.leads.read", effect: "deny", scope: null, source: "override" });
        try {
            await expect(f.service.lookup(p, { moduleCode: "mercadeo", kind: "leads", search: "Ana" })).rejects.toBeInstanceOf(ForbiddenException);
            expect(f.queries).toHaveLength(0);
        } finally {
            await f.db.destroy();
        }
    });
});
