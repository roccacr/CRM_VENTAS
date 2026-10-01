import { describe, expect, it } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityRepository } from "../../src/modules/crm/identity/identity.repository.js";
import { IdentityLocalRepository } from "../../src/modules/crm/identity/identity-local.repository.js";
import { IdentityMicrosoftRepository } from "../../src/modules/crm/identity/identity-microsoft.repository.js";
import { IdentityProfileRepository } from "../../src/modules/crm/identity/identity-profile.repository.js";
import { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";
import { IdentityUserDirectoryRepository } from "../../src/modules/crm/identity/identity-user-directory.repository.js";
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
        onDuplicateKeyUpdate: (...args: unknown[]) => QueryBuilderResult["builder"];
        select: (...args: unknown[]) => QueryBuilderResult["builder"];
        selectFrom: (...args: unknown[]) => QueryBuilderResult["builder"];
        set: (...args: unknown[]) => QueryBuilderResult["builder"];
        updateTable: (...args: unknown[]) => QueryBuilderResult["builder"];
        values: (...args: unknown[]) => QueryBuilderResult["builder"];
        where: (...args: unknown[]) => QueryBuilderResult["builder"];
        execute: () => Promise<unknown[]>;
        executeTakeFirst: () => Promise<unknown>;
        executeTakeFirstOrThrow: () => Promise<unknown>;
    };
};

type RepositoryPrivateApi = {
    findRoles: (userId: number) => Promise<unknown[]>;
    findOrgUnits: (userId: number) => Promise<unknown[]>;
    findRolePermissions: (userId: number, scope: string) => Promise<unknown[]>;
    findOverrides: (userId: number) => Promise<unknown[]>;
};

type ProfileRepositoryPrivateApi = RepositoryPrivateApi;

type UserDirectoryRepositoryPrivateApi = {
    countMatchingUsers: (input: { readonly search?: string; readonly status?: string }) => Promise<number>;
    resolveScopeForRoleCodes: (roleCodes: readonly string[]) => string;
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
        onDuplicateKeyUpdate: (...args: unknown[]) => {
            calls.push({ method: "onDuplicateKeyUpdate", args });
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
        executeTakeFirstOrThrow: () => Promise.resolve(takeFirstQueue.shift() ?? {}),
    };

    return { calls, builder };
};

/**
 * Crea el repository con dobles controlados.
 */
const createRepository = (builder: QueryBuilderResult["builder"]): IdentityRepository => {
    const database = {
        db: {
            insertInto: builder.insertInto,
            selectFrom: builder.selectFrom,
            transaction: () => ({
                execute: async <T>(callback: (transaction: unknown) => Promise<T>) => callback(builder),
            }),
            updateTable: builder.updateTable,
        },
    } as unknown as DatabaseService;

    const audit = new SecurityAuditService(database);
    const profiles = new IdentityProfileRepository(database, new EffectivePermissionService());
    const sessions = new IdentitySessionRepository(database, audit);
    const local = new IdentityLocalRepository(database, audit);
    const microsoft = new IdentityMicrosoftRepository(database, sessions);
    const userDirectory = new IdentityUserDirectoryRepository(database, audit);

    const repository = new IdentityRepository(profiles, sessions, local, microsoft, userDirectory);

    return repository;
};

/**
 * Crea el repository de perfil para caracterizar queries de permisos.
 */
const createProfileRepository = (builder: QueryBuilderResult["builder"]): IdentityProfileRepository => {
    const database = {
        db: {
            selectFrom: builder.selectFrom,
        },
    } as unknown as DatabaseService;

    return new IdentityProfileRepository(database, new EffectivePermissionService());
};

/**
 * Accede a metodos privados solo para fijar regresiones de queries sensibles.
 */
const getPrivateProfileRepositoryApi = (repository: IdentityProfileRepository): ProfileRepositoryPrivateApi => repository as unknown as ProfileRepositoryPrivateApi;

/**
 * Accede a reglas internas del directorio para fijar contratos de alcance.
 */
const getPrivateUserDirectoryRepositoryApi = (repository: IdentityUserDirectoryRepository): UserDirectoryRepositoryPrivateApi => repository as unknown as UserDirectoryRepositoryPrivateApi;

/**
 * Indica si el query aplico un filtro where exacto.
 */
const hasWhere = (calls: QueryCall[], column: string, operator: string, value: unknown): boolean => calls.some((call) => call.method === "where" && call.args[0] === column && call.args[1] === operator && call.args[2] === value);

/**
 * Indica si el query hizo join con la tabla indicada.
 */
const hasJoin = (calls: QueryCall[], table: string): boolean => calls.some((call) => call.method === "innerJoin" && call.args[0] === table);

/**
 * Extrae el primer payload enviado a `set` despues de actualizar una tabla.
 */
const readSetAfterUpdateTable = (calls: QueryCall[], table: string): Record<string, unknown> => {
    const updateIndex = calls.findIndex((call) => call.method === "updateTable" && call.args[0] === table);
    const setCall = calls.slice(updateIndex).find((call) => call.method === "set");

    return (setCall?.args[0] ?? {}) as Record<string, unknown>;
};

/**
 * Extrae el primer payload enviado a `values` despues de insertar en una tabla.
 */
const readValuesAfterInsertInto = (calls: QueryCall[], table: string): Record<string, unknown> => {
    const insertIndex = calls.findIndex((call) => call.method === "insertInto" && call.args[0] === table);
    const valuesCall = calls.slice(insertIndex).find((call) => call.method === "values");

    return (valuesCall?.args[0] ?? {}) as Record<string, unknown>;
};

describe("IdentityRepository", () => {
    it("limita jefatura general a las areas operativas asignadas, no a todo el sistema", () => {
        const { builder } = createQueryBuilder();
        const database = {
            db: {
                selectFrom: builder.selectFrom,
            },
        } as unknown as DatabaseService;
        const userDirectory = new IdentityUserDirectoryRepository(database, new SecurityAuditService(database));

        expect(getPrivateUserDirectoryRepositoryApi(userDirectory).resolveScopeForRoleCodes(["owner"])).toBe("all_areas");
        expect(getPrivateUserDirectoryRepositoryApi(userDirectory).resolveScopeForRoleCodes(["jefe_general"])).toBe("own_area_and_children");
        expect(getPrivateUserDirectoryRepositoryApi(userDirectory).resolveScopeForRoleCodes(["subjefe_area"])).toBe("own_area_and_children");
        expect(getPrivateUserDirectoryRepositoryApi(userDirectory).resolveScopeForRoleCodes(["ventas"])).toBe("self");
    });

    it("normaliza el total del directorio a number aunque MySQL devuelva bigint", async () => {
        const { builder } = createQueryBuilder([], [{ total: 44n }]);
        const database = {
            db: {
                selectFrom: builder.selectFrom,
            },
        } as unknown as DatabaseService;
        const userDirectory = new IdentityUserDirectoryRepository(database, new SecurityAuditService(database));

        await expect(getPrivateUserDirectoryRepositoryApi(userDirectory).countMatchingUsers({})).resolves.toBe(44);
    });

    it("resuelve identidad Microsoft por subject estable y no por correo", async () => {
        const { builder, calls } = createQueryBuilder([], [{ authIdentityId: 30, permissionVersion: 1, userId: 20 }]);
        const repository = createRepository(builder);

        await repository.findActiveMicrosoftIdentity({
            normalizedEmail: "roberto@roccacr.com",
            subject: "oid-estable",
        });

        expect(hasWhere(calls, "identity.provider_subject_auth_identity", "=", "oid-estable")).toBe(true);
        expect(hasWhere(calls, "identity.normalized_email_auth_identity", "=", "roberto@roccacr.com")).toBe(false);
    });

    it("crea identidad Microsoft para usuario CRM activo encontrado por correo verificado", async () => {
        const { builder, calls } = createQueryBuilder([], [undefined, { deletedAt: null, permissionVersion: 7, status: "active", userId: 20 }, {}, { authIdentityId: 30, permissionVersion: 7, userId: 20 }]);
        const repository = createRepository(builder);

        const result = await repository.findOrCreateActiveMicrosoftIdentityForVerifiedEmail({
            email: "Roberto@RoccaCR.com",
            normalizedEmail: "roberto@roccacr.com",
            subject: "oid-estable",
        });

        const identityValues = readValuesAfterInsertInto(calls, "sec_auth_identity");

        expect(result).toEqual({ identity: { authIdentityId: 30, permissionVersion: 7, userId: 20 }, status: "ready" });
        expect(hasWhere(calls, "user.normalized_email_user", "=", "roberto@roccacr.com")).toBe(true);
        expect(identityValues).toEqual(
            expect.objectContaining({
                email_auth_identity: "Roberto@RoccaCR.com",
                normalized_email_auth_identity: "roberto@roccacr.com",
                provider_code_auth_identity: "microsoft",
                provider_subject_auth_identity: "oid-estable",
                status_auth_identity: "active",
                user_id_auth_identity: 20,
            }),
        );
    });

    it("no resuelve una identidad Microsoft existente solo por correo cuando el subject no coincide", async () => {
        const { builder, calls } = createQueryBuilder([], [undefined, { deletedAt: null, permissionVersion: 7, status: "active", userId: 20 }, {}, { authIdentityId: 30, permissionVersion: 7, userId: 20 }]);
        const repository = createRepository(builder);

        await repository.findOrCreateActiveMicrosoftIdentityForVerifiedEmail({
            email: "Roberto@RoccaCR.com",
            normalizedEmail: "roberto@roccacr.com",
            subject: "oid-estable",
        });

        expect(calls.some((call) => call.method === "where" && typeof call.args[0] === "function")).toBe(false);
        expect(hasWhere(calls, "identity.provider_subject_auth_identity", "=", "oid-estable")).toBe(true);
    });

    it("no crea identidad Microsoft cuando el usuario CRM encontrado por correo esta bloqueado", async () => {
        const { builder, calls } = createQueryBuilder([], [undefined, { deletedAt: null, status: "blocked" }]);
        const repository = createRepository(builder);

        const result = await repository.findOrCreateActiveMicrosoftIdentityForVerifiedEmail({
            email: "Roberto@RoccaCR.com",
            normalizedEmail: "roberto@roccacr.com",
            subject: "oid-estable",
        });

        expect(result).toEqual({ status: "user_not_active" });
        expect(hasWhere(calls, "user.normalized_email_user", "=", "roberto@roccacr.com")).toBe(true);
        expect(calls.some((call) => call.method === "insertInto" && call.args[0] === "sec_auth_identity")).toBe(false);
    });

    it("normaliza correo Microsoft con el helper canonico antes de persistirlo", async () => {
        const { builder, calls } = createQueryBuilder([], [{ numUpdatedRows: 1n }, {}]);
        const repository = createRepository(builder);

        await repository.saveMicrosoftAccount({
            authIdentityId: 30,
            cache: {
                ciphertext: "cipher",
                iv: "iv",
                keyVersion: 1,
                tag: "tag",
            },
            displayName: "Roberto",
            email: " Roberto@RoccaCR.com ",
            graphSyncedAt: null,
            homeAccountId: "home.tenant",
            oid: "oid",
            permissionVersion: 1,
            profileImage: null,
            subject: "oid",
            tenantId: "tenant",
            userId: 20,
        });

        const identityUpdate = readSetAfterUpdateTable(calls, "sec_auth_identity");

        expect(identityUpdate.normalized_email_auth_identity).toBe("roberto@roccacr.com");
    });

    it("revoca refresh por Microsoft con estado valido y razon separada", async () => {
        const { builder, calls } = createQueryBuilder([{ id_auth_session: 10 }]);
        const repository = createRepository(builder);

        await repository.markMicrosoftInteractionRequiredAndRevokeSessions(30, 20);

        const refreshUpdate = readSetAfterUpdateTable(calls, "sec_refresh_token");

        expect(refreshUpdate.status_refresh_token).toBe("revoked");
        expect(refreshUpdate.revoked_reason_refresh_token).toBe("microsoft_interaction_required");
    });

    it("filtra permisos derivados por rol activo, rol no eliminado y permiso activo", async () => {
        const { builder, calls } = createQueryBuilder([{ code: "user.view_self" }]);
        const repository = createProfileRepository(builder);

        await getPrivateProfileRepositoryApi(repository).findRolePermissions(7, "own_area");

        expect(hasJoin(calls, "sec_role as role")).toBe(true);
        expect(hasWhere(calls, "role.status_role", "=", "active")).toBe(true);
        expect(hasWhere(calls, "role.deleted_at_role", "is", null)).toBe(true);
        expect(hasWhere(calls, "permission.status_permission", "=", "active")).toBe(true);
    });

    it("filtra roles directos eliminados logicamente", async () => {
        const { builder, calls } = createQueryBuilder([]);
        const repository = createProfileRepository(builder);

        await getPrivateProfileRepositoryApi(repository).findRoles(7);

        expect(hasWhere(calls, "role.status_role", "=", "active")).toBe(true);
        expect(hasWhere(calls, "role.deleted_at_role", "is", null)).toBe(true);
    });

    it("filtra areas eliminadas logicamente", async () => {
        const { builder, calls } = createQueryBuilder([]);
        const repository = createProfileRepository(builder);

        await getPrivateProfileRepositoryApi(repository).findOrgUnits(7);

        expect(hasWhere(calls, "orgUnit.status_org_unit", "=", "active")).toBe(true);
        expect(hasWhere(calls, "orgUnit.deleted_at_org_unit", "is", null)).toBe(true);
    });

    it("filtra overrides directos por permiso activo", async () => {
        const { builder, calls } = createQueryBuilder([]);
        const repository = createProfileRepository(builder);

        await getPrivateProfileRepositoryApi(repository).findOverrides(7);

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

        await repository.revokeSessionByTokenHash("session-token-hash", "127.0.0.1", "vitest");

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

        await repository.revokeSessionByTokenHash("session-token-hash", "127.0.0.1", "vitest");

        expect(calls.some((call) => call.method === "insertInto" && call.args[0] === "audit_security_event")).toBe(false);
    });

    it("incrementa intentos fallidos de login local con operacion atomica en MySQL", async () => {
        const lockedUntil = new Date(Date.now() + 60_000);
        const { builder, calls } = createQueryBuilder(
            [],
            [
                { numUpdatedRows: 1n },
                {
                    failedLoginCount: 5,
                    lockedUntil,
                },
            ],
        );
        const repository = createRepository(builder);

        const result = await repository.recordFailedLocalLogin(10, 5, lockedUntil);
        const identityUpdate = readSetAfterUpdateTable(calls, "sec_auth_identity");

        expect(result).toEqual({ failedLoginCount: 5, lockedUntil });
        expect(identityUpdate.failed_login_count_auth_identity).not.toBe(5);
        expect(identityUpdate.locked_until_auth_identity).not.toBe(lockedUntil);
    });

    it("rechaza rotacion de refresh si la sesion asociada ya no esta activa", async () => {
        const refreshRow = {
            refreshTokenId: 1,
            refreshStatus: "active",
            refreshExpiresAt: new Date(Date.now() + 60_000),
            refreshFamilyId: "refresh-family",
            sessionId: 10,
            sessionStatus: "revoked",
            sessionExpiresAt: new Date(Date.now() + 60_000),
            sessionPublicId: "session-public-id",
            sessionPermissionVersion: 1,
            userId: 20,
            userPermissionVersion: 1,
            userStatus: "active",
            identityStatus: "active",
        };
        const { builder, calls } = createQueryBuilder([], [refreshRow]);
        const repository = createRepository(builder);

        const result = await repository.rotateRefreshSession({
            nextRefreshExpiresAt: new Date(Date.now() + 120_000),
            nextRefreshTokenHash: "next-refresh-hash",
            nextSessionExpiresAt: new Date(Date.now() + 120_000),
            nextSessionTokenHash: "next-session-hash",
            refreshTokenHash: "current-refresh-hash",
        });

        expect(result).toEqual({ sessionPublicId: "session-public-id", status: "invalid", userId: 20 });
        expect(calls.some((call) => call.method === "updateTable" && call.args[0] === "sec_refresh_token")).toBe(true);
        expect(calls.some((call) => call.method === "updateTable" && call.args[0] === "sec_auth_session")).toBe(true);
    });

    it("no trata como reuso una carrera que ya consumio el refresh token activo", async () => {
        const refreshRow = {
            refreshTokenId: 1,
            refreshStatus: "active",
            refreshExpiresAt: new Date(Date.now() + 60_000),
            refreshFamilyId: "refresh-family",
            sessionId: 10,
            sessionStatus: "active",
            sessionExpiresAt: new Date(Date.now() + 60_000),
            sessionPublicId: "session-public-id",
            sessionPermissionVersion: 1,
            userId: 20,
            userPermissionVersion: 1,
            userStatus: "active",
            identityStatus: "active",
        };
        const { builder, calls } = createQueryBuilder([{ id_auth_session: 10 }], [refreshRow, { numUpdatedRows: 0n }]);
        const repository = createRepository(builder);

        const result = await repository.rotateRefreshSession({
            nextRefreshExpiresAt: new Date(Date.now() + 120_000),
            nextRefreshTokenHash: "next-refresh-hash",
            nextSessionExpiresAt: new Date(Date.now() + 120_000),
            nextSessionTokenHash: "next-session-hash",
            refreshTokenHash: "current-refresh-hash",
        });

        expect(result).toEqual({ sessionPublicId: "session-public-id", status: "invalid", userId: 20 });
        expect(calls.some((call) => call.method === "insertInto" && call.args[0] === "sec_refresh_token")).toBe(false);
        expect(calls.some((call) => call.method === "selectFrom" && call.args[0] === "sec_auth_session")).toBe(false);
    });

    it("no trata como reuso un refresh revocado porque Microsoft pidio login interactivo", async () => {
        const refreshRow = {
            refreshTokenId: 1,
            refreshStatus: "revoked",
            refreshRevokedReason: "microsoft_interaction_required",
            refreshExpiresAt: new Date(Date.now() + 60_000),
            refreshFamilyId: "refresh-family",
            sessionId: 10,
            sessionStatus: "revoked",
            sessionExpiresAt: new Date(Date.now() + 60_000),
            sessionPublicId: "session-public-id",
            sessionPermissionVersion: 1,
            userId: 20,
            userPermissionVersion: 1,
            userStatus: "active",
            identityStatus: "active",
        };
        const { builder, calls } = createQueryBuilder([], [refreshRow]);
        const repository = createRepository(builder);

        const result = await repository.rotateRefreshSession({
            nextRefreshExpiresAt: new Date(Date.now() + 120_000),
            nextRefreshTokenHash: "next-refresh-hash",
            nextSessionExpiresAt: new Date(Date.now() + 120_000),
            nextSessionTokenHash: "next-session-hash",
            refreshTokenHash: "current-refresh-hash",
        });

        expect(result).toEqual({ sessionPublicId: "session-public-id", status: "invalid", userId: 20 });
        expect(calls.some((call) => call.method === "insertInto" && call.args[0] === "sec_refresh_token")).toBe(false);
    });

    it("no trata como reuso un refresh revocado por logout del usuario", async () => {
        const refreshRow = {
            refreshTokenId: 1,
            refreshStatus: "revoked",
            refreshRevokedReason: "logout_requested",
            refreshExpiresAt: new Date(Date.now() + 60_000),
            refreshFamilyId: "refresh-family",
            sessionId: 10,
            sessionStatus: "revoked",
            sessionExpiresAt: new Date(Date.now() + 60_000),
            sessionPublicId: "session-public-id",
            sessionPermissionVersion: 1,
            userId: 20,
            userPermissionVersion: 1,
            userStatus: "active",
            identityStatus: "active",
        };
        const { builder, calls } = createQueryBuilder([], [refreshRow]);
        const repository = createRepository(builder);

        const result = await repository.rotateRefreshSession({
            nextRefreshExpiresAt: new Date(Date.now() + 120_000),
            nextRefreshTokenHash: "next-refresh-hash",
            nextSessionExpiresAt: new Date(Date.now() + 120_000),
            nextSessionTokenHash: "next-session-hash",
            refreshTokenHash: "current-refresh-hash",
        });

        expect(result).toEqual({ sessionPublicId: "session-public-id", status: "invalid", userId: 20 });
        expect(calls.some((call) => call.method === "selectFrom" && call.args[0] === "sec_auth_session")).toBe(false);
    });

    it("no trata como reuso un refresh revocado por cierre de una sesion propia", async () => {
        const refreshRow = {
            refreshTokenId: 1,
            refreshStatus: "revoked",
            refreshRevokedReason: "user_session_revoke",
            refreshExpiresAt: new Date(Date.now() + 60_000),
            refreshFamilyId: "refresh-family",
            sessionId: 10,
            sessionStatus: "revoked",
            sessionExpiresAt: new Date(Date.now() + 60_000),
            sessionPublicId: "session-public-id",
            sessionPermissionVersion: 1,
            userId: 20,
            userPermissionVersion: 1,
            userStatus: "active",
            identityStatus: "active",
        };
        const { builder, calls } = createQueryBuilder([], [refreshRow]);
        const repository = createRepository(builder);

        const result = await repository.rotateRefreshSession({
            nextRefreshExpiresAt: new Date(Date.now() + 120_000),
            nextRefreshTokenHash: "next-refresh-hash",
            nextSessionExpiresAt: new Date(Date.now() + 120_000),
            nextSessionTokenHash: "next-session-hash",
            refreshTokenHash: "current-refresh-hash",
        });

        expect(result).toEqual({ sessionPublicId: "session-public-id", status: "invalid", userId: 20 });
        expect(calls.some((call) => call.method === "selectFrom" && call.args[0] === "sec_auth_session")).toBe(false);
    });

    it("no trata como reuso un refresh ya marcado como expirado", async () => {
        const refreshRow = {
            refreshTokenId: 1,
            refreshStatus: "expired",
            refreshRevokedReason: "expired",
            refreshExpiresAt: new Date(Date.now() - 60_000),
            refreshFamilyId: "refresh-family",
            sessionId: 10,
            sessionStatus: "revoked",
            sessionExpiresAt: new Date(Date.now() - 60_000),
            sessionPublicId: "session-public-id",
            sessionPermissionVersion: 1,
            userId: 20,
            userPermissionVersion: 1,
            userStatus: "active",
            identityStatus: "active",
        };
        const { builder, calls } = createQueryBuilder([], [refreshRow]);
        const repository = createRepository(builder);

        const result = await repository.rotateRefreshSession({
            nextRefreshExpiresAt: new Date(Date.now() + 120_000),
            nextRefreshTokenHash: "next-refresh-hash",
            nextSessionExpiresAt: new Date(Date.now() + 120_000),
            nextSessionTokenHash: "next-session-hash",
            refreshTokenHash: "current-refresh-hash",
        });

        expect(result).toEqual({ sessionPublicId: "session-public-id", status: "invalid", userId: 20 });
        expect(calls.some((call) => call.method === "selectFrom" && call.args[0] === "sec_auth_session")).toBe(false);
    });

    it("no extiende el vencimiento absoluto de 8 horas al rotar refresh token", async () => {
        const absoluteSessionExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
        const proposedExtendedExpiration = new Date(absoluteSessionExpiresAt.getTime() + 4 * 60 * 60 * 1000);
        const refreshRow = {
            refreshTokenId: 1,
            refreshStatus: "active",
            refreshExpiresAt: absoluteSessionExpiresAt,
            refreshFamilyId: "refresh-family",
            sessionId: 10,
            sessionStatus: "active",
            sessionExpiresAt: absoluteSessionExpiresAt,
            sessionPublicId: "session-public-id",
            sessionPermissionVersion: 1,
            userId: 20,
            userPermissionVersion: 1,
            userStatus: "active",
            identityStatus: "active",
        };
        const { builder, calls } = createQueryBuilder([], [refreshRow, { numUpdatedRows: 1n }, { numUpdatedRows: 1n }, {}]);
        const repository = createRepository(builder);

        const result = await repository.rotateRefreshSession({
            nextRefreshExpiresAt: proposedExtendedExpiration,
            nextRefreshTokenHash: "next-refresh-hash",
            nextSessionExpiresAt: proposedExtendedExpiration,
            nextSessionTokenHash: "next-session-hash",
            refreshTokenHash: "current-refresh-hash",
        });

        const sessionUpdate = readSetAfterUpdateTable(calls, "sec_auth_session");
        const refreshInsert = readValuesAfterInsertInto(calls, "sec_refresh_token");

        expect(result).toEqual({ refreshExpiresAt: absoluteSessionExpiresAt, sessionExpiresAt: absoluteSessionExpiresAt, sessionPublicId: "session-public-id", status: "rotated", userId: 20 });
        expect(new Date(sessionUpdate.expires_at_auth_session as Date).toISOString()).toBe(absoluteSessionExpiresAt.toISOString());
        expect(new Date(refreshInsert.expires_at_refresh_token as Date).toISOString()).toBe(absoluteSessionExpiresAt.toISOString());
    });

    it("revalida la version de permisos de la sesion al rotar un refresh vigente", async () => {
        const absoluteSessionExpiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
        const proposedExpiresAt = new Date(Date.now() + 120_000);
        const refreshRow = {
            authIdentityId: 30,
            providerCode: "local",
            refreshTokenId: 1,
            refreshStatus: "active",
            refreshExpiresAt: absoluteSessionExpiresAt,
            refreshFamilyId: "refresh-family",
            sessionId: 10,
            sessionStatus: "active",
            sessionExpiresAt: absoluteSessionExpiresAt,
            sessionPublicId: "session-public-id",
            sessionPermissionVersion: 2,
            userId: 20,
            userPermissionVersion: 3,
            userStatus: "active",
            identityStatus: "active",
        };
        const { builder, calls } = createQueryBuilder([], [refreshRow, { numUpdatedRows: 1n }, { numUpdatedRows: 1n }, {}]);
        const repository = createRepository(builder);

        const result = await repository.rotateRefreshSession({
            nextRefreshExpiresAt: proposedExpiresAt,
            nextRefreshTokenHash: "next-refresh-hash",
            nextSessionExpiresAt: proposedExpiresAt,
            nextSessionTokenHash: "next-session-hash",
            refreshTokenHash: "current-refresh-hash",
        });

        const sessionUpdate = readSetAfterUpdateTable(calls, "sec_auth_session");

        expect(result).toEqual({ authIdentityId: 30, providerCode: "local", refreshExpiresAt: proposedExpiresAt, sessionExpiresAt: proposedExpiresAt, sessionPublicId: "session-public-id", status: "rotated", userId: 20 });
        expect(sessionUpdate.permission_version_auth_session).toBe(3);
        expect(calls.some((call) => call.method === "insertInto" && call.args[0] === "sec_refresh_token")).toBe(true);
    });

    it("no actualiza la clave si otra peticion ya consumio el token de reset", async () => {
        const resetRow = {
            authIdentityId: 10,
            identityStatus: "active",
            resetExpiresAt: new Date(Date.now() + 60_000),
            resetTokenId: 100,
            resetStatus: "active",
            userId: 20,
            userStatus: "active",
        };
        const { builder, calls } = createQueryBuilder([], [resetRow, { numUpdatedRows: 0n }]);
        const repository = createRepository(builder);

        const result = await repository.completeLocalPasswordReset({
            passwordHash: "argon2-hash",
            tokenHash: "reset-token-hash",
            ipAddress: "127.0.0.1",
            userAgent: "vitest",
        });

        expect(result).toEqual({ status: "invalid" });
        expect(calls.some((call) => call.method === "updateTable" && call.args[0] === "sec_auth_identity")).toBe(false);
        expect(calls.some((call) => call.method === "insertInto" && call.args[0] === "audit_security_event")).toBe(false);
    });
});
