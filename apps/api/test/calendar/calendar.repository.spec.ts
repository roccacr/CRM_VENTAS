import { createHash } from "node:crypto";

import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { expect, it, vi } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacyCalendarReader } from "../../src/integrations/legacy-crm/legacy-calendar.reader.js";
import type { CalendarInput, CalendarRow } from "../../src/modules/crm/calendar/calendar.contract.js";
import { CalendarRepository } from "../../src/modules/crm/calendar/calendar.repository.js";
import { anyOf } from "../support/throws.js";
const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const input: CalendarInput = { moduleCode: "formalizacion", typeId: id, title: "Evento", start: "2026-10-28T14:00:00Z", end: "2026-10-28T15:00:00Z", allDay: false, details: {}, operationId: "550e8400-e29b-41d4-a716-446655440000" };
const row: CalendarRow = { internalId: 5, ownerPublicId: "actor", id, source: "native", originModule: "formalizacion", typeId: id, typeCode: "tarea", formKey: "formalizacion.general.v1", title: "Evento", start: input.start, end: input.end, allDay: 0, description: null, location: null, status: "scheduled", version: 2, details: {} };
function setup(options: { auditFailure?: boolean; before?: Partial<CalendarRow>; replay?: boolean; changedReplay?: boolean; missingType?: boolean; typeCode?: string; participantRows?: object[]; emailUser?: boolean; catalogRows?: object[] } = {}) {
    const emailUserRows = options.emailUser ? [{ public_id_user: id, status_user: "active", deleted_at_user: null }] : [];
    const participantRows = options.participantRows ?? [];
    const queries: CompiledQuery[] = [];
    const steps: string[] = [];
    const replayHash = options.changedReplay
        ? "other"
        : createHash("sha256")
              .update(JSON.stringify({ id: null, input }))
              .digest("hex");
    const typeCode = options.typeCode ?? "tarea";
    const replayRows = [{ data: { publicId: id, commandHash: replayHash } }].filter(() => options.replay);
    const catalogRows = options.catalogRows ?? [];
    const activeTypeRows = options.missingType ? [] : [{ id_calendar_event_type: 4, code_calendar_event_type: typeCode, id_org_unit: 3 }];
    const driver = new DummyDriver();
    driver.beginTransaction = () => {
        steps.push("begin");
        return Promise.resolve();
    };
    driver.commitTransaction = () => {
        steps.push("commit");
        return Promise.resolve();
    };
    driver.rollbackTransaction = () => {
        steps.push("rollback");
        return Promise.resolve();
    };
    driver.acquireConnection = () =>
        Promise.resolve({
            // Dispatch the simulated database responses for command and relation reads.
            // eslint-disable-next-line complexity
            executeQuery: <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                let rows: object[] = query.sql.includes("AS formKey FROM conf_calendar_event_type") ? catalogRows : [];
                if (query.sql.includes("from `sec_user`")) rows = [{ id_user: 9 }];
                if (query.sql.includes("normalized_email_user")) rows = emailUserRows;
                if (query.sql.includes("select * from `crm_calendar_participant`")) rows = participantRows;
                if (query.sql.includes("FROM audit_record_event")) rows = replayRows;
                if (query.sql.includes("FROM crm_calendar_event e JOIN")) rows = [{ ...row, ...options.before }];
                if (query.sql.includes("from `conf_calendar_event_type`")) rows = activeTypeRows;
                if (/^(insert|update)/.test(query.sql)) steps.push("write");
                return Promise.resolve({ rows: rows as R[] });
            },
            async *streamQuery() {
                yield await Promise.resolve({ rows: [] });
            },
        });
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const audit = {
        enabled: true,
        captureActor: vi.fn().mockResolvedValue({ publicId: "actor", name: "Actor", roles: [] }),
        append: vi.fn<(tx: unknown, entry: unknown) => Promise<void>>().mockImplementation(() => {
            steps.push("audit");
            return options.auditFailure ? Promise.reject(new Error("audit failure")) : Promise.resolve();
        }),
    };
    return { db, queries, steps, audit, repo: new CalendarRepository({ db } as never, audit as never) };
}
it("commits content and server-attributed audit together, with actor locked before retry probe", async () => {
    const f = setup();
    try {
        await f.repo.save("actor", input, false);
        expect(f.steps).toEqual(["begin", "write", "audit", "commit"]);
        expect(f.queries[0]?.sql).toContain("for update");
        expect(f.queries[1]?.sql).toContain("FOR UPDATE");
        const insert = f.queries.find((query) => query.sql.startsWith("insert"));
        expect(insert?.parameters).toContain("2026-10-28 14:00:00.000");
        expect(insert?.parameters.some((value) => value instanceof Date)).toBe(false);
        expect(f.audit.append.mock.calls[0]?.[1]).toMatchObject({ action: "create", before: null, source: { schema: "CRM_THINK_V2", table: "crm_calendar_event", entity: "calendar_event", id: "5" }, actor: { publicId: "actor" } });
    } finally {
        await f.db.destroy();
    }
});
it("rolls back the event when its audit append fails", async () => {
    const f = setup({ auditFailure: true });
    try {
        await expect(f.repo.save("actor", input, false)).rejects.toThrow("audit failure");
        expect(f.steps).toEqual(["begin", "write", "audit", "rollback"]);
    } finally {
        await f.db.destroy();
    }
});
it.each([{ typeCode: "general" }, { version: 3 }, { ownerPublicId: "other" }, { originModule: "mercadeo" as const }, { status: "cancelled" as const }])("rejects stale version, foreign ownership/origin or cancellation under lock %j", async (before) => {
    const f = setup({ before });
    try {
        await expect(f.repo.save("actor", { ...input, expectedVersion: 2 }, true, id)).rejects.toThrow(anyOf("Este tipo histórico solo está disponible para consulta.", "El evento cambió; recárguelo antes de guardar.", "Solo el organizador puede editar este evento.", "El evento solo se gestiona desde su módulo de origen.", "No se puede editar un evento cancelado."));
        expect(f.steps).toEqual(["begin", "rollback"]);
        expect(f.audit.append).not.toHaveBeenCalled();
        expect(f.queries.some((q) => q.sql.includes("FOR UPDATE") && q.sql.includes("FROM crm_calendar_event"))).toBe(true);
    } finally {
        await f.db.destroy();
    }
});
it("increments event version only after its locked version matches", async () => {
    const f = setup();
    try {
        await f.repo.save("actor", { ...input, expectedVersion: 2 }, true, id);
        const update = f.queries.find((q) => q.sql.startsWith("update"));
        expect(update?.sql).toContain("`version_calendar_event` = ?");
        expect(update?.parameters).toContain(3);
        expect(f.audit.append.mock.calls[0]?.[1]).toMatchObject({ action: "update", before: { version: 2 } });
    } finally {
        await f.db.destroy();
    }
});
it.each([false, true])("retries never issue a second write; different content is rejected (%s)", async (changedReplay) => {
    const f = setup({ replay: true, changedReplay });
    try {
        const operation = f.repo.save("actor", input, false);
        if (changedReplay) await expect(operation).rejects.toMatchObject({ status: 409 });
        else await expect(operation).resolves.toMatchObject({ id });
        expect(f.steps).not.toContain("write");
        expect(f.audit.append).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
it("fails without writes when the active event type does not belong to its origin", async () => {
    const f = setup({ missingType: true });
    try {
        await expect(f.repo.save("actor", input, false)).rejects.toMatchObject({ status: 409 });
        expect(f.steps).toEqual(["begin", "rollback"]);
    } finally {
        await f.db.destroy();
    }
});
it("rejects a stored active type that is not enabled by the global configuration", async () => {
    const f = setup({ typeCode: "general" });
    try {
        await expect(f.repo.save("actor", input, false)).rejects.toMatchObject({ status: 409 });
        expect(f.steps).toEqual(["begin", "rollback"]);
        expect(f.audit.append).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
it("returns only globally available types in JSON order, with global labels and colors", async () => {
    const catalogRows = ["seguimiento", "general", "reunion", "tarea", "cita", "adendum", "formalizacion_bancaria"].map((code) => ({ id: code, moduleCode: "formalizacion", code, label: "Old label", color: "#000000", formKey: "formalizacion.general.v1" }));
    const f = setup({ catalogRows });
    try {
        const result = await f.repo.read((tx) => f.repo.types(tx, ["formalizacion"]));
        expect(result.map((type) => type.code)).toEqual(["tarea", "reunion", "seguimiento", "formalizacion_bancaria", "adendum"]);
        expect(result[1]).toMatchObject({ id: "reunion", label: "Reunión", color: "#4F46E5" });
    } finally {
        await f.db.destroy();
    }
});
it("binds date/module/actor inputs, excludes native aliases and unknown legacy origins, bounds both reads", async () => {
    const f = setup();
    const scope = { actorPublicId: "actor", modules: ["formalizacion" as const], broadModules: [], start: input.start, end: input.end };
    try {
        const legacy = new LegacyCalendarReader({ isConfigured: () => true } as never);
        await f.repo.read(async (tx) => {
            await f.repo.list(tx, scope);
            await legacy.list(tx, scope);
        });
        const native = f.queries.find((query) => query.sql.includes("FROM crm_calendar_event e JOIN"));
        const old = f.queries.find((query) => query.sql.includes("crm_calendar_event_context"));
        if (!native || !old) throw new Error("Missing native/legacy query");
        expect(native.sql).toContain("LIMIT 501");
        expect(native.sql).toContain("starts_at_calendar_event < ?");
        expect(native.sql).toContain("ends_at_calendar_event > ?");
        expect(native.sql).toContain("crm_calendar_participant");
        expect(native.parameters).toContain("actor");
        expect(native.parameters).toContain("2026-10-28 14:00:00.000");
        expect(native.sql).toContain("'%f'");
        expect(old.sql).toContain("crm_calendar_event_context");
        expect(old.sql).toContain("NOT EXISTS");
        expect(old.sql).toContain("legacy_calendar_id_calendar_event");
        expect(old.sql).toContain("LIMIT 501");
        expect(old.sql).not.toContain("fechaIni_calendar");
    } finally {
        await f.db.destroy();
    }
});
it("loads a moved Outlook match outside the stored date while retaining the native ACL", async () => {
    const f = setup();
    try {
        await f.repo.read((tx) => f.repo.list(tx, { actorPublicId: "actor", modules: ["formalizacion"], broadModules: [], start: input.start, end: input.end, externalEventIds: [id], excludedInviteModules: ["ventas"] }));
        const query = f.queries.find((entry) => entry.sql.includes("FROM crm_calendar_event e JOIN"));
        expect(query?.sql).toContain("OR e.public_id_calendar_event IN (?)");
        expect(query?.sql).toContain("u.public_id_user=?");
        expect(query?.sql).toContain("o.code_org_unit NOT IN (?)");
        expect(query?.parameters).toEqual(expect.arrayContaining([id, "actor", "formalizacion", "ventas"]));
    } finally {
        await f.db.destroy();
    }
});

it("validates ACL inside transaction before new writes", async () => {
    const f = setup();
    try {
        const validate = vi.fn().mockImplementation(() => {
            expect(f.steps).toEqual(["begin"]);
            throw new Error("ACL denied");
        });
        await expect(f.repo.save("actor", input, false, undefined, validate)).rejects.toThrow("ACL denied");
        expect(validate).toHaveBeenCalledOnce();
        expect(f.steps).toEqual(["begin", "rollback"]);
        expect(f.audit.append).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
it("keeps invited origin deny separate from selected module scope", async () => {
    const f = setup();
    try {
        await f.repo.read((tx) => f.repo.list(tx, { actorPublicId: "actor", modules: ["formalizacion"], broadModules: [], excludedInviteModules: ["ventas"], start: input.start, end: input.end }));
        const query = f.queries[0];
        if (!query) throw new Error("Missing query");
        expect(query.sql).toContain("o.code_org_unit NOT IN (?)");
        expect(query.sql).toContain("OR (");
        expect(query.parameters).toContain("ventas");
        expect(query.sql).toContain("u.display_name_user");
        expect(query.sql).not.toContain("pu.display_name_user");
    } finally {
        await f.db.destroy();
    }
});
it("rolls back supplied relations along with the event when audit fails", async () => {
    const f = setup({ auditFailure: true });
    try {
        await expect(f.repo.save("actor", { ...input, participants: [{ email: "guest@example.com" }], links: [{ entityType: "lead", source: "legacy", id: "123" }] }, false)).rejects.toThrow("audit failure");
        expect(f.queries.some((query) => query.sql.includes("insert into `crm_calendar_participant`"))).toBe(true);
        expect(f.queries.some((query) => query.sql.includes("INSERT INTO crm_calendar_event_link"))).toBe(true);
        expect(f.steps.at(-1)).toBe("rollback");
        expect(f.steps).not.toContain("commit");
    } finally {
        await f.db.destroy();
    }
});

it("recognized replay rechecks event authorization without validating changed target eligibility", async () => {
    const f = setup({ replay: true });
    const validate = vi.fn().mockRejectedValue(new Error("target changed"));
    try {
        await expect(f.repo.save("actor", input, false, undefined, validate)).resolves.toMatchObject({ id });
        expect(validate).not.toHaveBeenCalled();
        expect(f.steps).not.toContain("write");
    } finally {
        await f.db.destroy();
    }
});

it("resolves a normalized registered email to native participant identity", async () => {
    const f = setup({ emailUser: true });
    try {
        await f.repo.save("actor", { ...input, participants: [{ email: "  GUEST@EXAMPLE.COM  " }] }, false);
        const lookup = f.queries.find((q) => q.sql.includes("normalized_email_user"));
        expect(lookup?.parameters).toContain("guest@example.com");
        const insert = f.queries.find((q) => q.sql.includes("insert into `crm_calendar_participant`"));
        expect(insert?.parameters).toContain(9);
        expect(insert?.parameters).not.toContain("guest@example.com");
    } finally {
        await f.db.destroy();
    }
});
it("deduplicates the same native user supplied by public ID and registered email", async () => {
    const f = setup({ emailUser: true });
    try {
        await f.repo.save("actor", { ...input, participants: [{ userId: id }, { email: "guest@example.com" }] }, false);
        expect(f.queries.filter((q) => q.sql.includes("insert into `crm_calendar_participant`"))).toHaveLength(1);
        expect(f.steps.at(-1)).toBe("commit");
        expect(f.audit.append).toHaveBeenCalledOnce();
    } finally {
        await f.db.destroy();
    }
});

it("preserves active invitation response and delivery bits when canonical duplicates are submitted", async () => {
    const f = setup({ emailUser: true, participantRows: [{ id_calendar_participant: 41, user_id_calendar_participant: 9, external_email_calendar_participant: null, status_calendar_participant: "active", revoked_at_calendar_participant: null, response_calendar_participant: "accepted", responded_at_calendar_participant: "2026-10-29 10:00:00", response_version_calendar_participant: 2, invitation_sent_at_calendar_participant: "2026-10-28 10:00:00" }] });
    try {
        await f.repo.save("actor", { ...input, participants: [{ email: " GUEST@EXAMPLE.COM " }, { userId: id }] }, false);
        expect(f.queries.filter((q) => /^(insert into|update) `crm_calendar_participant`/.test(q.sql))).toHaveLength(0);
        expect(f.steps.at(-1)).toBe("commit");
    } finally {
        await f.db.destroy();
    }
});
it("deduplicates normalized external emails", async () => {
    const f = setup();
    try {
        await f.repo.save("actor", { ...input, participants: [{ email: " GUEST@EXAMPLE.COM " }, { email: "guest@example.com" }] }, false);
        expect(f.queries.filter((q) => q.sql.includes("insert into `crm_calendar_participant`"))).toHaveLength(1);
    } finally {
        await f.db.destroy();
    }
});
it("rejects another organizer even with a broad update scope", async () => {
    const f = setup({ before: { ownerPublicId: "other" } });
    try {
        await expect(f.repo.save("actor", { ...input, expectedVersion: 2 }, false, id)).rejects.toMatchObject({ status: 403 });
        expect(f.steps).not.toContain("write");
    } finally {
        await f.db.destroy();
    }
});

it("updates only lifecycle fields and sync intent when cancelling, retaining all business relations", async () => {
    const f = setup();
    try {
        await f.repo.save("actor", { ...input, expectedVersion: 2 }, true, id, undefined, { status: "cancelled", expectedStatus: "scheduled", reason: "Cambio de agenda" });
        const update = f.queries.find((q) => q.sql.startsWith("update `crm_calendar_event`"));
        expect(update?.sql).toContain("`status_calendar_event`");
        expect(update?.sql).not.toContain("`title_calendar_event`");
        expect(update?.parameters).toContain("Cambio de agenda");
        expect(update?.parameters).toContain(3);
        expect(f.queries.find((q) => q.sql.startsWith("update `int_calendar_event_sync`"))?.parameters).toContain("absent");
        expect(f.steps.at(-1)).toBe("commit");
        expect(f.audit.append).toHaveBeenCalledTimes(1);
    } finally {
        await f.db.destroy();
    }
});
it("rejects a mismatched lifecycle state before writes", async () => {
    const f = setup();
    try {
        await expect(f.repo.save("actor", { ...input, expectedVersion: 2 }, true, id, undefined, { status: "scheduled", expectedStatus: "cancelled" })).rejects.toThrow("estado");
        expect(f.steps).toEqual(["begin", "rollback"]);
    } finally {
        await f.db.destroy();
    }
});
