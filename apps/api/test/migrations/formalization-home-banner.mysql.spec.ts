import { ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { type Kysely, sql } from "kysely";
import { ulid } from "ulid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { formalizationHomeBannerMigration } from "../../migrations/schema-only/202610200020_formalization_home_banner.js";
import { validateEnv } from "../../src/config/env.validation.js";
import { DatabaseService } from "../../src/database/database.service.js";

describe.skipIf(process.env.FORMALIZATION_MYSQL_TESTS !== "1")("Formalization banner permission (rollback only)", () => {
    let database: DatabaseService;
    beforeAll(() => {
        config({ quiet: true });
        database = new DatabaseService(new ConfigService(validateEnv(process.env)));
    });
    afterAll(async () => database.onModuleDestroy());

    async function verify(failAudit: boolean) {
        const rollback = new Error("rollback banner fixture");
        try {
            await database.db.transaction().execute(async (transaction) => {
                await sql`UPDATE sec_permission SET code_permission = ${`fixture-${ulid()}`} WHERE code_permission = 'formalizacion.home.approvals.read'`.execute(transaction);
                await sql`UPDATE sec_permission SET status_permission = 'active' WHERE code_permission = 'formalizacion.home.read'`.execute(transaction);
                const grants = await transaction.selectFrom("sec_role_permission").selectAll().execute();
                const versions = await transaction.selectFrom("sec_user").select(["id_user", "permission_version_user"]).execute();
                const executor = transaction.withPlugin({
                    transformQuery(args) {
                        if (failAudit && args.node.kind === "RawNode" && args.node.sqlFragments.join("").includes("INSERT INTO audit_security_event")) throw new Error("forced banner audit failure");
                        return args.node;
                    },
                    transformResult: (args) => Promise.resolve(args.result),
                });
                const scoped = new Proxy(executor, {
                    get(target, property) {
                        if (property === "transaction")
                            return () => ({
                                execute: async (operation: (db: Kysely<unknown>) => Promise<void>) => {
                                    await sql`SAVEPOINT banner_fixture`.execute(transaction);
                                    try {
                                        await operation(scoped as unknown as Kysely<unknown>);
                                        await sql`RELEASE SAVEPOINT banner_fixture`.execute(transaction);
                                    } catch (error) {
                                        await sql`ROLLBACK TO SAVEPOINT banner_fixture`.execute(transaction);
                                        throw error;
                                    }
                                },
                            });
                        const value: unknown = Reflect.get(target, property, target);
                        return typeof value === "function" ? (value.bind(target) as unknown) : value;
                    },
                });
                if (failAudit) {
                    await expect(formalizationHomeBannerMigration.up(scoped as unknown as Kysely<unknown>)).rejects.toThrow("forced banner audit failure");
                    expect(await transaction.selectFrom("sec_permission").select("code_permission").where("code_permission", "=", "formalizacion.home.approvals.read").execute()).toEqual([]);
                } else {
                    await formalizationHomeBannerMigration.up(scoped as unknown as Kysely<unknown>);
                    const audits = await transaction.selectFrom("audit_security_event").select("id_security_event").execute();
                    await formalizationHomeBannerMigration.up(scoped as unknown as Kysely<unknown>);
                    expect(await transaction.selectFrom("audit_security_event").select("id_security_event").execute()).toEqual(audits);
                    expect((await transaction.selectFrom("sec_permission").select("status_permission").where("code_permission", "=", "formalizacion.home.approvals.read").executeTakeFirstOrThrow()).status_permission).toBe("active");
                }
                expect((await transaction.selectFrom("sec_permission").select("status_permission").where("code_permission", "=", "formalizacion.home.read").executeTakeFirstOrThrow()).status_permission).toBe(failAudit ? "active" : "inactive");
                expect(await transaction.selectFrom("sec_role_permission").selectAll().execute()).toEqual(grants);
                expect(await transaction.selectFrom("sec_user").select(["id_user", "permission_version_user"]).execute()).toEqual(versions);
                throw rollback;
            });
        } catch (error) {
            if (error !== rollback) throw error;
        }
    }

    it("retires the page permission, adds only banner visibility and does not copy grants", async () => verify(false), 15000);
    it("rolls back both permission changes when audit fails", async () => verify(true), 15000);
});
