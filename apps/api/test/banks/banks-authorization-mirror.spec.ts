import "reflect-metadata";

import { ConfigService } from "@nestjs/config";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult, type Transaction } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { CookieRequest } from "../../src/common/security/cookie-request.type.js";
import { hasRoutePermission } from "../../src/common/security/route-permission.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacyBanksWriter } from "../../src/integrations/legacy-crm/legacy-banks.writer.js";
import { buildAuditChangeSet } from "../../src/modules/crm/audit/audit-change-set.js";
import { canUseBanks } from "../../src/modules/crm/banks/banks.permissions.js";
import { CATALOG_CONTEXT_MODULES } from "../../src/modules/crm/catalogs/catalogs.constants.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";

const profile = (moduleCode: string, role = "jefe_general"): IdentityProfile => ({ user: { status: "active" }, roles: [{ code: role, status: "active" }], orgUnits: [{ code: moduleCode, status: "active" }], permissions: ["read", "create", "update", "inactivate"].map((action) => ({ code: `${moduleCode}.catalog_bank.${action}`, effect: "allow" })) }) as IdentityProfile;
describe.each(CATALOG_CONTEXT_MODULES)("Banks authorization %s", (moduleCode) => {
    it("requires active privileged role, exact allow and membership", () => {
        expect(canUseBanks(profile(moduleCode), moduleCode, "create")).toBe(true);
        const denied = profile(moduleCode);
        denied.permissions = [...denied.permissions, { code: `${moduleCode}.catalog_bank.read`, effect: "deny", scope: null, source: "role" }];
        expect(canUseBanks(denied, moduleCode, "create")).toBe(false);
        const noRead = profile(moduleCode);
        noRead.permissions = noRead.permissions.filter((p) => !p.code.endsWith(".read"));
        expect(canUseBanks(noRead, moduleCode, "create")).toBe(false);
        const noModule = profile(moduleCode);
        noModule.orgUnits = [];
        expect(canUseBanks(noModule, moduleCode, "read")).toBe(false);
        const owner = profile(moduleCode, "owner");
        owner.orgUnits = [];
        expect(canUseBanks(owner, moduleCode, "read")).toBe(true);
        expect(canUseBanks(profile(moduleCode, "ventas"), moduleCode, "read")).toBe(true);
    });
    it("guard maps reactivation to update and inactivation to inactivate", () => {
        const user = profile(moduleCode);
        user.permissions = user.permissions.filter((p) => !p.code.endsWith(".inactivate"));
        const request = { body: { moduleCode, status: "active" }, params: { catalogCode: "banks" } } as unknown as CookieRequest;
        expect(hasRoutePermission(user, { kind: "catalog", catalog: "banks", action: "status" }, request)).toBe(true);
        request.body = { moduleCode, status: "inactive" };
        expect(hasRoutePermission(user, { kind: "catalog", catalog: "banks", action: "status" }, request)).toBe(false);
    });
});
describe("Banks mirror gates and SQL", () => {
    const bank = { publicId: "01K8SJ7KXKWWPMAWEA8NXGWW83", name: "Banco ?", status: "active" as const, version: 1, createdAt: "2026-11-03T12:00:00.000Z", updatedAt: "2026-11-03T12:00:00.000Z", advisorCount: 0 };
    it.each([
        { ENABLE_LEGACY_FALLBACK: true, ENABLE_LEGACY_WRITES: false, LEGACY_CRM_DB_NAME: "crmdatabase-api" },
        { ENABLE_LEGACY_FALLBACK: true, ENABLE_LEGACY_WRITES: true, LEGACY_CRM_DB_NAME: "other" },
    ])("fails before any statement when mirror is not explicitly enabled", async (config) => {
        const writer = new LegacyBanksWriter(new ConfigService(config));
        const executeQuery = vi.fn();
        const tx = { isTransaction: true, executeQuery } as unknown as Transaction<CrmDatabase>;
        expect(() => {
            writer.assertWritable();
        }).toThrow("Banks mirror requires explicit legacy writes and exact legacy schema.");
        await expect(writer.writeBank(tx, bank)).rejects.toMatchObject({ status: 503 });
        expect(executeQuery).not.toHaveBeenCalled();
    });
    it("native-only opt-out never calls legacy SQL", async () => {
        const writer = new LegacyBanksWriter(new ConfigService({ ENABLE_LEGACY_FALLBACK: false, ENABLE_LEGACY_WRITES: false }));
        await expect(writer.writeBank({} as Transaction<CrmDatabase>, bank)).resolves.toBeUndefined();
    });
    it("allows local Banks-specific writes only inside native transaction and parameterizes values", async () => {
        const seen: CompiledQuery[] = [];
        class Driver extends DummyDriver {
            override async acquireConnection() {
                const connection = await super.acquireConnection();
                connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                    seen.push(query);
                    return Promise.resolve({ rows: [] });
                };
                return connection;
            }
        }
        const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
        const writer = new LegacyBanksWriter(new ConfigService({ NODE_ENV: "development", ENABLE_LEGACY_FALLBACK: true, ENABLE_LEGACY_WRITES: true, LEGACY_CRM_DB_NAME: "crmdatabase-api" }));
        try {
            await expect(writer.writeBank(db as Transaction<CrmDatabase>, bank)).rejects.toMatchObject({ status: 503 });
            await db.transaction().execute((tx) => writer.writeBank(tx, bank));
            expect(seen[0]?.sql).toContain("FOR UPDATE");
            expect(seen[1]?.sql).toContain("INSERT INTO `crmdatabase-api`.crm_bank");
            expect(seen[1]?.sql).not.toContain(bank.name);
            expect(seen[1]?.parameters).toContain(bank.name);
        } finally {
            await db.destroy();
        }
    });
    it("records all bank contact fields without widening other domain snapshots", () => {
        const after = { name: "Ejecutivo", email: "x@example.test", phone: "123", area: "Crédito", version: 2, bankPublicId: bank.publicId, password: "secret" };
        const change = buildAuditChangeSet({ entity: "bank_advisor", recordId: bank.publicId, action: "update", before: { ...after, phone: "456", version: 1 }, after });
        expect(change.after).toMatchObject({ phone: "123", area: "Crédito", version: 2, bankPublicId: bank.publicId });
        expect(change.after).not.toHaveProperty("password");
        expect(buildAuditChangeSet({ entity: "user", recordId: "user", action: "update", before: null, after }).after).not.toHaveProperty("phone");
    });
});
