import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { AuditQueryDto, decodeAuditCursor, encodeAuditCursor } from "../../src/modules/crm/audit/audit-read.contract.js";
import { AuditReadRepository } from "../../src/modules/crm/audit/audit-read.repository.js";
import { AuditReadService } from "../../src/modules/crm/audit/audit-read.service.js";
import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";

it("requires module and section, caps batch size and binds cursor to scope", async () => {
    expect(await validate(plainToInstance(AuditQueryDto, {}))).not.toHaveLength(0);
    expect(await validate(plainToInstance(AuditQueryDto, { moduleCode: "administration", sectionCode: "catalogs", limit: 201 }))).not.toHaveLength(0);
    const query = { moduleCode: "administration", sectionCode: "catalogs", limit: 10 };
    const cursor = encodeAuditCursor(query, 42);
    expect(decodeAuditCursor({ ...query, cursor })).toBe(42);
    expect(() => decodeAuditCursor({ ...query, sectionCode: "users", cursor })).toThrow();
});
describe("audit read authorization", () => {
    it("returns the same safe historical context on list/detail without snapshots on the list", async () => {
        const publicId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
        const row = { id: 3, publicId, eventType: "catalog_item_updated", summary: "Changed", reason: "Authorized", actorName: "Historic actor", actorRoles: JSON.stringify([{ code: "manager", name: "Gerencia anterior", token: "secret" }]), recordedModule: "administration", recordedSection: "catalogs", catalogCode: "projects", recordVersion: 1, recordId: "deleted-record", recordEntity: "catalog", recordName: "Nombre histórico", recordAction: "update", createdAt: "2026-10-13T12:00:00Z" };
        const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles: [{ code: "owner", status: "active" }], permissions: [] }) };
        const repository = { list: vi.fn().mockResolvedValue([row]), detail: vi.fn().mockResolvedValue({ ...row, changeSet: null }) };
        const service = new AuditReadService(identity as unknown as IdentityService, repository as unknown as AuditReadRepository);
        const item = (await service.list("cookie", { moduleCode: "administration", sectionCode: "catalogs", limit: 10 })).items[0];
        const detail = await service.detail("cookie", publicId);
        for (const event of [item, detail]) {
            expect(event).toMatchObject({ actorRoles: [{ code: "manager", name: "Gerencia anterior" }], moduleName: "Administración", sectionName: "Catálogos", catalogName: "Proyectos", record: { id: "deleted-record", entity: "catalog", name: "Nombre histórico" }, action: "update", actionLabel: "Edición" });
            expect(JSON.stringify(event)).not.toContain("secret");
        }
        expect(item).not.toHaveProperty("changeSet");
        expect(item).not.toHaveProperty("recordVersion");
    });
    it("never guesses historical roles, location or record names from current joins/filter", async () => {
        const row = { id: 3, publicId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", eventType: "user_updated", summary: "Updated", actorName: "Current actor", targetName: "Renamed user", targetPublicId: "canonical-user", recordedModule: null, catalogCode: null, createdAt: "2026-10-13T12:00:00Z" };
        const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles: [{ code: "owner", status: "active" }], permissions: [] }) };
        const repository = { list: vi.fn().mockResolvedValue([row]), detail: vi.fn().mockResolvedValue(row) };
        const service = new AuditReadService(identity as unknown as IdentityService, repository as unknown as AuditReadRepository);
        const event = (await service.list("cookie", { moduleCode: "administration", sectionCode: "users", limit: 10 })).items[0];
        expect(event).toMatchObject({ actorRoles: null, moduleName: null, sectionName: null, contextKnown: false, record: { id: "canonical-user", entity: "user", name: null } });
        repository.list.mockResolvedValueOnce([{ ...row, eventType: "catalog_item_updated", targetPublicId: null, legacyItemId: "historic-item" }]);
        expect((await service.list("cookie", { moduleCode: "administration", sectionCode: "catalogs", limit: 10 })).items[0]?.record).toEqual({ id: "historic-item", entity: "catalog", name: null });
        repository.list.mockResolvedValueOnce([{ ...row, eventType: "role_deleted", targetPublicId: null, legacyRoleCode: "deleted-role" }]);
        expect((await service.list("cookie", { moduleCode: "administration", sectionCode: "roles", limit: 10 })).items[0]?.record).toEqual({ id: "deleted-role", entity: "role", name: null });
    });
    it("does not confuse an assigned historical role with the created user's identity", async () => {
        const row = { id: 3, publicId: "event", eventType: "user_created", summary: "Created", legacyRoleCode: "owner", legacyItemId: "unrelated", targetPublicId: "canonical-user", createdAt: "2026-10-13T12:00:00Z" };
        const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles: [{ code: "owner", status: "active" }], permissions: [] }) };
        const service = new AuditReadService(identity as unknown as IdentityService, { list: vi.fn().mockResolvedValue([row]) } as unknown as AuditReadRepository);
        expect((await service.list("cookie", { moduleCode: "administration", sectionCode: "users", limit: 10 })).items[0]?.record).toEqual({ id: "canonical-user", entity: "user", name: null });
    });
    it.each([null, "{invalid", { version: 2 }, { version: 1, entity: 10, recordId: "record", action: "update", before: null, after: null, changes: [] }])("does not fabricate comparisons for malformed snapshots %j", async (changeSet) => {
        const detail = vi.fn().mockResolvedValue({ publicId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", createdAt: "2026-10-13T12:00:00Z", changeSet });
        const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles: [], permissions: [{ code: "role.assign", effect: "allow" }] }) };
        const service = new AuditReadService(identity as unknown as IdentityService, { detail } as unknown as AuditReadRepository);
        expect((await service.detail("cookie", "01ARZ3NDEKTSV4RRFFQ69G5FAV")).changeSet).toBeNull();
    });
    it.each([false, true])("rebuilds a safe comparison from object/string snapshots (%s)", async (asString) => {
        const changeSet = { version: 1, entity: "catalog", recordId: "record", action: "update", before: { name: "A", password: "secret" }, after: { name: "B", externalReferences: [{ systemCode: "odoo", externalId: "2", token: "secret" }] }, changes: [{ field: "password", before: "secret", after: "secret" }] };
        const detail = vi.fn().mockResolvedValue({ publicId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", createdAt: "2026-10-13T12:00:00Z", changeSet: asString ? JSON.stringify(changeSet) : changeSet });
        const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles: [{ code: "owner", status: "active" }], permissions: [] }) };
        const service = new AuditReadService(identity as unknown as IdentityService, { detail } as unknown as AuditReadRepository);
        const result = await service.detail("cookie", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
        expect(result.changeSet?.changes).toContainEqual({ field: "name", before: "A", after: "B" });
        expect(JSON.stringify(result)).not.toMatch(/secret|password|token/);
    });
    it("loads a safe detail, validates IDs and preserves historical absence", async () => {
        const publicId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
        const changeSet = { version: 1, entity: "user", recordId: publicId, action: "update", before: { name: "Antes", password: "secret" }, after: { name: "Después" }, changes: [{ field: "name", before: "Antes", after: "Después" }] };
        const detail = vi.fn().mockResolvedValue({ publicId, eventType: "user_updated", summary: "Updated", reason: null, actorName: "Owner", targetName: null, createdAt: "2026-10-13T12:00:00Z", changeSet, metadata: { token: "secret" }, ip: "private" });
        const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles: [{ code: "owner", status: "active" }], permissions: [] }) };
        const service = new AuditReadService(identity as unknown as IdentityService, { detail } as unknown as AuditReadRepository);
        const result = await service.detail("cookie", publicId);
        expect(result.changeSet?.changes).toEqual(changeSet.changes);
        expect(JSON.stringify(result)).not.toMatch(/secret|password|metadata|private/);
        await expect(service.detail("cookie", "invalid")).rejects.toThrow();
        expect(detail).toHaveBeenCalledTimes(1);
        detail.mockResolvedValueOnce({ publicId, createdAt: "2026-10-13T12:00:00Z", changeSet: null });
        expect((await service.detail("cookie", publicId)).changeSet).toBeNull();
        detail.mockResolvedValueOnce(undefined);
        await expect(service.detail("cookie", publicId)).rejects.toThrow("Evento no encontrado");
        identity.getCurrentUser.mockResolvedValueOnce({ roles: [], permissions: [] });
        await expect(service.detail("cookie", publicId)).rejects.toThrow("Permiso");
        expect(detail).toHaveBeenCalledTimes(3);
    });
    it("returns a bounded look-ahead cursor without exposing internal IDs", async () => {
        const row = { id: 3, publicId: "public", eventType: "user_updated", summary: "Updated", createdAt: "2026-10-13T12:00:00Z", recordedModule: null, catalogCode: null };
        const list = vi.fn().mockResolvedValue([row, { ...row, id: 2 }, { ...row, id: 1 }]);
        const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles: [{ code: "owner", status: "active" }], permissions: [] }) };
        const service = new AuditReadService(identity as unknown as IdentityService, { list } as unknown as AuditReadRepository);
        const query = { moduleCode: "administration", sectionCode: "users", limit: 2 };
        const result = await service.list("cookie", query);
        expect(result.items).toHaveLength(2);
        expect(result.items[0]).not.toHaveProperty("id");
        expect(result.pagination.hasNext).toBe(true);
        expect(decodeAuditCursor({ ...query, cursor: result.pagination.nextCursor ?? "" })).toBe(2);
    });
    it("rejects before querying the audit repository", async () => {
        const list = vi.fn();
        const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles: [], permissions: [] }) };
        const service = new AuditReadService(identity as unknown as IdentityService, { list } as unknown as AuditReadRepository);
        await expect(service.list("cookie", { moduleCode: "administration", sectionCode: "users", limit: 10 })).rejects.toThrow("Permiso");
        expect(list).not.toHaveBeenCalled();
        await expect(service.options("cookie")).rejects.toThrow("Permiso");
    });
    it("does not query events for choices and validates module/section combinations", async () => {
        const list = vi.fn().mockResolvedValue([]);
        const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles: [{ code: "owner", status: "active" }], permissions: [] }) };
        const service = new AuditReadService(identity as unknown as IdentityService, { list } as unknown as AuditReadRepository);
        expect((await service.options("cookie")).modules[0].code).toBe("administration");
        expect(list).not.toHaveBeenCalled();
        await expect(service.list("cookie", { moduleCode: "ventas", sectionCode: "users", limit: 10 })).rejects.toThrow();
        expect(list).not.toHaveBeenCalled();
    });
    it("supports existing role.assign access and marks missing catalog context explicitly", async () => {
        const list = vi.fn().mockResolvedValue([{ id: 2, publicId: "event", eventType: "catalog_item_updated", summary: "Changed", createdAt: "2026-10-13T12:00:00Z", recordedModule: null, catalogCode: "projects" }]);
        const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles: [], permissions: [{ code: "role.assign", effect: "allow" }] }) };
        const service = new AuditReadService(identity as unknown as IdentityService, { list } as unknown as AuditReadRepository);
        const result = await service.list("cookie", { moduleCode: "administration", sectionCode: "catalogs", limit: 10 });
        expect(result.items[0]?.contextKnown).toBe(false);
        expect(list).toHaveBeenCalledTimes(1);
    });
});

it("uses parameterized scope predicates, a bounded indexed seek and no count/offset query", async () => {
    const queries: CompiledQuery[] = [];
    class RecordingDriver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                return Promise.resolve({ rows: [] });
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({
        dialect: {
            createDriver: () => new RecordingDriver(),
            createAdapter: () => new MysqlAdapter(),
            createIntrospector: (database) => new MysqlIntrospector(database),
            createQueryCompiler: () => new MysqlQueryCompiler(),
        },
    });
    const repository = new AuditReadRepository({ db } as DatabaseService);
    await repository.list({ moduleCode: "administration", sectionCode: "catalogs", catalogCode: "projects", search: "x%' OR 1=1", limit: 10 }, 42);
    expect(queries).toHaveLength(1);
    const query = queries[0];
    if (!query) throw new Error("Missing audit query");
    expect(query.sql).toMatch(/^select/i);
    expect(query.sql).toContain("MAX_EXECUTION_TIME(1500)");
    expect(query.sql).toContain("order by `e`.`id_security_event` desc");
    expect(query.sql).not.toMatch(/offset|count\(/i);
    expect(query.sql).not.toContain("OR 1=1");
    expect(query.parameters).toEqual(expect.arrayContaining(["projects", "administration", 42, "x%' OR 1=1", 11]));
    expect(query.sql).toContain("is null");
    const nullableModule = "NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.metadata_security_event, '$.moduleCode')), 'null')";
    const nullableCatalog = "NULLIF(JSON_UNQUOTE(JSON_EXTRACT(e.metadata_security_event, '$.catalogCode')), 'null')";
    expect(query.sql).toContain(`${nullableModule} as \`recordedModule\``);
    expect(query.sql).toContain(`${nullableModule} is null`);
    expect(query.sql).toContain(`${nullableCatalog} as \`catalogCode\``);
    expect(query.sql).toContain(`${nullableCatalog} in (?)`);
    const historicalActor = "case when JSON_TYPE(JSON_EXTRACT(e.metadata_security_event, '$.actor.name')) = 'STRING' then JSON_UNQUOTE(JSON_EXTRACT(e.metadata_security_event, '$.actor.name')) else `actor`.`display_name_user` end";
    expect(query.sql).toContain(`${historicalActor} as \`actorName\``);
    expect(query.sql).toContain(`LOCATE(?, ${historicalActor})`);
    expect(query.sql).not.toContain("LOCATE(?, `actor`.`display_name_user`)");
    await repository.list({ moduleCode: "administration", sectionCode: "audit", limit: 10 });
    expect(queries[1]?.parameters).toEqual(expect.arrayContaining(["logout", "unit_file_project_identity_prepared", 11]));
    expect(query.sql).not.toContain("'$.changeSet'");
    expect(query.sql).toContain("'$.actor.roles'");
    expect(query.sql).toContain("COALESCE(case when JSON_TYPE(JSON_EXTRACT(e.metadata_security_event, '$.actor.publicId')) = 'STRING'");
    expect(query.sql).toContain("`actor`.`public_id_user`) as `actorPublicId`");
    expect(query.sql).toContain("'$.changeSet.recordId'");
    expect(query.sql).toContain("'$.changeSet.after.name'");
    expect(query.sql).toContain("'$.sectionCode'");
    expect(query.sql).not.toMatch(/sec_user_role|sec_role/);
    await repository.list({ moduleCode: "administration", sectionCode: "roles", limit: 10 });
    const roleQuery = queries[2] as CompiledQuery;
    expect(roleQuery.sql).toMatch(/is null and.*event_type_security_event.*in/s);
    expect(roleQuery.parameters).toEqual(expect.arrayContaining(["administration", "roles"]));
    queries.pop();
    await repository.detail("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(queries[2]?.sql).toContain("JSON_EXTRACT(e.metadata_security_event, '$.changeSet')");
    expect(queries[2]?.sql).toContain("where `e`.`public_id_security_event` = ? limit ?");
    expect(queries[2]?.sql).not.toMatch(/ip_address|user_agent|select \*/i);
    expect(queries[2]?.parameters).toEqual(["01ARZ3NDEKTSV4RRFFQ69G5FAV", 1]);
    expect(queries[2]?.sql).toContain(`${historicalActor} as \`actorName\``);
    await db.destroy();
});
