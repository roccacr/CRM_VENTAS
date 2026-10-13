import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { sql, type Transaction } from "kysely";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { validateEnv } from "../../src/config/env.validation.js";
import { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { AuditChangeSet } from "../../src/modules/crm/audit/audit-change-set.js";
import { SecurityAuditService } from "../../src/modules/crm/audit/security-audit.service.js";
import { IdentityAccessManagementRepository } from "../../src/modules/crm/identity/identity-access-management.repository.js";
import { IdentitySessionRepository } from "../../src/modules/crm/identity/identity-session.repository.js";
import { IdentityUserDirectoryRepository } from "../../src/modules/crm/identity/identity-user-directory.repository.js";

describe.skipIf(process.env.AUDIT_MYSQL_TESTS !== "1")("identity changelog on CRM_THINK_V2 with rollback only", () => {
    let database: DatabaseService;
    beforeAll(() => {
        config({ quiet: true });
        database = new DatabaseService(new ConfigService(validateEnv(process.env)));
    });
    afterAll(async () => {
        await database.onModuleDestroy();
    });

    const withRollback = async (run: (fixture: { service: DatabaseService; actorPublicId: string; roleCodes: string[]; orgUnitCodes: string[]; permissionCode: string }) => Promise<void>) => {
        const rollback = new Error("Rollback identity audit fixtures");
        const actorPublicId = ulid();
        try {
            await database.db.transaction().execute(async (transaction) => {
                const current = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(transaction);
                expect(current.rows[0]?.name).toBe("CRM_THINK_V2");
                const scoped: Transaction<CrmDatabase> = new Proxy(transaction, {
                    get(target, property) {
                        if (property === "transaction")
                            return () => ({
                                execute: async (operation: (executor: Transaction<CrmDatabase>) => Promise<unknown>) => {
                                    await sql`SAVEPOINT identity_audit_operation`.execute(transaction);
                                    try {
                                        const result = await operation(scoped);
                                        await sql`RELEASE SAVEPOINT identity_audit_operation`.execute(transaction);
                                        return result;
                                    } catch (error) {
                                        await sql`ROLLBACK TO SAVEPOINT identity_audit_operation`.execute(transaction).catch(() => undefined);
                                        throw error;
                                    }
                                },
                            });
                        const value: unknown = Reflect.get(target, property, target);
                        return typeof value === "function" ? (value.bind(target) as unknown) : value;
                    },
                });
                const email = `${actorPublicId}@example.invalid`;
                await sql`INSERT INTO sec_user (public_id_user,email_user,normalized_email_user,display_name_user) VALUES (${actorPublicId},${email},${email},'Rollback actor')`.execute(transaction);
                const roleCodes = [ulid(), ulid(), ulid()].map((id) => `audit_${id}`);
                const orgUnitCodes = [ulid(), ulid()].map((id) => `audit_${id}`);
                for (const code of roleCodes) await sql`INSERT INTO sec_role (code_role,name_role,description_role,status_role) VALUES (${code},'Original role','Original description','active')`.execute(transaction);
                for (const code of orgUnitCodes) await sql`INSERT INTO sec_org_unit (public_id_org_unit,code_org_unit,name_org_unit,status_org_unit,sort_order_org_unit) VALUES (${ulid()},${code},'Rollback area','active',0)`.execute(transaction);
                const permissionCode = `audit.${ulid().toLowerCase()}.read`;
                await sql`INSERT INTO sec_permission (code_permission,module_code_permission,action_code_permission,status_permission) VALUES (${permissionCode},'user','read','active')`.execute(transaction);
                await run({ service: { db: scoped, onModuleDestroy: async () => {} }, actorPublicId, roleCodes, orgUnitCodes, permissionCode });
                throw rollback;
            });
        } catch (error) {
            if (error !== rollback) throw error;
        }
        expect(await database.db.selectFrom("sec_user").select("id_user").where("public_id_user", "=", actorPublicId).execute()).toEqual([]);
    };

    it.each(["update", "replaceUserAccess", "updateRole"] as const)(
        "preserves original actor roles and canonical references during self %s",
        async (method) => {
            await withRollback(async ({ service, actorPublicId, roleCodes, orgUnitCodes }) => {
                const roleCode = roleCodes[0] as string;
                const replacementCode = roleCodes[1] as string;
                const actor = await service.db.selectFrom("sec_user").select(["id_user", "email_user"]).where("public_id_user", "=", actorPublicId).executeTakeFirstOrThrow();
                const role = await service.db.selectFrom("sec_role").select("id_role").where("code_role", "=", roleCode).executeTakeFirstOrThrow();
                await sql`INSERT INTO sec_user_role (user_id_user_role,role_id_user_role,status_user_role) VALUES (${actor.id_user},${role.id_role},'active')`.execute(service.db);
                const audit = new SecurityAuditService(service);
                const directory = new IdentityUserDirectoryRepository(service, audit);
                const access = new IdentityAccessManagementRepository(service, audit, new IdentitySessionRepository(service, audit));
                const input = { actorPublicId: actorPublicId.toLowerCase(), userPublicId: actorPublicId.toLowerCase(), roleCodes: [replacementCode], orgUnitCodes: [orgUnitCodes[0] as string], permissionOverrides: [], reason: "Rollback self audit regression" };
                if (method === "update") await directory.update({ ...input, displayName: "Renamed self", email: actor.email_user, normalizedEmail: actor.email_user, roleCode: replacementCode, accessMethods: ["local"], externalReferences: [] });
                else if (method === "replaceUserAccess") await access.replaceUserAccess(input);
                else await access.updateRole({ actorPublicId: input.actorPublicId, code: roleCode.toUpperCase(), name: "Renamed own role", reason: input.reason });
                const row = await service.db.selectFrom("audit_security_event").select("metadata_security_event").where("actor_user_id_security_event", "=", actor.id_user).executeTakeFirstOrThrow();
                const metadata: unknown = typeof row.metadata_security_event === "string" ? JSON.parse(row.metadata_security_event) : row.metadata_security_event;
                expect(metadata).toMatchObject({
                    actor: { publicId: actorPublicId, name: "Rollback actor", roles: [{ code: roleCode, name: "Original role" }] },
                    moduleCode: "administration",
                    sectionCode: { update: "users", replaceUserAccess: "roles", updateRole: "roles" }[method],
                    changeSet: { entity: method === "updateRole" ? "role" : "user", recordId: method === "updateRole" ? roleCode : actorPublicId, action: "update", before: method === "updateRole" ? { name: "Original role" } : { roleCodes: [roleCode] }, after: method === "updateRole" ? { name: "Renamed own role" } : { roleCodes: [replacementCode] } },
                });
            });
        },
        60_000,
    );

    it("persists user create/edit/status/access and role rename/permissions/delete snapshots, with atomic failure rollback", async () => {
        await withRollback(async ({ service, actorPublicId, roleCodes, orgUnitCodes, permissionCode }) => {
            const roleCode = roleCodes[0] as string;
            const nextRoleCode = roleCodes[1] as string;
            const orgUnitCode = orgUnitCodes[0] as string;
            const nextOrgUnitCode = orgUnitCodes[1] as string;
            const audit = new SecurityAuditService(service);
            const directory = new IdentityUserDirectoryRepository(service, audit);
            const access = new IdentityAccessManagementRepository(service, audit, new IdentitySessionRepository(service, audit));
            const input = { actorPublicId, displayName: "Original person", email: `${ulid()}@example.invalid`, normalizedEmail: "", accessMethods: ["local"] as const, externalReferences: [], initialStatus: "active" as const, roleCode, roleCodes: [roleCode], orgUnitCodes: [orgUnitCode], reason: "Rollback identity audit regression" };
            input.normalizedEmail = input.email;
            const user = await directory.create(input);
            const userId = (await service.db.selectFrom("sec_user").select("id_user").where("public_id_user", "=", user.publicId).executeTakeFirstOrThrow()).id_user;
            const system = await service.db.selectFrom("int_external_system").select("id_external_system").where("code_external_system", "=", "netsuite").executeTakeFirst();
            if (!system) await sql`INSERT INTO int_external_system (code_external_system,name_external_system,status_external_system) VALUES ('netsuite','Rollback external system','active')`.execute(service.db);
            const reference = { systemCode: "netsuite" as const, externalUserId: ulid() };
            const update = { ...input, userPublicId: user.publicId, displayName: "Updated person", roleCode: nextRoleCode, roleCodes: [nextRoleCode], orgUnitCodes: [nextOrgUnitCode], externalReferences: [reference] };
            await directory.update(update);
            await directory.updateStatus({ actorPublicId, userPublicId: user.publicId, status: "inactive", reason: input.reason });
            await directory.updateStatus({ actorPublicId, userPublicId: user.publicId, status: "active", reason: input.reason });
            await access.replaceUserAccess({ actorPublicId, userPublicId: user.publicId, roleCodes: [roleCode], orgUnitCodes: [orgUnitCode], permissionOverrides: [{ code: permissionCode, effect: "deny" }], reason: input.reason });
            // An unrelated profile edit must retain the complete safe access snapshot.
            await directory.update({ ...update, roleCode, roleCodes: [roleCode], orgUnitCodes: [orgUnitCode] });
            await access.updateRole({ actorPublicId, code: nextRoleCode, name: "Updated role", description: "Updated description", reason: input.reason });
            await access.replaceRolePermissions({ actorPublicId, code: nextRoleCode, permissionCodes: [permissionCode], reason: input.reason });
            await access.deleteRole({ actorPublicId, code: nextRoleCode, reason: input.reason });
            const actor = await service.db.selectFrom("sec_user").select("id_user").where("public_id_user", "=", actorPublicId).executeTakeFirstOrThrow();
            const readEvents = async () => {
                const rows = await service.db.selectFrom("audit_security_event").select(["event_type_security_event as eventType", "metadata_security_event as metadata"]).where("actor_user_id_security_event", "=", actor.id_user).orderBy("id_security_event").execute();
                return rows.map((row) => ({ eventType: row.eventType, ...((typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata) as { changeSet: AuditChangeSet; actor: { publicId: string; name: string } }) }));
            };
            const events = await readEvents();
            const changeSets = events.map((event) => event.changeSet);
            expect(events).toHaveLength(9);
            expect(events.map((event) => event.actor)).toEqual(Array.from({ length: 9 }, () => ({ publicId: actorPublicId, name: "Rollback actor", roles: [] })));
            expect(events).toMatchObject(["users", "users", "users", "users", "roles", "users", "roles", "roles", "roles"].map((sectionCode) => ({ moduleCode: "administration", sectionCode })));
            expect(changeSets[0]).toMatchObject({ action: "create", recordId: user.publicId, before: null, after: { name: "Original person", roleCodes: [roleCode], orgUnitCodes: [orgUnitCode], accessMethods: [{ code: "local", status: "pending" }], externalReferences: [] } });
            expect(changeSets[1]).toMatchObject({ before: { roleCodes: [roleCode], orgUnitCodes: [orgUnitCode], externalReferences: [] }, after: { name: "Updated person", roleCodes: [nextRoleCode], orgUnitCodes: [nextOrgUnitCode], externalReferences: [{ systemCode: "netsuite", externalUserId: reference.externalUserId, externalUsername: input.email, status: "active" }] } });
            expect(changeSets[2]).toMatchObject({ action: "deactivate", before: { status: "active" }, after: { status: "inactive" }, changes: [{ field: "status", before: "active", after: "inactive" }] });
            expect(changeSets[3]).toMatchObject({ action: "reactivate", before: { status: "inactive" }, after: { status: "active" } });
            expect(changeSets[4]).toMatchObject({ before: { roleCodes: [nextRoleCode], orgUnitCodes: [nextOrgUnitCode], permissionOverrides: [] }, after: { roleCodes: [roleCode], orgUnitCodes: [orgUnitCode], permissionOverrides: [{ code: permissionCode, effect: "deny" }], accessMethods: [{ code: "local", status: "pending" }], externalReferences: [{ externalUserId: reference.externalUserId }] } });
            expect(changeSets[5]).toMatchObject({ before: { permissionOverrides: [{ code: permissionCode, effect: "deny" }] }, after: { permissionOverrides: [{ code: permissionCode, effect: "deny" }] } });
            expect(changeSets[6]).toMatchObject({ before: { name: "Original role", description: "Original description", permissionCodes: [] }, after: { name: "Updated role", description: "Updated description" } });
            expect(changeSets[7]).toMatchObject({ before: { permissionCodes: [] }, after: { permissionCodes: [permissionCode] } });
            expect(changeSets[8]).toMatchObject({ action: "delete", before: { deleted: false, permissionCodes: [permissionCode] }, after: { deleted: true, status: "inactive", permissionCodes: [permissionCode] } });
            expect(JSON.stringify(events)).not.toMatch(/password|token|secret|provider_subject/i);
            const beforeUser = await service.db.selectFrom("sec_user").selectAll().where("id_user", "=", userId).executeTakeFirstOrThrow();
            const beforeRoles = await service.db.selectFrom("sec_user_role").selectAll().where("user_id_user_role", "=", userId).execute();
            const beforeAreas = await service.db.selectFrom("sec_user_org_unit").selectAll().where("user_id_user_org_unit", "=", userId).execute();
            const beforeOverrides = await service.db.selectFrom("sec_user_permission_override").selectAll().where("user_id_user_permission_override", "=", userId).execute();
            const beforeReferences = await service.db.selectFrom("int_user_external_identity").selectAll().where("user_id_user_external_identity", "=", userId).execute();
            const beforeRole = await service.db.selectFrom("sec_role").selectAll().where("code_role", "=", roleCode).executeTakeFirstOrThrow();
            const beforePermissions = await service.db.selectFrom("sec_role_permission").selectAll().where("role_id_role_permission", "=", beforeRole.id_role).execute();
            const originalRecord = audit.record.bind(audit);
            vi.spyOn(audit, "record").mockImplementation(async (...args) => {
                await originalRecord(...args);
                throw new Error("Audit unavailable");
            });
            const failedEmail = `${ulid()}@example.invalid`;
            await expect(directory.create({ ...input, email: failedEmail, normalizedEmail: failedEmail })).rejects.toThrow("Audit unavailable");
            await expect(directory.update({ ...update, displayName: "Must roll back", roleCode, roleCodes: [roleCode], orgUnitCodes: [orgUnitCode] })).rejects.toThrow("Audit unavailable");
            await expect(directory.updateStatus({ actorPublicId, userPublicId: user.publicId, status: "inactive", reason: input.reason })).rejects.toThrow("Audit unavailable");
            await expect(access.replaceUserAccess({ actorPublicId, userPublicId: user.publicId, roleCodes: [], orgUnitCodes: [], permissionOverrides: [], reason: input.reason })).rejects.toThrow("Audit unavailable");
            await expect(access.updateRole({ actorPublicId, code: roleCode, name: "Must roll back", reason: input.reason })).rejects.toThrow("Audit unavailable");
            await expect(access.replaceRolePermissions({ actorPublicId, code: roleCode, permissionCodes: [permissionCode], reason: input.reason })).rejects.toThrow("Audit unavailable");
            const unusedRoleCode = roleCodes[2] as string;
            await expect(access.deleteRole({ actorPublicId, code: unusedRoleCode, reason: input.reason })).rejects.toThrow("Audit unavailable");
            expect(await service.db.selectFrom("sec_user").select("id_user").where("email_user", "=", failedEmail).execute()).toEqual([]);
            expect(await service.db.selectFrom("sec_role").select(["status_role", "deleted_at_role"]).where("code_role", "=", unusedRoleCode).executeTakeFirstOrThrow()).toEqual({ status_role: "active", deleted_at_role: null });
            expect(await service.db.selectFrom("sec_user").selectAll().where("id_user", "=", userId).executeTakeFirstOrThrow()).toEqual(beforeUser);
            expect(await service.db.selectFrom("sec_user_role").selectAll().where("user_id_user_role", "=", userId).execute()).toEqual(beforeRoles);
            expect(await service.db.selectFrom("sec_user_org_unit").selectAll().where("user_id_user_org_unit", "=", userId).execute()).toEqual(beforeAreas);
            expect(await service.db.selectFrom("sec_user_permission_override").selectAll().where("user_id_user_permission_override", "=", userId).execute()).toEqual(beforeOverrides);
            expect(await service.db.selectFrom("int_user_external_identity").selectAll().where("user_id_user_external_identity", "=", userId).execute()).toEqual(beforeReferences);
            expect(await service.db.selectFrom("sec_role").selectAll().where("code_role", "=", roleCode).executeTakeFirstOrThrow()).toEqual(beforeRole);
            expect(await service.db.selectFrom("sec_role_permission").selectAll().where("role_id_role_permission", "=", beforeRole.id_role).execute()).toEqual(beforePermissions);
            expect(await readEvents()).toEqual(events);
            await service.db.updateTable("sec_user").set({ display_name_user: "Renamed actor" }).where("id_user", "=", actor.id_user).execute();
            expect(await readEvents()).toEqual(events);
        });
    }, 60_000);
});
