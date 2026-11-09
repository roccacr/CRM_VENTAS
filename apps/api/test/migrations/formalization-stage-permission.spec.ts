import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { formalizationStagePermissionMigration } from "../../migrations/schema-only/202610260037_formalization_stage_permission.js";
import { selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";
import type { DatabaseService } from "../../src/database/database.service.js";
import type { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import type { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";
import { anyOf } from "../support/throws.js";

const code = "formalizacion.orders.stage.update";
const description = "Permite cambiar la etapa de una orden con tres aprobaciones completas; retrocesos requieren motivo; no envia correos ni modifica ERP.";
const definition = { code, module: "formalizacion", action: "stage_update", description, status: "active" };

function fixture(options: { database?: string; tables?: Record<string, unknown>[]; permissions?: Record<string, unknown>[] } = {}) {
    const queries: CompiledQuery[] = [];
    let permissions = options.permissions ?? [];
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            if (query.sql.startsWith("INSERT INTO sec_permission")) permissions = [definition];
            const inventory: [string, object[]][] = [
                ["SELECT DATABASE()", [{ name: options.database ?? "CRM_THINK_V2" }]],
                ["information_schema.TABLES", options.tables ?? [{ table_name: "sec_permission", table_type: "BASE TABLE", engine: "InnoDB" }]],
                ["FROM sec_permission", permissions],
                ["from `sec_permission`", [{ actionCode: "stage_update", code, description, moduleCode: "formalizacion" }]],
            ];
            return Promise.resolve({ rows: (inventory.find(([fragment]) => query.sql.includes(fragment))?.[1] ?? []) as R[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}

describe("independent formalization stage permission migration", () => {
    it("registers 037, inserts the exact permission once and never grants or bumps versions", async () => {
        expect(selectSchemaMigrations(formalizationStagePermissionMigration.name)).toEqual([formalizationStagePermissionMigration]);
        const f = fixture();
        try {
            await formalizationStagePermissionMigration.up(f.db);
            await formalizationStagePermissionMigration.up(f.db);
            const writes = f.queries.filter((query) => !query.sql.startsWith("SELECT"));
            expect(writes).toHaveLength(1);
            expect(writes[0]?.sql).toContain("INSERT INTO sec_permission");
            expect(writes[0]?.parameters).toEqual([code, "formalizacion", "stage_update", description, "active"]);
            expect(f.queries.map((q) => q.sql).join("\n")).not.toMatch(/sec_role_permission|sec_user_permission_override|permission_version_user|UPDATE |DELETE |crmdatabase-api/);
            expect(f.queries.find((q) => q.sql.includes("FROM sec_permission"))?.sql).toContain("FOR UPDATE");
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ database: "crmdatabase-api" }, { tables: [] }, { tables: [{ table_name: "sec_permission", table_type: "VIEW", engine: null }] }, { tables: [{ table_name: "sec_permission", table_type: "BASE TABLE", engine: "MyISAM" }] }, ...Object.keys(definition).map((key) => ({ permissions: [{ ...definition, [key]: "drift" }] })), { permissions: [definition, definition] }])("fails closed without writes for drift: %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(formalizationStagePermissionMigration.up(f.db)).rejects.toThrow(anyOf("Formalization stage permission requires CRM_THINK_V2", "Formalization stage permission requires native InnoDB sec_permission", "Formalization stage permission conflicts with existing configuration; reconcilia"));
            expect(f.queries.every((q) => q.sql.startsWith("SELECT"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it("presents the exact independent permission label as sensitive in the public catalog", async () => {
        const f = fixture();
        const repository = new IdentityAccessManagementRepository({ db: f.db } as unknown as DatabaseService, {} as SecurityAuditService, {} as IdentitySessionRepository);
        try {
            const catalog = await repository.readSecurityCatalog();
            const permissions = catalog.modules.flatMap((module) => module.views.flatMap((view) => view.permissions));
            expect(permissions).toContainEqual({ code, description, name: "Cambiar etapa de Formalizacion", sensitive: true });
        } finally {
            await f.db.destroy();
        }
    });
});
