import { ConflictException } from "@nestjs/common";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import { createNoteSchema, type NoteRecord, placementSchema } from "../../src/modules/crm/notes/notes.contract.js";
import { noteContextKey, NotesRepository } from "../../src/modules/crm/notes/notes.repository.js";
const access = { actorPublicId: "actor", moduleCode: "ventas" as const, ownOnly: false };
const input = createNoteSchema.parse({ moduleCode: "ventas", operationId: "operation_123456", text: "private '); DROP TABLE crm_note; --" });
const original: NoteRecord = { internalId: 8, publicId: "01M4VECV87Y3Q3TGBBK8X2MHYX", authorId: 7, authorPublicId: "actor", authorName: "Actor", moduleCode: "ventas", title: null, text: input.text, color: "#FFFF88", priority: "normal", status: "open", visibility: "private", version: 1, createdAt: "now", updatedAt: "now", completedAt: null, archivedAt: null };
function fixture(options: { failure?: string; note?: Partial<NoteRecord>; context?: object[]; enabled?: boolean; system?: boolean } = {}) {
    const queries: CompiledQuery[] = [];
    const lifecycle: string[] = [];
    let receipt: object[] = [];
    let note = { ...original, ...options.note };
    function readRows(query: CompiledQuery): object[] {
        if (query.sql.startsWith("SELECT id_external_system AS id")) return options.system === false ? [] : [{ id: 3 }];
        if (query.sql.startsWith("SELECT id_user AS id")) return [{ id: 7 }];
        if (query.sql.startsWith("SELECT n.id_note")) return [note];
        if (query.sql.startsWith("SELECT l.target_kind")) return options.context ?? [{ kind: "view", entity: "view", viewCode: "ventas.home", orderId: null, primary: 1, key: noteContextKey("ventas", { kind: "view" }) }];
        if (query.sql.startsWith("SELECT request_hash")) return receipt;
        return [];
    }
    class Driver extends DummyDriver {
        override beginTransaction() {
            lifecycle.push("begin");
            return Promise.resolve();
        }
        override commitTransaction() {
            lifecycle.push("commit");
            return Promise.resolve();
        }
        override rollbackTransaction() {
            lifecycle.push("rollback");
            return Promise.resolve();
        }
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                if (options.failure && query.sql.startsWith(options.failure)) return Promise.reject(new Error("write failed"));
                const rows = readRows(query);
                if (query.sql.startsWith("INSERT INTO crm_note (")) note = { ...note, publicId: String(query.parameters[0]) };
                if (query.sql.startsWith("INSERT INTO int_note_command")) receipt = [{ hash: query.parameters[2], result: query.parameters[3] }];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const audit = { enabled: options.enabled ?? true, captureActor: vi.fn().mockResolvedValue({ publicId: "actor", name: "Actor", roles: [] }), append: vi.fn().mockResolvedValue({}) };
    const realtime = { enqueueNoteChange: vi.fn().mockResolvedValue(undefined) };
    const repository = new NotesRepository({ db } as DatabaseService, audit as unknown as RecordAuditService, realtime as never);
    return { db, repository, audit, realtime, queries, lifecycle };
}
describe("notes repository transactions", () => {
    it("self scope retains explicit participant ACL instead of requiring global access", async () => {
        const f = fixture();
        await f.repository.find({ ...access, ownOnly: true }, original.publicId);
        const query = f.queries.find((q) => q.sql.startsWith("SELECT n.id_note"));
        expect(query?.sql).toContain("n.visibility_note='shared'");
        expect(query?.sql).toContain("p.status_note_participant='active'");
        expect(query?.parameters.some((p) => typeof p === "boolean")).toBe(false);
        await f.db.destroy();
    });
    it("commits audit, two reference deliveries and a receipt; identical retries replay", async () => {
        const f = fixture();
        const result = await f.repository.create(access, input, input.context);
        expect(await f.repository.create(access, input, input.context)).toEqual({ ...result, replayed: true });
        expect(f.lifecycle).toEqual(["begin", "commit", "begin", "commit"]);
        expect(f.audit.append).toHaveBeenCalledOnce();
        expect(f.realtime.enqueueNoteChange).toHaveBeenCalledOnce();
        expect(f.realtime.enqueueNoteChange).toHaveBeenCalledWith(expect.anything(), { noteId: result.noteId, actorPublicId: access.actorPublicId });
        expect(f.queries.filter((q) => q.sql.startsWith("INSERT INTO int_event_outbox"))).toHaveLength(2);
        expect(JSON.stringify(f.audit.append.mock.calls)).not.toContain(input.text);
        const insert = f.queries.find((q) => q.sql.startsWith("INSERT INTO crm_note ("));
        expect(insert?.sql).not.toContain(input.text);
        expect(insert?.parameters).toContain(input.text);
        await expect(f.repository.create(access, { ...input, text: "different" }, input.context)).rejects.toThrow("clave de operacion");
        await f.db.destroy();
    });
    it.each(["audit", "INSERT INTO int_event_outbox", "INSERT INTO int_note_command"])("rolls back when %s fails", async (failure) => {
        const f = fixture({ failure });
        if (failure === "audit") f.audit.append.mockRejectedValue(new Error("write failed"));
        await expect(f.repository.create(access, input, input.context)).rejects.toThrow("write failed");
        expect(f.lifecycle).toEqual(["begin", "rollback"]);
        await f.db.destroy();
    });
    it.each([
        { status: "archived" as const, version: 1 },
        { status: "open" as const, version: 2 },
    ])("rejects archived or stale lifecycle changes before writes: %j", async (note) => {
        const f = fixture({ note });
        await expect(f.repository.lifecycle(access, original.publicId, { moduleCode: "ventas", operationId: input.operationId, expectedVersion: 1 }, "complete")).rejects.toThrow(ConflictException);
        expect(f.audit.append).not.toHaveBeenCalled();
        expect(f.lifecycle).toEqual(["begin", "rollback"]);
        await f.db.destroy();
    });
    it("rejects a nonauthor even when a privileged accessor exposes the note", async () => {
        const f = fixture({ note: { authorPublicId: "other" } });
        await expect(f.repository.lifecycle(access, original.publicId, { moduleCode: "ventas", operationId: input.operationId, expectedVersion: 1 }, "archive")).rejects.toThrow("Solo el autor");
        expect(f.audit.append).not.toHaveBeenCalled();
        await f.db.destroy();
    });
    it("keeps personal layout separate from note version, content and deliveries", async () => {
        const f = fixture();
        const placement = placementSchema.parse({ moduleCode: "ventas", operationId: input.operationId, expectedLayoutVersion: 0, x: 1, y: 2, width: 200, height: 100 });
        expect(await f.repository.move(access, original.publicId, placement)).toMatchObject({ version: 1, layoutVersion: 1 });
        expect(f.queries.some((q) => q.sql.startsWith("UPDATE crm_note SET") || q.sql.startsWith("INSERT INTO int_event_outbox"))).toBe(false);
        expect(f.audit.append.mock.calls[0]?.[1]).toMatchObject({ source: { entity: "note_placement" } });
        await f.db.destroy();
    });
    it.each([
        { context: [] },
        { context: [{ kind: "legacy", entity: "sales_order", primary: 1 }] },
        {
            context: [
                { kind: "view", entity: "view", viewCode: "ventas.home", primary: 1 },
                { kind: "view", entity: "view", viewCode: "ventas.home", primary: 1 },
            ],
        },
    ])("fails closed for unsupported context %j", async ({ context }) => {
        const f = fixture({ context });
        await expect(f.repository.move(access, original.publicId, placementSchema.parse({ moduleCode: "ventas", operationId: input.operationId, expectedLayoutVersion: 0, x: 1, y: 2, width: 200, height: 100 }))).rejects.toThrow("Contexto");
        expect(f.audit.append).not.toHaveBeenCalled();
        await f.db.destroy();
    });
    it("rejects corrupt native links whose persisted identity is missing", async () => {
        const f = fixture({ note: { moduleCode: "formalizacion" }, context: [{ kind: "native", entity: "sales_order", viewCode: null, orderId: null, primary: 1 }] });
        await expect(f.repository.context({ ...original, moduleCode: "formalizacion" })).rejects.toThrow("Contexto");
        const query = f.queries[0];
        expect(query?.sql).not.toContain("o.status_sales_order");
        await f.db.destroy();
    });
    it("requires central audit before starting a transaction", async () => {
        const f = fixture({ enabled: false });
        await expect(f.repository.create(access, input, input.context)).rejects.toThrow("auditoria");
        expect(f.lifecycle).toEqual([]);
        await f.db.destroy();
    });
});

describe("native-only optional context persistence", () => {
    it.each([{ kind: "personal" as const }, { kind: "view" as const, code: "catalog-projects" }])("stores registered personal or view context without business mutation: %j", async (context) => {
        const f = fixture();
        await f.repository.create(access, { ...input, context }, context);
        const link = f.queries.find((q) => q.sql.startsWith("INSERT INTO crm_note_link"));
        expect(link?.parameters).toContain(context.kind === "personal" ? "ventas.personal" : "catalog-projects");
        expect(f.queries.some((q) => /^(INSERT INTO|UPDATE) crm_sales_order/.test(q.sql))).toBe(false);
        await f.db.destroy();
    });
    it("stores only a source-qualified legacy link and never a business copy", async () => {
        const f = fixture({ note: { moduleCode: "formalizacion" } });
        const context = { kind: "sales_order" as const, source: "legacy" as const, id: "208" };
        await f.repository.create({ ...access, moduleCode: "formalizacion" }, { ...input, moduleCode: "formalizacion", context }, context);
        const link = f.queries.find((q) => q.sql.startsWith("INSERT INTO crm_note_link"));
        expect(link?.parameters).toEqual([8, noteContextKey("formalizacion", context), "external", "sales_order", null, null, 3, "208"]);
        expect(f.queries.some((q) => q.sql.includes("crmdatabase-api") || /^(INSERT INTO|UPDATE) crm_sales_order/.test(q.sql))).toBe(false);
        await f.db.destroy();
    });
    it("rolls back when the approved legacy system is unavailable", async () => {
        const f = fixture({ system: false, note: { moduleCode: "formalizacion" } });
        const context = { kind: "sales_order" as const, source: "legacy" as const, id: "208" };
        await expect(f.repository.create({ ...access, moduleCode: "formalizacion" }, { ...input, moduleCode: "formalizacion", context }, context)).rejects.toThrow("Sistema de origen");
        expect(f.lifecycle).toEqual(["begin", "rollback"]);
        expect(f.audit.append).not.toHaveBeenCalled();
        await f.db.destroy();
    });
    it.each([
        { kind: "view", entity: "view", viewCode: "ventas.personal", key: noteContextKey("ventas", { kind: "personal" }), primary: 1 },
        { kind: "external", entity: "sales_order", externalId: "208", system: "legacy_crm", key: noteContextKey("formalizacion", { kind: "sales_order", source: "legacy", id: "208" }), primary: 1 },
    ])("reconstructs a registered canonical persisted context: %j", async (context) => {
        const moduleCode = context.kind === "external" ? "formalizacion" : "ventas";
        const f = fixture({ context: [context] });
        expect(await f.repository.context({ ...original, moduleCode })).toEqual(context.kind === "external" ? { kind: "sales_order", source: "legacy", id: "208" } : { kind: "personal" });
        expect(f.queries.find((query) => query.sql.includes("FROM crm_note_link"))?.sql).toContain("AS `system`");
        await f.db.destroy();
    });
    it("rejects forged context keys and unregistered persisted views", async () => {
        for (const row of [
            { kind: "view", entity: "view", viewCode: "ventas.home", key: "forged", primary: 1 },
            { kind: "view", entity: "view", viewCode: "unregistered", key: "forged", primary: 1 },
        ]) {
            const f = fixture({ context: [row] });
            await expect(f.repository.context(original)).rejects.toThrow("Contexto");
            await f.db.destroy();
        }
    });
});

describe("source-qualified context keys and listing", () => {
    it("keeps native, legacy, personal and view identities distinct", () => {
        const keys = [noteContextKey("formalizacion", { kind: "sales_order", source: "legacy", id: "208" }), noteContextKey("formalizacion", { kind: "sales_order", source: "native", id: original.publicId }), noteContextKey("formalizacion", { kind: "personal" }), noteContextKey("formalizacion", { kind: "view" })];
        expect(new Set(keys).size).toBe(4);
    });
    it("filters legacy lists by active system, external id, single primary context and note ACL", async () => {
        const f = fixture();
        const context = { kind: "sales_order" as const, source: "legacy" as const, id: "208" };
        await f.repository.list({ ...access, moduleCode: "formalizacion" }, { moduleCode: "formalizacion", contextType: "sales_order", recordSource: "legacy", recordId: "208", status: "open", page: 1, pageSize: 25 }, context);
        const count = f.queries.find((query) => query.sql.startsWith("SELECT COUNT(*) AS total FROM crm_note"));
        expect(count?.sql).toContain("l.target_kind_note_link='external'");
        expect(count?.sql).toContain("code_external_system='legacy_crm' AND status_external_system='active'");
        expect(count?.sql).toContain("crm_note_participant");
        expect(count?.sql).toContain("l.is_primary_note_link=1");
        expect(count?.parameters).toContain("208");
        expect(count?.parameters).toContain(noteContextKey("formalizacion", context));
        await f.db.destroy();
    });
});

it("realtime intent failure rolls back note body before the receipt commits", async () => {
    const f = fixture();
    f.realtime.enqueueNoteChange.mockRejectedValue(new Error("realtime failed"));
    await expect(f.repository.create(access, input, input.context)).rejects.toThrow("realtime failed");
    expect(f.lifecycle).toEqual(["begin", "rollback"]);
    expect(f.queries.some((q) => q.sql.startsWith("INSERT INTO int_note_command"))).toBe(false);
    await f.db.destroy();
});
it("layout updates never publish conversation changes", async () => {
    const f = fixture();
    await f.repository.move(access, original.publicId, placementSchema.parse({ moduleCode: "ventas", operationId: input.operationId, expectedLayoutVersion: 0, viewportClass: "desktop", anchorMode: "viewport", x: 0, y: 0, width: 300, height: 240, collapsed: false, hidden: false }));
    expect(f.realtime.enqueueNoteChange).not.toHaveBeenCalled();
    await f.db.destroy();
});

it.each(["native", "legacy"] as const)("reconstructs persisted %s identity without lifecycle filters so resource denial can redact it", async (source) => {
    const context = source === "native" ? { kind: "sales_order" as const, source, id: original.publicId } : { kind: "sales_order" as const, source, id: "208" };
    const f = fixture({ context: [{ kind: source === "native" ? "native" : "external", entity: "sales_order", viewCode: null, orderId: source === "native" ? original.publicId : null, externalId: source === "legacy" ? "208" : null, system: source === "legacy" ? "legacy_crm" : null, primary: 1, key: noteContextKey("formalizacion", context) }] });
    expect(await f.repository.context({ ...original, moduleCode: "formalizacion" })).toEqual(context);
    const query = f.queries.find((q) => q.sql.startsWith("SELECT l.target_kind"));
    expect(query?.sql).not.toMatch(/status_sales_order|cancelled_sales_order|deleted_at_sales_order|status_external_system/);
    await f.db.destroy();
});

it("matches source-qualified order links across permitted origins while retaining invitation ACL", async () => {
    const f = fixture();
    await f.repository.list(access, { moduleCode: "ventas", status: "all", page: 1, pageSize: 20, contextType: "sales_order" }, { kind: "sales_order", source: "legacy", id: "208" }, ["ventas", "formalizacion"]);
    const query = f.queries.find((q) => q.sql.startsWith("SELECT COUNT(*)"));
    expect(query?.sql).toContain("n.origin_module_code_note IN");
    expect(query?.parameters).toContain("formalizacion");
    expect(query?.sql).toContain("crm_note_participant");
    expect(query?.sql).toContain("external_system_id_note_link");
    expect(query?.parameters).toContain("208");
    await f.db.destroy();
});

it("keeps private reminder audit entries actor-bound on the original history endpoint", async () => {
    const f = fixture();
    await f.repository.history(original, "reader");
    const query = f.queries.find((q) => q.sql.startsWith("SELECT e.id_record_event"));
    expect(query?.sql).toContain("JSON_CONTAINS_PATH");
    expect(query?.sql).toContain("$.remindAt");
    expect(query?.parameters).toContain("reader");
    await f.db.destroy();
});
