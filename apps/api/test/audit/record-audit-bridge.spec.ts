import { ConfigService } from "@nestjs/config";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult, sql } from "kysely";
import { describe, expect, it } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { buildAuditChangeSet } from "../../src/modules/crm/audit/audit-change-set.js";
import { RecordAuditService } from "../../src/modules/crm/audit/record-audit.service.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { ProjectsRepository } from "../../src/modules/crm/projects/projects.repository.js";
import type { ProjectsLegacyAccess } from "../../src/modules/crm/projects/projects-legacy.port.js";

/** Transaction driver records proposed writes but never touches a database. */
const setup = (fail?: string) => {
    const queries: CompiledQuery[] = [];
    const committed: string[] = [];
    const lifecycle: string[] = [];
    let pending: string[] = [];
    let edited = false;
    const responses: [RegExp, () => unknown[]][] = [
        [/DATABASE\(\)/, () => [{ name: "CRM_THINK_V2" }]],
        [/conf_schema_migration/, () => [{ name: "202610220023_record_audit" }, { name: "202610220024_record_audit_identifier_collation" }]],
        [/^SELECT CAST/, () => [{ id: "42" }]],
        [/^select.*from `sec_user`/i, () => [{ id_user: 7, publicId: "actor", name: "Actor", status: "active", deleted: null }]],
        [/^SELECT.*FROM crm_project /i, () => [{ id: 42, publicId: "project", nativeCode: "project-code", name: edited ? "After" : "Before", detail: null, status: "active", updatedAt: "2026-10-22T12:00:00Z", legacyId: 901 }]],
        [/^select.*from `audit_record`/i, () => [{ id: "01AAAAAAAAAAAAAAAAAAAAAAAA" }]],
    ];
    class Driver extends DummyDriver {
        override beginTransaction() {
            lifecycle.push("begin");
            pending = [];
            return Promise.resolve();
        }
        override commitTransaction() {
            lifecycle.push("commit");
            committed.push(...pending);
            return Promise.resolve();
        }
        override rollbackTransaction() {
            lifecycle.push("rollback");
            pending = [];
            return Promise.resolve();
        }
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                if (fail && query.sql.includes(fail)) return Promise.reject(new Error("Injected writer failure"));
                if (/^(insert|update)/i.test(query.sql)) pending.push(query.sql);
                if (/^UPDATE crm_project SET name_project/.test(query.sql)) edited = true;
                const rows = responses.find(([pattern]) => pattern.test(query.sql))?.[1]() ?? [];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const database = { db } as DatabaseService;
    const records = new RecordAuditService(database, new ConfigService({ ENABLE_RECORD_AUDIT: true }));
    const security = new SecurityAuditService(database, records);
    return { db, database, records, security, queries, lifecycle, committed };
};

const bridgeTargets: { entity: string; catalogCode?: string; table: string }[] = [{ entity: "user", table: "sec_user" }, { entity: "role", table: "sec_role" }, ...Object.entries({ projects: "crm_project", campaigns: "crm_campaign", classes: "crm_class", locations: "crm_location", subsidiaries: "crm_subsidiary", brokers: "crm_broker", files: "crm_catalog_item" }).map(([catalogCode, table]) => ({ entity: "catalog", catalogCode, table }))];

describe("existing writers and central audit bridge", () => {
    it.each([undefined, "audit_record_event", "audit_security_event"])("native, legacy-port and audit proposed writes share one transaction: fail=%s", async (fail) => {
        const f = setup(fail);
        // Port double emits the same bounded legacy target as LegacyProjectsWriter, on tx only.
        const legacy: ProjectsLegacyAccess = {
            enabled: () => true,
            find: () => Promise.resolve(null),
            create: () => Promise.resolve(null),
            update: async (tx, id, payload) => {
                await sql`UPDATE \`crmdatabase-api\`.proyectos SET Nombre_proyecto=${payload.name} WHERE id_proyecto=${id}`.execute(tx);
            },
        };
        try {
            const operation = new ProjectsRepository(f.database, f.security, legacy).updateCatalogItem("project", { actorPublicId: "actor", name: "After", reason: "Change", catalogCode: "projects", externalReferences: [] });
            if (fail) {
                await expect(operation).rejects.toThrow("Injected writer failure");
                expect(f.lifecycle).toEqual(["begin", "rollback"]);
                expect(f.committed).toEqual([]);
            } else {
                expect((await operation)?.name).toBe("After");
                expect(f.lifecycle).toEqual(["begin", "commit"]);
                expect(f.committed.some((query) => query.includes("audit_record_event"))).toBe(true);
                expect(f.committed.some((query) => query.includes("audit_security_event"))).toBe(true);
                expect(f.committed.some((query) => query.includes("`crmdatabase-api`.proyectos"))).toBe(true);
            }
            expect(f.queries.some((query) => /^insert into `crm_sales_order`/.test(query.sql))).toBe(false);
        } finally {
            await f.db.destroy();
        }
    });

    it.each(bridgeTargets)("bridges $entity/$catalogCode to $table", async ({ entity, catalogCode, table }) => {
        const f = setup();
        try {
            await f.db.transaction().execute(async (tx) => {
                const actor = await f.security.captureActor(7, tx);
                const changeSet = buildAuditChangeSet({ entity, recordId: "record", action: "update", before: { name: "Before" }, after: { name: "After" } });
                await f.security.record({ eventType: "record_updated", summary: "Changed", actorSnapshot: actor, metadata: { changeSet, ...(catalogCode ? { catalogCode } : {}) } }, tx);
            });
            expect(f.queries.find((query) => /^insert into `audit_record_event`/i.test(query.sql))?.parameters).toContain(table);
            expect(f.queries.filter((query) => /^insert/i.test(query.sql))).toHaveLength(2);
        } finally {
            await f.db.destroy();
        }
    });

    it.each(["__proto__", "constructor", "unknown"])("rejects unknown catalog registry entries: %s", async (catalogCode) => {
        const f = setup();
        try {
            await expect(f.db.transaction().execute(async (tx) => f.security.record({ eventType: "catalog_item_updated", summary: "Changed", actorSnapshot: await f.security.captureActor(7, tx), metadata: { catalogCode, changeSet: buildAuditChangeSet({ entity: "catalog", recordId: "record", action: "update", before: { name: "Before" }, after: { name: "After" } }) } }, tx))).rejects.toThrow("Unsupported commercial audit entity");
            expect(f.committed).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });

    it("refuses standalone business events, forged changesets, and uncaptured actors", async () => {
        const f = setup();
        const changeSet = buildAuditChangeSet({ entity: "user", recordId: "user", action: "update", before: { name: "Before" }, after: { name: "After" } });
        try {
            await expect(f.security.record({ eventType: "user_updated", summary: "Changed", actorSnapshot: { publicId: "actor", name: "Actor", roles: [] }, metadata: { changeSet } })).rejects.toThrow("business transaction");
            await expect(f.db.transaction().execute(async (tx) => f.security.record({ eventType: "user_updated", summary: "Changed", actorSnapshot: await f.security.captureActor(7, tx), metadata: { changeSet: JSON.parse(JSON.stringify(changeSet)) } }, tx))).rejects.toThrow("server-built changeset");
            await expect(f.db.transaction().execute((tx) => f.security.record({ eventType: "user_updated", summary: "Changed", actorSnapshot: { publicId: "forged", name: "Forged", roles: [] }, metadata: { changeSet } }, tx))).rejects.toThrow("captured by the server");
            expect(f.committed).toEqual([]);
        } finally {
            await f.db.destroy();
        }
    });

    it("does not turn security-only login events into restorable business snapshots", async () => {
        const f = setup();
        try {
            await f.security.record({ eventType: "login_failed", summary: "Denied" });
            expect(f.queries).toHaveLength(1);
            expect(f.queries[0]?.sql).toContain("audit_security_event");
        } finally {
            await f.db.destroy();
        }
    });
});
