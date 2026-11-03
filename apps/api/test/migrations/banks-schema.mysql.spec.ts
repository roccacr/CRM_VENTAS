import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { describe, expect, it } from "vitest";

import { banksAndAdvisorsMigration } from "../../migrations/schema-only/202611030068_banks_and_advisors.js";
import { planBankTables } from "../../migrations/schema-only/banks-schema.js";
import { runLegacyBanks } from "../../scripts/migrate-legacy-banks.js";
import { runSelectedSchemaMigrations } from "../../scripts/run-schema-migrations.js";

// Exclusivamente instancia QA preparada por el coordinador. Nunca toma credenciales ni host de .env.
const enabled = process.env.RUN_BANKS_MYSQL_QA === "3311";
const connect = (database: string) => new Kysely<unknown>({ dialect: new MysqlDialect({ pool: createPool({ host: "127.0.0.1", port: 3311, user: "root", password: "", database, connectionLimit: 1 }) }) });

describe.skipIf(!enabled)("banks isolated SQL QA on fixed loopback3311", () => {
    it("applies native068 and legacy, retries and enforces unique/FK/CHECK in both databases", async () => {
        await runSelectedSchemaMigrations(connect("CRM_THINK_V2"), [banksAndAdvisorsMigration]);
        const native = connect("CRM_THINK_V2");
        const legacy = connect("crmdatabase-api");
        try {
            const planned = await runLegacyBanks(legacy, false);
            expect([0, 2]).toContain(planned.length);
            expect(await runLegacyBanks(legacy, true)).toEqual(planned);
            expect(await runLegacyBanks(legacy, true)).toHaveLength(0);
            expect(await planBankTables(native, "CRM_THINK_V2")).toHaveLength(0);
            await banksAndAdvisorsMigration.up(native);
            const grants = (await sql<{ role: string; count: number }>`SELECT r.code_role AS role,COUNT(*) AS count FROM sec_role_permission rp JOIN sec_role r ON r.id_role=rp.role_id_role_permission JOIN sec_permission p ON p.id_permission=rp.permission_id_role_permission WHERE p.code_permission LIKE '%.catalog_bank.%' GROUP BY r.code_role ORDER BY r.code_role`.execute(native)).rows;
            expect(grants).toEqual([
                { role: "jefe_general", count: 20 },
                { role: "owner", count: 20 },
            ]);
            expect((await sql<{ count: number }>`SELECT COUNT(*) AS count FROM audit_security_event WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata_security_event,'$.migration'))='202611030068_banks_and_advisors'`.execute(native)).rows[0]?.count).toBe(1);
            for (const db of [native, legacy]) {
                await expect(
                    db.transaction().execute(async (tx) => {
                        await sql`INSERT INTO crm_bank(public_id_bank,name_bank) VALUES ('01K8M000000000000000000011','QA Banco Unico')`.execute(tx);
                        await expect(sql`INSERT INTO crm_bank(public_id_bank,name_bank) VALUES ('01K8M000000000000000000012','qa banco unico')`.execute(tx)).rejects.toThrow();
                        await expect(sql`INSERT INTO crm_bank(public_id_bank,name_bank,status_bank) VALUES ('01K8M000000000000000000013','QA Invalido','unknown')`.execute(tx)).rejects.toThrow();
                        await expect(sql`INSERT INTO crm_bank_advisor(public_id_bank_advisor,bank_id_bank_advisor,name_bank_advisor,email_bank_advisor,phone_bank_advisor,area_bank_advisor) VALUES ('01K8M000000000000000000021',999999,'QA','qa@example.invalid','123','QA')`.execute(tx)).rejects.toThrow();
                        await sql`INSERT INTO crm_bank_advisor(public_id_bank_advisor,bank_id_bank_advisor,name_bank_advisor,email_bank_advisor,phone_bank_advisor,area_bank_advisor) SELECT '01K8M000000000000000000022',id_bank,'QA','qa@example.invalid','123','QA' FROM crm_bank WHERE public_id_bank='01K8M000000000000000000011'`.execute(tx);
                        await expect(sql`INSERT INTO crm_bank_advisor(public_id_bank_advisor,bank_id_bank_advisor,name_bank_advisor,email_bank_advisor,phone_bank_advisor,area_bank_advisor) SELECT '01K8M000000000000000000023',id_bank,'QA','QA@example.invalid','123','QA' FROM crm_bank WHERE public_id_bank='01K8M000000000000000000011'`.execute(tx)).rejects.toThrow();
                        await expect(sql`DELETE FROM crm_bank WHERE public_id_bank='01K8M000000000000000000011'`.execute(tx)).rejects.toThrow();
                        throw new Error("rollback QA business fixtures");
                    }),
                ).rejects.toThrow("rollback QA business fixtures");
                expect((await sql<{ count: number }>`SELECT COUNT(*) AS count FROM crm_bank`.execute(db)).rows[0]?.count).toBe(0);
                expect((await sql<{ count: number }>`SELECT COUNT(*) AS count FROM crm_bank_advisor`.execute(db)).rows[0]?.count).toBe(0);
            }
        } finally {
            await native.destroy();
            await legacy.destroy();
        }
    });
});
