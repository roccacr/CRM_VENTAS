import { describe, expect, it } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityRepository } from "../../src/modules/crm/identity/identity.repository.js";
import { EffectivePermissionService } from "../../src/modules/crm/permissions/effective-permission.service.js";

type QueryCall = {
    method: string;
    args: unknown[];
};

type QueryBuilderResult = {
    calls: QueryCall[];
    builder: {
        innerJoin: (...args: unknown[]) => QueryBuilderResult["builder"];
        insertInto: (...args: unknown[]) => QueryBuilderResult["builder"];
        select: (...args: unknown[]) => QueryBuilderResult["builder"];
        selectFrom: (...args: unknown[]) => QueryBuilderResult["builder"];
        set: (...args: unknown[]) => QueryBuilderResult["builder"];
        updateTable: (...args: unknown[]) => QueryBuilderResult["builder"];
        values: (...args: unknown[]) => QueryBuilderResult["builder"];
        where: (...args: unknown[]) => QueryBuilderResult["builder"];
        execute: () => Promise<unknown[]>;
        executeTakeFirst: () => Promise<unknown>;
    };
};

type RepositoryPrivateApi = {
    findRoles: (userId: number) => Promise<unknown[]>;
    findOrgUnits: (userId: number) => Promise<unknown[]>;
    findRolePermissions: (userId: number, scope: string) => Promise<unknown[]>;
    findOverrides: (userId: number) => Promise<unknown[]>;
};

/**
 * Doble minimo de query builder fluido.
 *
 * Estas pruebas no validan Kysely; validan que el repository construya las
 * fronteras de seguridad obligatorias antes de llegar a MySQL.
 */
const createQueryBuilder = (executeRows: unknown[] = [], executeTakeFirstRows: unknown[] = []): QueryBuilderResult => {
    const calls: QueryCall[] = [];
    const takeFirstQueue = [...executeTakeFirstRows];

    const builder = {
        innerJoin: (...args: unknown[]) => {
            calls.push({ method: "innerJoin", args });
            return builder;
        },
        insertInto: (...args: unknown[]) => {
            calls.push({ method: "insertInto", args });
            return builder;
        },
        select: (...args: unknown[]) => {
            calls.push({ method: "select", args });
            return builder;
        },
        selectFrom: (...args: unknown[]) => {
            calls.push({ method: "selectFrom", args });
            return builder;
        },
        set: (...args: unknown[]) => {
            calls.push({ method: "set", args });
            return builder;
        },
        updateTable: (...args: unknown[]) => {
            calls.push({ method: "updateTable", args });
            return builder;
        },
        values: (...args: unknown[]) => {
            calls.push({ method: "values", args });
            return builder;
        },
        where: (...args: unknown[]) => {
            calls.push({ method: "where", args });
            return builder;
        },
        execute: () => Promise.resolve(executeRows),
        executeTakeFirst: () => Promise.resolve(takeFirstQueue.shift()),
    };

    return { calls, builder };
};

/**
 * Crea el repository con dobles controlados.
 */
const createRepository = (builder: QueryBuilderResult["builder"]): IdentityRepository => {
    const database = {
        db: {
            selectFrom: builder.selectFrom,
            transaction: () => ({
                execute: async (callback: (transaction: unknown) => Promise<void>) => callback(builder),
            }),
        },
    } as unknown as DatabaseService;

    return new IdentityRepository(database, new EffectivePermissionService(), new SecurityAuditService(database));
};

/**
 * Accede a metodos privados solo para fijar regresiones de queries sensibles.
 */
const getPrivateRepositoryApi = (repository: IdentityRepository): RepositoryPrivateApi => repository as unknown as RepositoryPrivateApi;

/**
 * Indica si el query aplico un filtro where exacto.
 */
const hasWhere = (calls: QueryCall[], column: string, operator: string, value: unknown): boolean => calls.some((call) => call.method === "where" && call.args[0] === column && call.args[1] === operator && call.args[2] === value);

/**
 * Indica si el query hizo join con la tabla indicada.
 */
const hasJoin = (calls: QueryCall[], table: string): boolean => calls.some((call) => call.method === "innerJoin" && call.args[0] === table);

describe("IdentityRepository", () => {
    it("filtra permisos derivados por rol activo, rol no eliminado y permiso activo", async () => {
        const { builder, calls } = createQueryBuilder([{ code: "user.view_self" }]);
        const repository = createRepository(builder);

        await getPrivateRepositoryApi(repository).findRolePermissions(7, "own_area");

        expect(hasJoin(calls, "sec_role as role")).toBe(true);
        expect(hasWhere(calls, "role.status_role", "=", "active")).toBe(true);
        expect(hasWhere(calls, "role.deleted_at_role", "is", null)).toBe(true);
        expect(hasWhere(calls, "permission.status_permission", "=", "active")).toBe(true);
    });

    it("filtra roles directos eliminados logicamente", async () => {
        const { builder, calls } = createQueryBuilder([]);
        const repository = createRepository(builder);

        await getPrivateRepositoryApi(repository).findRoles(7);

        expect(hasWhere(calls, "role.status_role", "=", "active")).toBe(true);
        expect(hasWhere(calls, "role.deleted_at_role", "is", null)).toBe(true);
    });

    it("filtra areas eliminadas logicamente", async () => {
        const { builder, calls } = createQueryBuilder([]);
        const repository = createRepository(builder);

        await getPrivateRepositoryApi(repository).findOrgUnits(7);

        expect(hasWhere(calls, "org.status_org_unit", "=", "active")).toBe(true);
        expect(hasWhere(calls, "org.deleted_at_org_unit", "is", null)).toBe(true);
    });

    it("filtra overrides directos por permiso activo", async () => {
        const { builder, calls } = createQueryBuilder([]);
        const repository = createRepository(builder);

        await getPrivateRepositoryApi(repository).findOverrides(7);

        expect(hasJoin(calls, "sec_permission as permission")).toBe(true);
        expect(hasWhere(calls, "override.revoked_at_user_permission_override", "is", null)).toBe(true);
        expect(hasWhere(calls, "permission.status_permission", "=", "active")).toBe(true);
    });

    it("registra auditoria de logout dentro de la misma transaccion", async () => {
        const session = {
            id_auth_session: 10,
            user_id_auth_session: 20,
        };
        const { builder, calls } = createQueryBuilder([], [session, { numUpdatedRows: 1n }]);
        const repository = createRepository(builder);

        await repository.revokeSessionByPublicId("session-public-id", "127.0.0.1", "vitest");

        expect(hasWhere(calls, "status_auth_session", "=", "active")).toBe(true);
        expect(calls.some((call) => call.method === "insertInto" && call.args[0] === "audit_security_event")).toBe(true);
        expect(calls.some((call) => call.method === "set" && JSON.stringify(call.args[0]).includes("revoked_by_user_id_auth_session"))).toBe(true);
    });

    it("no audita logout si otra peticion ya revoco la misma sesion", async () => {
        const session = {
            id_auth_session: 10,
            user_id_auth_session: 20,
        };
        const { builder, calls } = createQueryBuilder([], [session, { numUpdatedRows: 0n }]);
        const repository = createRepository(builder);

        await repository.revokeSessionByPublicId("session-public-id", "127.0.0.1", "vitest");

        expect(calls.some((call) => call.method === "insertInto" && call.args[0] === "audit_security_event")).toBe(false);
    });
});
