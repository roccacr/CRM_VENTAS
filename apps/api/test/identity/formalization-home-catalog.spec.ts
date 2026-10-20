import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";

describe("Formalization Home security catalog", () => {
    it("organizes Home, Sales order and catalogs without changing permissions or other modules", async () => {
        class CatalogDriver extends DummyDriver {
            override async acquireConnection() {
                const connection = await super.acquireConnection();
                connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                    const rows = query.sql.includes("from `sec_permission`")
                        ? [
                              { code: "contract.review", moduleCode: "formalizacion", actionCode: "review", description: "Revisar contrato" },
                              { code: "file.read", moduleCode: "formalizacion", actionCode: "read", description: "Ver expediente" },
                              { code: "formalizacion.catalog_project.read", moduleCode: "formalizacion", actionCode: "read", description: "Ver proyectos" },
                              { code: "formalizacion.home.approvals.read", moduleCode: "formalizacion", actionCode: "read", description: "Permite ver el banner de pendientes de aprobacion de Formalizacion; no permite aprobar ordenes." },
                              { code: "signature.manage", moduleCode: "formalizacion", actionCode: "manage", description: "Gestionar firmas" },
                              { code: "lead.read", moduleCode: "ventas", actionCode: "read", description: "Ver leads" },
                          ]
                        : [];
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
            const views = catalog.modules.find((module) => module.code === "formalizacion")?.views ?? [];
            expect(views.map((view) => ({ code: view.code, name: view.name }))).toEqual([
                { code: "home", name: "Pantalla de inicio" },
                { code: "sales_order", name: "Orden de venta" },
                { code: "catalog_project", name: "Proyectos" },
            ]);
            expect(views.find((view) => view.code === "sales_order")?.permissions.map((permission) => permission.code)).toEqual(["contract.review", "file.read", "signature.manage"]);
            expect(
                views
                    .flatMap((view) => view.permissions)
                    .map((permission) => permission.code)
                    .sort(),
            ).toEqual(["contract.review", "file.read", "formalizacion.catalog_project.read", "formalizacion.home.approvals.read", "signature.manage"]);
            expect(views.find((view) => view.code === "home")).toMatchObject({ permissions: [expect.objectContaining({ name: "Banner pendiente de aprobaci\u00f3n de Formalizaci\u00f3n" })] });
            expect(catalog.modules.find((module) => module.code === "ventas")?.views.map((view) => view.code)).toEqual(["lead"]);
        } finally {
            await db.destroy();
        }
    });
});
