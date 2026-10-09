import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { type Kysely, sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { schemaMigrations } from "../../scripts/run-schema-migrations.js";
import { validateEnv } from "../../src/config/env.validation.js";
import { DatabaseService } from "../../src/database/database.service.js";
import { getCatalogPermissionCodes } from "../../src/modules/crm/catalogs/catalogs.constants.js";

// Explicit opt-in; all migration writes remain inside a rolled-back transaction.
describe.skipIf(process.env.ADMINISTRATION_MYSQL_TESTS !== "1")("Administration Owner repair MySQL", () => {
    let database: DatabaseService;
    beforeAll(() => {
        config({ quiet: true });
        database = new DatabaseService(new ConfigService(validateEnv(process.env)));
    });
    afterAll(async () => {
        await database.onModuleDestroy();
    });

    it("repairs the relational graph without replacing Sistemas and invalidates Owner sessions", async () => {
        const migration = schemaMigrations.find((entry) => entry.name === "202610080008_administration_owner_repair");
        expect(migration).toBeDefined();
        if (!migration) throw new Error("Missing Administration repair");
        const rollback = new Error("rollback migration test");
        try {
            await database.db.transaction().execute(async (transaction) => {
                const sistemas = await transaction.selectFrom("sec_org_unit").selectAll().where("code_org_unit", "=", "sistemas").executeTakeFirstOrThrow();
                const owners = await transaction
                    .selectFrom("sec_user_role as ur")
                    .innerJoin("sec_role as r", "r.id_role", "ur.role_id_user_role")
                    .innerJoin("sec_user as u", "u.id_user", "ur.user_id_user_role")
                    .select(["u.id_user", "u.permission_version_user"])
                    .where("r.code_role", "=", "owner")
                    .where("r.status_role", "=", "active")
                    .where("r.deleted_at_role", "is", null)
                    .where("ur.status_user_role", "=", "active")
                    .where("ur.revoked_at_user_role", "is", null)
                    .where("u.status_user", "=", "active")
                    .where("u.deleted_at_user", "is", null)
                    .execute();
                expect(owners.length).toBeGreaterThan(0);
                const before = await transaction.selectFrom("sec_user").select(["id_user", "permission_version_user"]).execute();
                const orgUnitsBefore = await transaction.selectFrom("sec_org_unit").selectAll().execute();
                const permissionsBefore = await transaction.selectFrom("sec_permission").selectAll().execute();
                const sessionsBefore = await transaction.selectFrom("sec_auth_session").selectAll().execute();
                const grantsBefore = await transaction.selectFrom("sec_role_permission").selectAll().execute();
                const membershipsBefore = await transaction.selectFrom("sec_user_org_unit").selectAll().execute();
                const refreshBefore = await transaction.selectFrom("sec_refresh_token").selectAll().execute();
                let failAudit = true;
                const auditFailure = new Error("forced migration audit failure");
                const executor = transaction.withPlugin({
                    transformQuery(args) {
                        if (failAudit && args.node.kind === "RawNode" && args.node.sqlFragments.join("").includes("INSERT INTO audit_security_event")) throw auditFailure;
                        return args.node;
                    },
                    transformResult(args) {
                        return Promise.resolve(args.result);
                    },
                });
                const scoped = new Proxy(executor, {
                    get(target, property) {
                        if (property === "transaction")
                            return () => ({
                                execute: async (operation: (db: Kysely<unknown>) => Promise<void>) => {
                                    await sql`SAVEPOINT administration_repair`.execute(transaction);
                                    try {
                                        await operation(scoped as unknown as Kysely<unknown>);
                                        await sql`RELEASE SAVEPOINT administration_repair`.execute(transaction);
                                    } catch (error) {
                                        await sql`ROLLBACK TO SAVEPOINT administration_repair`.execute(transaction);
                                        throw error;
                                    }
                                },
                            });
                        const value: unknown = Reflect.get(target, property, target);
                        return typeof value === "function" ? (value.bind(target) as unknown) : value;
                    },
                });
                await expect(migration.up(scoped as unknown as Kysely<unknown>)).rejects.toBe(auditFailure);
                expect(await transaction.selectFrom("sec_user").select(["id_user", "permission_version_user"]).execute()).toEqual(before);
                expect(await transaction.selectFrom("sec_org_unit").selectAll().execute()).toEqual(orgUnitsBefore);
                expect(await transaction.selectFrom("sec_permission").selectAll().execute()).toEqual(permissionsBefore);
                expect(await transaction.selectFrom("sec_auth_session").selectAll().execute()).toEqual(sessionsBefore);
                expect(await transaction.selectFrom("sec_role_permission").selectAll().execute()).toEqual(grantsBefore);
                expect(await transaction.selectFrom("sec_user_org_unit").selectAll().execute()).toEqual(membershipsBefore);
                expect(await transaction.selectFrom("sec_refresh_token").selectAll().execute()).toEqual(refreshBefore);
                failAudit = false;
                for (let run = 1; run <= 2; run++) {
                    await migration.up(scoped as unknown as Kysely<unknown>);
                    const administration = await transaction.selectFrom("sec_org_unit").selectAll().where("code_org_unit", "=", "administration").executeTakeFirstOrThrow();
                    expect(administration.public_id_org_unit).not.toBe(sistemas.public_id_org_unit);
                    expect(administration.status_org_unit).toBe("active");
                    expect(await transaction.selectFrom("sec_org_unit").selectAll().where("code_org_unit", "=", "sistemas").executeTakeFirstOrThrow()).toEqual(sistemas);
                    const codes = getCatalogPermissionCodes();
                    const grants = await transaction.selectFrom("sec_role_permission as rp").innerJoin("sec_role as r", "r.id_role", "rp.role_id_role_permission").innerJoin("sec_permission as p", "p.id_permission", "rp.permission_id_role_permission").select("p.code_permission").where("r.code_role", "=", "owner").where("rp.status_role_permission", "=", "active").where("p.status_permission", "=", "active").where("p.code_permission", "in", codes).execute();
                    expect(grants.map((grant) => grant.code_permission).sort()).toEqual([...codes].sort());
                    for (const owner of owners) {
                        const memberships = await transaction.selectFrom("sec_user_org_unit").selectAll().where("user_id_user_org_unit", "=", owner.id_user).where("org_unit_id_user_org_unit", "=", administration.id_org_unit).where("status_user_org_unit", "=", "active").execute();
                        expect(memberships).toHaveLength(1);
                        expect(memberships[0]).toMatchObject({ membership_code_user_org_unit: "leader", scope_code_user_org_unit: "all_areas", revoked_at_user_org_unit: null });
                        const user = await transaction.selectFrom("sec_user").select("permission_version_user").where("id_user", "=", owner.id_user).executeTakeFirstOrThrow();
                        expect(user.permission_version_user).toBe(owner.permission_version_user + run);
                        expect(await transaction.selectFrom("sec_auth_session").select("id_auth_session").where("user_id_auth_session", "=", owner.id_user).where("status_auth_session", "=", "active").execute()).toEqual([]);
                        expect(await transaction.selectFrom("sec_refresh_token as rt").innerJoin("sec_auth_session as s", "s.id_auth_session", "rt.auth_session_id_refresh_token").select("rt.id_refresh_token").where("s.user_id_auth_session", "=", owner.id_user).where("rt.status_refresh_token", "=", "active").execute()).toEqual([]);
                    }
                }
                const nonOwners = before.filter((user) => !owners.some((owner) => owner.id_user === user.id_user));
                if (nonOwners.length > 0) {
                    expect(
                        await transaction
                            .selectFrom("sec_user")
                            .select(["id_user", "permission_version_user"])
                            .where(
                                "id_user",
                                "in",
                                nonOwners.map((user) => user.id_user),
                            )
                            .execute(),
                    ).toEqual(nonOwners);
                }
                for (const owner of owners) {
                    const audit = await transaction.selectFrom("audit_security_event").select("id_security_event").where("event_type_security_event", "=", "administration_owner_repaired").where("target_user_id_security_event", "=", owner.id_user).execute();
                    expect(audit.length).toBeGreaterThanOrEqual(2);
                }
                throw rollback;
            });
        } catch (error) {
            if (error !== rollback) throw error;
        }
    }, 60_000);
});
