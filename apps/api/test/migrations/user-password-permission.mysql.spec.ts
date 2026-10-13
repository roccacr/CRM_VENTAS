import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { type Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { userAssignPasswordPermissionMigration } from "../../migrations/schema-only/202610130018_user_assign_password_permission.js";
import { validateEnv } from "../../src/config/env.validation.js";
import { DatabaseService } from "../../src/database/database.service.js";

describe.skipIf(process.env.PASSWORD_PERMISSION_MYSQL_TESTS !== "1")("Initial password permission migration (rollback only)", () => {
    let database: DatabaseService;
    beforeAll(() => {
        config({ quiet: true });
        database = new DatabaseService(new ConfigService(validateEnv(process.env)));
    });
    afterAll(async () => {
        await database.onModuleDestroy();
    });

    for (const failAudit of [false, true]) {
        it(`grants only Owner with atomic version/audit and idempotency (failure=${String(failAudit)})`, async () => {
            const rollback = new Error("rollback password permission test");
            try {
                await database.db.transaction().execute(async (transaction) => {
                    const current = await sql<{ name: string }>`SELECT DATABASE() AS name`.execute(transaction);
                    expect(current.rows[0]?.name).toBe("CRM_THINK_V2");
                    // Force grant creation even when the migration is already installed; rollback restores it.
                    await sql`UPDATE sec_role_permission rp INNER JOIN sec_role r ON r.id_role = rp.role_id_role_permission INNER JOIN sec_permission p ON p.id_permission = rp.permission_id_role_permission
                        SET rp.status_role_permission = 'inactive' WHERE r.code_role = 'owner' AND p.code_permission = 'user.assign_password' AND rp.status_role_permission = 'active'`.execute(transaction);
                    const beforeGrants = await transaction.selectFrom("sec_role_permission").selectAll().execute();
                    const beforePermissions = await transaction.selectFrom("sec_permission").selectAll().execute();
                    const beforeUsers = await transaction.selectFrom("sec_user").select(["id_user", "permission_version_user"]).execute();
                    const executor = transaction.withPlugin({
                        transformQuery(args) {
                            if (failAudit && args.node.kind === "RawNode" && args.node.sqlFragments.join("").includes("INSERT INTO audit_security_event")) throw new Error("forced password migration audit failure");
                            return args.node;
                        },
                        transformResult: (args) => Promise.resolve(args.result),
                    });
                    const scoped = new Proxy(executor, {
                        get(target, property) {
                            if (property === "transaction")
                                return () => ({
                                    execute: async (operation: (db: Kysely<unknown>) => Promise<void>) => {
                                        await sql`SAVEPOINT password_migration`.execute(transaction);
                                        try {
                                            await operation(scoped as unknown as Kysely<unknown>);
                                            await sql`RELEASE SAVEPOINT password_migration`.execute(transaction);
                                        } catch (error) {
                                            await sql`ROLLBACK TO SAVEPOINT password_migration`.execute(transaction);
                                            throw error;
                                        }
                                    },
                                });
                            const value: unknown = Reflect.get(target, property, target);
                            return typeof value === "function" ? (value.bind(target) as unknown) : value;
                        },
                    });
                    const migration = () => userAssignPasswordPermissionMigration.up(scoped as unknown as Kysely<unknown>);
                    if (failAudit) {
                        await expect(migration()).rejects.toThrow("forced password migration audit failure");
                        expect(await transaction.selectFrom("sec_role_permission").selectAll().execute()).toEqual(beforeGrants);
                        expect(await transaction.selectFrom("sec_permission").selectAll().execute()).toEqual(beforePermissions);
                        expect(await transaction.selectFrom("sec_user").select(["id_user", "permission_version_user"]).execute()).toEqual(beforeUsers);
                    } else {
                        await migration();
                        const recipients = await transaction.selectFrom("sec_role_permission as rp").innerJoin("sec_permission as p", "p.id_permission", "rp.permission_id_role_permission").innerJoin("sec_role as r", "r.id_role", "rp.role_id_role_permission").select("r.code_role").where("p.code_permission", "=", "user.assign_password").where("rp.status_role_permission", "=", "active").execute();
                        expect(recipients.map((row) => row.code_role)).toEqual(["owner"]);
                        const ownerHolders = await transaction.selectFrom("sec_user_role as ur").innerJoin("sec_role as r", "r.id_role", "ur.role_id_user_role").select("ur.user_id_user_role").where("r.code_role", "=", "owner").where("ur.status_user_role", "=", "active").where("ur.revoked_at_user_role", "is", null).execute();
                        const ids = new Set(ownerHolders.map((row) => row.user_id_user_role));
                        const afterUsers = await transaction.selectFrom("sec_user").select(["id_user", "permission_version_user"]).execute();
                        for (const user of afterUsers) expect(user.permission_version_user).toBe((beforeUsers.find((row) => row.id_user === user.id_user)?.permission_version_user ?? 0) + (ids.has(user.id_user) ? 1 : 0));
                        const auditRows = await transaction.selectFrom("audit_security_event").select("id_security_event").execute();
                        await migration();
                        expect(await transaction.selectFrom("sec_user").select(["id_user", "permission_version_user"]).execute()).toEqual(afterUsers);
                        expect(await transaction.selectFrom("audit_security_event").select("id_security_event").execute()).toEqual(auditRows);
                    }
                    throw rollback;
                });
            } catch (error) {
                if (error !== rollback) throw error;
            }
        }, 60_000);
    }
});
