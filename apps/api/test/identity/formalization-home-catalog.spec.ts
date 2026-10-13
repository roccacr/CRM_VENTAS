import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";

describe("Formalization Home security catalog", () => {
    it("places the standalone Home permission inside Formalization / Inicio", async () => {
        class CatalogDriver extends DummyDriver {
            override async acquireConnection() {
                const connection = await super.acquireConnection();
                connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                    const rows = query.sql.includes("from `sec_permission`") ? [{ code: "formalizacion.home.read", moduleCode: "formalizacion", actionCode: "read", description: "Permite ver el inicio de Formalizacion." }] : [];
                    return Promise.resolve({ rows: rows as R[] });
                };
                return connection;
            }
        }
        const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new CatalogDriver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
        const database = { db } as DatabaseService;
        const audit = new SecurityAuditService(database);
        try {
            const catalog = await new IdentityAccessManagementRepository(database, audit, new IdentitySessionRepository(database, audit)).readSecurityCatalog();
            expect(catalog.modules.find((module) => module.code === "formalizacion")?.views).toEqual([{ code: "home", name: "Inicio", permissions: [{ code: "formalizacion.home.read", name: "Ver inicio de Formalizacion", description: "Permite ver el inicio de Formalizacion.", sensitive: false }] }]);
        } finally {
            await db.destroy();
        }
    });
});
