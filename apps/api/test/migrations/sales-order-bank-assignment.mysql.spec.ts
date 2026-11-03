import { Kysely, MysqlDialect, sql } from "kysely";
import { createPool } from "mysql2";
import { describe, expect, it } from "vitest";

import { salesOrderBankAssignmentMigration } from "../../migrations/schema-only/202611030069_sales_order_bank_assignment.js";

// Instancia QA aislada; no carga .env ni admite host/puerto configurables.
const enabled = process.env.RUN_BANK_ASSIGNMENT_MYSQL_QA === "3311";
describe.skipIf(!enabled)("bank assignment isolated MySQL3311", () => {
    it("applies, retries and enforces PK/source/FK without persisting business fixtures", async () => {
        const db = new Kysely<unknown>({ dialect: new MysqlDialect({ pool: createPool({ host: "127.0.0.1", port: 3311, user: "root", password: "", database: "CRM_THINK_V2", connectionLimit: 1 }) }) });
        try {
            await salesOrderBankAssignmentMigration.up(db);
            await salesOrderBankAssignmentMigration.up(db);
            await expect(
                db.transaction().execute(async (tx) => {
                    await sql`INSERT INTO crm_bank(public_id_bank,name_bank) VALUES ('01K8M000000000000000000031','QA asignacion')`.execute(tx);
                    const bank = (await sql<{ id: number }>`SELECT id_bank AS id FROM crm_bank WHERE public_id_bank='01K8M000000000000000000031'`.execute(tx)).rows[0]?.id;
                    await sql`INSERT INTO crm_bank_advisor(public_id_bank_advisor,bank_id_bank_advisor,name_bank_advisor,email_bank_advisor,phone_bank_advisor,area_bank_advisor) VALUES ('01K8M000000000000000000032',${bank},'QA','assignment@example.invalid','123','QA')`.execute(tx);
                    const advisor = (await sql<{ id: number }>`SELECT id_bank_advisor AS id FROM crm_bank_advisor WHERE public_id_bank_advisor='01K8M000000000000000000032'`.execute(tx)).rows[0]?.id;
                    const actor = (await sql<{ id: number }>`SELECT id_user AS id FROM sec_user ORDER BY id_user LIMIT 1`.execute(tx)).rows[0]?.id;
                    if (!bank || !advisor || !actor) throw new Error("QA parents missing");
                    const insert = (source: string, { bankId = bank, advisorId = advisor, userId = actor, orderId = "qa-order" } = {}) => sql`INSERT INTO crm_sales_order_bank_assignment(source_bank_assignment,order_id_bank_assignment,bank_id_bank_assignment,advisor_id_bank_assignment,changed_by_user_id_bank_assignment,changed_at_bank_assignment) VALUES (${source},${orderId},${bankId},${advisorId},${userId},UTC_TIMESTAMP(3))`.execute(tx);
                    await insert("native");
                    await expect(insert("native")).rejects.toThrow();
                    await insert("legacy");
                    await expect(insert("other")).rejects.toThrow();
                    await expect(insert("native", { bankId: 999999999, orderId: "qa-invalid-bank" })).rejects.toThrow();
                    await expect(insert("native", { advisorId: 999999999, orderId: "qa-invalid-advisor" })).rejects.toThrow();
                    await expect(insert("native", { userId: 999999999, orderId: "qa-invalid-actor" })).rejects.toThrow();
                    await expect(sql`DELETE FROM crm_bank_advisor WHERE id_bank_advisor=${advisor}`.execute(tx)).rejects.toThrow();
                    throw new Error("rollback assignment QA");
                }),
            ).rejects.toThrow("rollback assignment QA");
            expect((await sql<{ count: number }>`SELECT COUNT(*) AS count FROM crm_sales_order_bank_assignment WHERE order_id_bank_assignment='qa-order'`.execute(db)).rows[0]?.count).toBe(0);
        } finally {
            await db.destroy();
        }
    });
});
