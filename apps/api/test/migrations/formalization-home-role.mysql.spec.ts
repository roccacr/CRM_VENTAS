import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { type Kysely, sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { formalizationHomeRoleMigration } from "../../migrations/schema-only/202610130017_formalization_home_role.js";
import { validateEnv } from "../../src/config/env.validation.js";
import { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import { IdentityProfileRepository } from "../../src/modules/crm/identity/identity-profile.repository.js";
import { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";
import { IdentityUserDirectoryRepository } from "../../src/modules/crm/identity/identity-user-directory.repository.js";
import { EffectivePermissionService } from "../../src/modules/crm/permissions/effective-permission.service.js";

describe.skipIf(process.env.FORMALIZATION_MYSQL_TESTS !== "1")("Formalization Home role MySQL (rollback only)", () => {
    let database: DatabaseService;
    beforeAll(async () => {
        config({ quiet: true });
        database = new DatabaseService(new ConfigService(validateEnv(process.env)));
        expect((await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(database.db)).rows[0]?.name).toBe("CRM_THINK_V2");
    });
    afterAll(async () => {
        await database.onModuleDestroy();
    });

    async function withRollback(run: (service: DatabaseService, migrationDb: Kysely<unknown>) => Promise<void>, failAudit = false) {
        const rollback = new Error("rollback Formalization fixture");
        try {
            await database.db.transaction().execute(async (transaction) => {
                const executor = transaction.withPlugin({
                    transformQuery(args) {
                        if (failAudit && args.node.kind === "RawNode" && args.node.sqlFragments.join("").includes("INSERT INTO audit_security_event")) throw new Error("forced Formalization audit failure");
                        return args.node;
                    },
                    transformResult: (args) => Promise.resolve(args.result),
                });
                const scoped = new Proxy(executor, {
                    get(target, property) {
                        if (property === "transaction")
                            return () => ({
                                execute: async (operation: (db: Transaction<CrmDatabase>) => Promise<unknown>) => {
                                    await sql`SAVEPOINT formalization_test`.execute(transaction);
                                    try {
                                        const result = await operation(scoped);
                                        await sql`RELEASE SAVEPOINT formalization_test`.execute(transaction);
                                        return result;
                                    } catch (error) {
                                        await sql`ROLLBACK TO SAVEPOINT formalization_test`.execute(transaction);
                                        throw error;
                                    }
                                },
                            });
                        const value: unknown = Reflect.get(target, property, target);
                        return typeof value === "function" ? (value.bind(target) as unknown) : value;
                    },
                });
                await run({ db: scoped, onModuleDestroy: async () => {} }, scoped as unknown as Kysely<unknown>);
                throw rollback;
            });
        } catch (error) {
            if (error !== rollback) throw error;
        }
    }

    it("creates only Home, is idempotent, and new users resolve only that permission", async () => {
        const userCount = await database.db
            .selectFrom("sec_user")
            .select(sql<number>`COUNT(*)`.as("count"))
            .executeTakeFirstOrThrow();
        await withRollback(async (service, migrationDb) => {
            const usersBefore = await service.db.selectFrom("sec_user").select(["id_user", "permission_version_user"]).execute();
            await formalizationHomeRoleMigration.up(migrationDb);
            const auditRows = await service.db.selectFrom("audit_security_event").select("id_security_event").execute();
            await formalizationHomeRoleMigration.up(migrationDb);
            expect(await service.db.selectFrom("audit_security_event").select("id_security_event").execute()).toEqual(auditRows);
            expect(await service.db.selectFrom("sec_user").select(["id_user", "permission_version_user"]).execute()).toEqual(usersBefore);
            const audit = new SecurityAuditService(service);
            const sessions = new IdentitySessionRepository(service, audit);
            const access = new IdentityAccessManagementRepository(service, audit, sessions);
            expect((await access.readRolePermissions("formalizacion")).permissionCodes).toEqual(["formalizacion.home.read"]);
            const owner = await service.db.selectFrom("sec_user as u").innerJoin("sec_user_role as ur", "ur.user_id_user_role", "u.id_user").innerJoin("sec_role as r", "r.id_role", "ur.role_id_user_role").select("u.public_id_user").where("r.code_role", "=", "owner").where("ur.status_user_role", "=", "active").where("ur.revoked_at_user_role", "is", null).where("u.status_user", "=", "active").executeTakeFirstOrThrow();
            const email = `formalization-${ulid().toLowerCase()}@example.test`;
            const created = await new IdentityUserDirectoryRepository(service, audit).create({ actorPublicId: owner.public_id_user, accessMethods: ["local"], displayName: "Formalization rollback fixture", email, normalizedEmail: email, roleCode: "formalizacion", roleCodes: ["formalizacion"], orgUnitCodes: ["formalizacion"], initialStatus: "active", reason: "Rollback verification of Home profile", externalReferences: [] });
            expect(created.roles.map((role) => role.code)).toEqual(["formalizacion"]);
            expect(created.orgUnit?.code).toBe("formalizacion");
            const user = await service.db.selectFrom("sec_user").selectAll().where("public_id_user", "=", created.publicId).executeTakeFirstOrThrow();
            const identity = await service.db.selectFrom("sec_auth_identity").select("id_auth_identity").where("user_id_auth_identity", "=", user.id_user).executeTakeFirstOrThrow();
            // Test-only active identity and opaque session, all rolled back; no password or real login.
            await service.db.updateTable("sec_auth_identity").set({ status_auth_identity: "active" }).where("id_auth_identity", "=", identity.id_auth_identity).execute();
            const token = ulid();
            await sessions.createSession({ authIdentityId: identity.id_auth_identity, userId: user.id_user, permissionVersion: user.permission_version_user, providerCode: "local", sessionTokenHash: token, refreshTokenHash: ulid(), refreshFamilyId: ulid(), sessionPublicId: ulid(), sessionExpiresAt: new Date(Date.now() + 60_000), refreshExpiresAt: new Date(Date.now() + 60_000) });
            const profile = await new IdentityProfileRepository(service, new EffectivePermissionService()).findBySessionTokenHash(token);
            expect(profile?.permissions.map((permission) => permission.code)).toEqual(["formalizacion.home.read"]);
            expect(profile?.orgUnits.map((unit) => unit.code)).toEqual(["formalizacion"]);
            const role = await service.db.selectFrom("sec_role").select("id_role").where("code_role", "=", "formalizacion").executeTakeFirstOrThrow();
            await service.db.updateTable("sec_role_permission").set({ status_role_permission: "inactive" }).where("role_id_role_permission", "=", role.id_role).execute();
            await formalizationHomeRoleMigration.up(migrationDb);
            expect((await service.db.selectFrom("sec_user").select("permission_version_user").where("id_user", "=", user.id_user).executeTakeFirstOrThrow()).permission_version_user).toBe(user.permission_version_user + 1);
            expect(await new IdentityProfileRepository(service, new EffectivePermissionService()).findBySessionTokenHash(token)).toBeNull();
        });
        expect(
            await database.db
                .selectFrom("sec_user")
                .select(sql<number>`COUNT(*)`.as("count"))
                .executeTakeFirstOrThrow(),
        ).toEqual(userCount);
    });

    it("refuses conflicting existing grants without overwriting them", async () => {
        await withRollback(async (service, migrationDb) => {
            await formalizationHomeRoleMigration.up(migrationDb);
            const role = await service.db.selectFrom("sec_role").select("id_role").where("code_role", "=", "formalizacion").executeTakeFirstOrThrow();
            const permission = await service.db.selectFrom("sec_permission").select("id_permission").where("code_permission", "=", "file.read").executeTakeFirstOrThrow();
            await service.db.insertInto("sec_role_permission").values({ role_id_role_permission: role.id_role, permission_id_role_permission: permission.id_permission, status_role_permission: "active", created_at_role_permission: new Date() }).execute();
            const grants = await service.db.selectFrom("sec_role_permission").selectAll().where("role_id_role_permission", "=", role.id_role).execute();
            await expect(formalizationHomeRoleMigration.up(migrationDb)).rejects.toThrow("non-Home grants");
            expect(await service.db.selectFrom("sec_role_permission").selectAll().where("role_id_role_permission", "=", role.id_role).execute()).toEqual(grants);
        });
    });

    it("rolls back role, permission and grants if audit fails", async () => {
        await withRollback(async (service, migrationDb) => {
            // Exercise the write path both before and after the migration has been installed.
            await sql`UPDATE sec_role_permission rp INNER JOIN sec_role r ON r.id_role = rp.role_id_role_permission
                SET rp.status_role_permission = 'inactive' WHERE r.code_role = 'formalizacion' AND rp.status_role_permission = 'active'`.execute(service.db);
            const roles = await service.db.selectFrom("sec_role").selectAll().execute();
            const permissions = await service.db.selectFrom("sec_permission").selectAll().execute();
            const grants = await service.db.selectFrom("sec_role_permission").selectAll().execute();
            const modules = await service.db.selectFrom("sec_org_unit").selectAll().execute();
            const versions = await service.db.selectFrom("sec_user").select(["id_user", "permission_version_user"]).execute();
            await expect(formalizationHomeRoleMigration.up(migrationDb)).rejects.toThrow("forced Formalization audit failure");
            expect(await service.db.selectFrom("sec_role").selectAll().execute()).toEqual(roles);
            expect(await service.db.selectFrom("sec_permission").selectAll().execute()).toEqual(permissions);
            expect(await service.db.selectFrom("sec_role_permission").selectAll().execute()).toEqual(grants);
            expect(await service.db.selectFrom("sec_org_unit").selectAll().execute()).toEqual(modules);
            expect(await service.db.selectFrom("sec_user").select(["id_user", "permission_version_user"]).execute()).toEqual(versions);
        }, true);
    });

    it("rejects a missing module with an existing Home grant instead of repairing without audit", async () => {
        await withRollback(async (service, migrationDb) => {
            await formalizationHomeRoleMigration.up(migrationDb);
            await service.db
                .updateTable("sec_org_unit")
                .set({ code_org_unit: `fixture-${ulid()}` })
                .where("code_org_unit", "=", "formalizacion")
                .execute();
            const modules = await service.db.selectFrom("sec_org_unit").selectAll().execute();
            await expect(formalizationHomeRoleMigration.up(migrationDb)).rejects.toThrow("module is missing");
            expect(await service.db.selectFrom("sec_org_unit").selectAll().execute()).toEqual(modules);
        });
    });
});
