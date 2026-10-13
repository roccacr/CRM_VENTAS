import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { validateEnv } from "../../src/config/env.validation.js";
import { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import { IdentityProfileRepository } from "../../src/modules/crm/identity/identity-profile.repository.js";
import { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";
import { EffectivePermissionService } from "../../src/modules/crm/permissions/effective-permission.service.js";

describe.skipIf(process.env.IDENTITY_ACCESS_MYSQL_TESTS !== "1")("Access replacement MySQL", () => {
    let database: DatabaseService;
    beforeAll(async () => {
        config({ quiet: true });
        database = new DatabaseService(new ConfigService(validateEnv(process.env)));
        await sql`SELECT 1`.execute(database.db);
    });
    afterAll(async () => {
        await database.onModuleDestroy();
    });

    const withRollback = async (run: (database: DatabaseService) => Promise<void>) => {
        const rollback = new Error("rollback access test");
        try {
            await database.db.transaction().execute(async (transaction) => {
                const scoped = new Proxy(transaction, {
                    get(target, property) {
                        if (property === "transaction")
                            return () => ({
                                execute: async (operation: (db: Transaction<CrmDatabase>) => Promise<unknown>) => {
                                    await sql`SAVEPOINT access_mutation`.execute(transaction);
                                    try {
                                        const result = await operation(scoped);
                                        await sql`RELEASE SAVEPOINT access_mutation`.execute(transaction);
                                        return result;
                                    } catch (error) {
                                        // InnoDB deadlocks remove savepoints; preserve the original failure.
                                        await sql`ROLLBACK TO SAVEPOINT access_mutation`.execute(transaction).catch(() => undefined);
                                        throw error;
                                    }
                                },
                            });
                        const value: unknown = Reflect.get(target, property, target);
                        return typeof value === "function" ? (value.bind(target) as unknown) : value;
                    },
                });
                await run({ db: scoped, onModuleDestroy: async () => {} });
                throw rollback;
            });
        } catch (error) {
            if (error !== rollback) throw error;
        }
    };

    for (const failAudit of [false, true]) {
        it(
            failAudit ? "rolls back access changes when audit fails" : "removes Owner authority and refreshes the retained session into current grants",
            async () => {
                await withRollback(async (service) => {
                    const currentDatabase = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(service.db);
                    expect(currentDatabase.rows[0]?.name).toBe("CRM_THINK_V2");
                    const replacementRoleCode = `access_${ulid().toLowerCase()}`;
                    await sql`INSERT INTO sec_role (code_role,name_role,description_role,status_role) VALUES (${replacementRoleCode},'Rollback access role','Authorization regression fixture','active')`.execute(service.db);
                    const owner = await service.db
                        .selectFrom("sec_user as u")
                        .innerJoin("sec_user_role as ur", "ur.user_id_user_role", "u.id_user")
                        .innerJoin("sec_role as r", "r.id_role", "ur.role_id_user_role")
                        .innerJoin("sec_auth_identity as i", "i.user_id_auth_identity", "u.id_user")
                        .select(["u.id_user", "u.public_id_user", "u.permission_version_user", "i.id_auth_identity", "i.provider_code_auth_identity"])
                        .where("r.code_role", "=", "owner")
                        .where("r.status_role", "=", "active")
                        .where("ur.status_user_role", "=", "active")
                        .where("ur.revoked_at_user_role", "is", null)
                        .where("u.status_user", "=", "active")
                        .where("u.deleted_at_user", "is", null)
                        .where("i.status_auth_identity", "=", "active")
                        .executeTakeFirstOrThrow();
                    const audit = new SecurityAuditService(service);
                    const sessions = new IdentitySessionRepository(service, audit);
                    const profiles = new IdentityProfileRepository(service, new EffectivePermissionService());
                    const permission = await service.db.selectFrom("sec_permission").select("id_permission").where("code_permission", "=", "user.view_list").where("status_permission", "=", "active").executeTakeFirstOrThrow();
                    await service.db
                        .insertInto("sec_user_permission_override")
                        .values({
                            user_id_user_permission_override: owner.id_user,
                            permission_id_user_permission_override: permission.id_permission,
                            effect_user_permission_override: "allow",
                            status_user_permission_override: "active",
                            reason_user_permission_override: "Owner downgrade fixture",
                            created_at_user_permission_override: new Date(),
                            created_by_user_id_user_permission_override: owner.id_user,
                            starts_at_user_permission_override: new Date(),
                            ends_at_user_permission_override: null,
                            revoked_at_user_permission_override: null,
                            revoked_by_user_id_user_permission_override: null,
                        })
                        .execute();
                    const token = ulid();
                    const refresh = ulid();
                    const expiresAt = new Date(Date.now() + 60_000);
                    await sessions.createSession({ authIdentityId: owner.id_auth_identity, userId: owner.id_user, permissionVersion: owner.permission_version_user, providerCode: owner.provider_code_auth_identity, sessionTokenHash: token, refreshTokenHash: refresh, refreshFamilyId: ulid(), sessionPublicId: ulid(), sessionExpiresAt: expiresAt, refreshExpiresAt: expiresAt });
                    const previouslyRevokedToken = ulid();
                    const previouslyRevokedRefresh = ulid();
                    await sessions.createSession({ authIdentityId: owner.id_auth_identity, userId: owner.id_user, permissionVersion: owner.permission_version_user, providerCode: owner.provider_code_auth_identity, sessionTokenHash: previouslyRevokedToken, refreshTokenHash: previouslyRevokedRefresh, refreshFamilyId: ulid(), sessionPublicId: ulid(), sessionExpiresAt: expiresAt, refreshExpiresAt: expiresAt });
                    await service.db.updateTable("sec_auth_session").set({ status_auth_session: "revoked", revoked_at_auth_session: new Date() }).where("token_hash_auth_session", "=", previouslyRevokedToken).execute();
                    const original = await profiles.findBySessionTokenHash(token);
                    if (!original) throw new Error("Owner session fixture did not resolve");
                    expect(original.roles.some((role) => role.code === "owner")).toBe(true);
                    const grantsBefore = await service.db.selectFrom("sec_role_permission").selectAll().execute();
                    const membershipsBefore = await service.db.selectFrom("sec_user_org_unit").selectAll().where("user_id_user_org_unit", "=", owner.id_user).execute();
                    const overridesBefore = await service.db.selectFrom("sec_user_permission_override").selectAll().where("user_id_user_permission_override", "=", owner.id_user).execute();
                    const failure = new Error("audit unavailable");
                    if (failAudit) vi.spyOn(audit, "record").mockRejectedValue(failure);
                    const repository = new IdentityAccessManagementRepository(service, audit, sessions);
                    const operation = repository.replaceUserAccess({ actorPublicId: owner.public_id_user, userPublicId: owner.public_id_user, roleCodes: [replacementRoleCode], orgUnitCodes: [], permissionOverrides: [], reason: "Owner downgrade regression" });
                    if (failAudit) {
                        await expect(operation).rejects.toBe(failure);
                        expect(await profiles.findBySessionTokenHash(token)).toMatchObject({ roles: original.roles, orgUnits: original.orgUnits, permissions: original.permissions, user: original.user });
                        expect(await sessions.findRefreshSessionForProviderValidation(refresh)).not.toBeNull();
                        expect(await service.db.selectFrom("sec_user_org_unit").selectAll().where("user_id_user_org_unit", "=", owner.id_user).execute()).toEqual(membershipsBefore);
                        expect(await service.db.selectFrom("sec_user_permission_override").selectAll().where("user_id_user_permission_override", "=", owner.id_user).execute()).toEqual(overridesBefore);
                    } else {
                        const result = await operation;
                        expect(result.roles.map((role) => role.code)).toEqual([replacementRoleCode]);
                        expect(result.orgUnits.map((unit) => unit.code)).toEqual([]);
                        expect(result.permissionOverrides).toEqual([]);
                        const removedOwnerRoles = await service.db.selectFrom("sec_user_role as ur").innerJoin("sec_role as r", "r.id_role", "ur.role_id_user_role").select(["ur.status_user_role", "ur.revoked_at_user_role"]).where("ur.user_id_user_role", "=", owner.id_user).where("r.code_role", "=", "owner").execute();
                        expect(removedOwnerRoles.every((role) => role.status_user_role === "inactive" && role.revoked_at_user_role !== null)).toBe(true);
                        expect(await profiles.findBySessionTokenHash(token)).toBeNull();
                        const oldSession = await service.db.selectFrom("sec_auth_session").select(["status_auth_session", "revoked_by_user_id_auth_session"]).where("token_hash_auth_session", "=", token).executeTakeFirstOrThrow();
                        expect(oldSession).toMatchObject({ status_auth_session: "active", revoked_by_user_id_auth_session: null });
                        expect(await sessions.findRefreshSessionForProviderValidation(refresh)).not.toBeNull();
                        const oldRefresh = await service.db.selectFrom("sec_refresh_token").select(["status_refresh_token", "revoked_reason_refresh_token"]).where("token_hash_refresh_token", "=", refresh).executeTakeFirstOrThrow();
                        expect(oldRefresh).toMatchObject({ status_refresh_token: "active", revoked_reason_refresh_token: null });
                        expect(await service.db.selectFrom("sec_refresh_token").select("status_refresh_token").where("token_hash_refresh_token", "=", previouslyRevokedRefresh).executeTakeFirstOrThrow()).toEqual({ status_refresh_token: "active" });
                        const freshToken = ulid();
                        expect(await sessions.rotateRefreshSession({ refreshTokenHash: refresh, nextRefreshExpiresAt: expiresAt, nextRefreshTokenHash: ulid(), nextSessionExpiresAt: expiresAt, nextSessionTokenHash: freshToken })).toMatchObject({ status: "rotated" });
                        expect(await profiles.findBySessionTokenHash(token)).toBeNull();
                        const fresh = await profiles.findBySessionTokenHash(freshToken);
                        expect(fresh?.roles.map((role) => role.code)).toEqual([replacementRoleCode]);
                        expect(fresh?.permissions.some((permission) => permission.code === "role.assign" || permission.code.startsWith("user.") || permission.code.startsWith("administration."))).toBe(false);
                        const events = await service.db.selectFrom("audit_security_event").select("id_security_event").where("event_type_security_event", "=", "user_access_replaced").where("target_user_id_security_event", "=", owner.id_user).where("reason_security_event", "=", "Owner downgrade regression").execute();
                        expect(events).toHaveLength(1);
                    }
                    expect(await service.db.selectFrom("sec_role_permission").selectAll().execute()).toEqual(grantsBefore);
                });
            },
            60_000,
        );
    }
});
