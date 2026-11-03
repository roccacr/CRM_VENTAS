import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { salesOrderBankAssignmentDdl } from "../../migrations/schema-only/202611030069_sales_order_bank_assignment.js";
import { salesOrderBankAssignmentUnlinkDdl, salesOrderBankAssignmentUnlinkMigration, salesOrderBankAssignmentUnlinkMysqlDdl } from "../../migrations/schema-only/202611030071_sales_order_bank_assignment_unlink.js";

function fixture(options: { destination?: string; drift?: boolean; missingParent?: boolean; failCreate?: boolean; final?: boolean; partial?: boolean; definition?: string } = {}) {
    const queries: CompiledQuery[] = [];
    let definition: string | undefined = options.definition ?? (options.drift ? "CREATE TABLE crm_sales_order_bank_assignment (wrong INT)" : options.final ? salesOrderBankAssignmentUnlinkDdl : options.partial ? salesOrderBankAssignmentDdl.replace("bank_id_bank_assignment BIGINT UNSIGNED NOT NULL", "bank_id_bank_assignment BIGINT UNSIGNED DEFAULT NULL") : salesOrderBankAssignmentDdl);
    let failCreate = options.failCreate;
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        const tableNames = () => [...(options.missingParent ? [] : ["crm_bank", "crm_bank_advisor", "sec_user"]), ...(definition ? ["crm_sales_order_bank_assignment"] : [])];
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            let rows: object[] = [];
            if (query.sql.includes("SELECT DATABASE()")) rows = [{ name: options.destination ?? "CRM_THINK_V2", fold_names: 0 }];
            if (query.sql.includes("information_schema.TABLES")) rows = tableNames().map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "InnoDB", collation: "utf8mb4_unicode_ci" }));
            if (query.sql.startsWith("SHOW CREATE")) rows = [{ "Create Table": definition }];
            if (query.sql.startsWith("ALTER TABLE")) {
                if (failCreate) {
                    failCreate = false;
                    return Promise.reject(new Error("DDL interrupted"));
                }
                definition = salesOrderBankAssignmentUnlinkDdl;
            }
            return Promise.resolve({ rows: rows as R[] });
        };
        return connection;
    };
    return { queries, db: new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (db) => new MysqlIntrospector(db), createQueryCompiler: () => new MysqlQueryCompiler() } }) };
}

describe("bank assignment unlink schema", () => {
    it("alters once and accepts the exact final shape on retry", async () => {
        const f = fixture();
        await salesOrderBankAssignmentUnlinkMigration.up(f.db);
        await salesOrderBankAssignmentUnlinkMigration.up(f.db);
        const alterations = f.queries.filter((q) => q.sql.startsWith("ALTER TABLE"));
        expect(alterations).toHaveLength(1);
        expect(alterations[0]?.sql).toContain("ADD CONSTRAINT ck_crm_order_bank_assignment_pair");
        expect(alterations[0]?.sql.match(/MODIFY COLUMN/g)).toHaveLength(2);
        expect(f.queries.some((q) => /^(INSERT|UPDATE|DELETE|DROP)/.test(q.sql))).toBe(false);
        await f.db.destroy();
    });
    it.each([{ destination: "crmdatabase-api" }, { drift: true }, { partial: true }])("rejects drift before ALTER %j", async (options) => {
        const f = fixture(options);
        await expect(salesOrderBankAssignmentUnlinkMigration.up(f.db)).rejects.toThrow();
        expect(f.queries.some((q) => q.sql.startsWith("ALTER TABLE"))).toBe(false);
        await f.db.destroy();
    });
    it.each([false, true])("accepts MySQL8.4 redundant column collations (final=%s)", async (final) => {
        const definition = (final ? salesOrderBankAssignmentUnlinkDdl : salesOrderBankAssignmentDdl).replace(/VARCHAR\((6|26)\)/g, "$& COLLATE utf8mb4_unicode_ci");
        const f = fixture({ definition });
        await expect(salesOrderBankAssignmentUnlinkMigration.up(f.db)).resolves.toBeUndefined();
        expect(f.queries.filter((query) => query.sql.startsWith("ALTER TABLE"))).toHaveLength(final ? 0 : 1);
        await f.db.destroy();
    });
    it.each(["utf8mb4_0900_ai_ci", "utf8mb4_bin"])("rejects real collation drift %s", async (collation) => {
        const f = fixture({ definition: salesOrderBankAssignmentDdl.replace("VARCHAR(6)", `VARCHAR(6) COLLATE ${collation}`) });
        await expect(salesOrderBankAssignmentUnlinkMigration.up(f.db)).rejects.toThrow("schema drift");
        expect(f.queries.some((query) => query.sql.startsWith("ALTER TABLE"))).toBe(false);
        await f.db.destroy();
    });
    it("accepts exact MySQL final CHECK ordering and redundant column collations without ALTER", async () => {
        const definition = salesOrderBankAssignmentUnlinkMysqlDdl.replace(/VARCHAR\((6|26)\)/g, "$& COLLATE utf8mb4_unicode_ci");
        expect(definition.indexOf("CONSTRAINT ck_crm_order_bank_assignment_pair")).toBeLessThan(definition.indexOf("CONSTRAINT ck_crm_order_bank_assignment_source"));
        const f = fixture({ definition });
        await salesOrderBankAssignmentUnlinkMigration.up(f.db);
        await salesOrderBankAssignmentUnlinkMigration.up(f.db);
        expect(f.queries.some((query) => query.sql.startsWith("ALTER TABLE"))).toBe(false);
        await f.db.destroy();
    });
    it("rejects collation drift in the MySQL final ordering", async () => {
        const f = fixture({ definition: salesOrderBankAssignmentUnlinkMysqlDdl.replace("VARCHAR(26)", "VARCHAR(26) COLLATE utf8mb4_bin") });
        await expect(salesOrderBankAssignmentUnlinkMigration.up(f.db)).rejects.toThrow("schema drift");
        expect(f.queries.some((query) => query.sql.startsWith("ALTER TABLE"))).toBe(false);
        await f.db.destroy();
    });
    it("does not normalize collation text inside comments or the table default", async () => {
        for (const definition of [salesOrderBankAssignmentDdl.replace("Origen canonico", "COLLATE utf8mb4_unicode_ci Origen canonico"), salesOrderBankAssignmentDdl.replace("COLLATE=utf8mb4_unicode_ci", "COLLATE=utf8mb4_bin")]) {
            const f = fixture({ definition });
            await expect(salesOrderBankAssignmentUnlinkMigration.up(f.db)).rejects.toThrow("schema drift");
            expect(f.queries.some((query) => query.sql.startsWith("ALTER TABLE"))).toBe(false);
            await f.db.destroy();
        }
    });
    it("recovers interruption before atomic DDL", async () => {
        const f = fixture({ failCreate: true });
        await expect(salesOrderBankAssignmentUnlinkMigration.up(f.db)).rejects.toThrow("DDL interrupted");
        await expect(salesOrderBankAssignmentUnlinkMigration.up(f.db)).resolves.toBeUndefined();
        await f.db.destroy();
    });
    it("recovers a completed DDL without repeating it", async () => {
        const f = fixture({ final: true });
        await salesOrderBankAssignmentUnlinkMigration.up(f.db);
        expect(f.queries.some((q) => q.sql.startsWith("ALTER TABLE"))).toBe(false);
        await f.db.destroy();
    });
});
