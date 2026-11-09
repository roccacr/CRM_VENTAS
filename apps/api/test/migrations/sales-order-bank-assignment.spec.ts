import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { salesOrderBankAssignmentDdl, salesOrderBankAssignmentMigration } from "../../migrations/schema-only/202611030069_sales_order_bank_assignment.js";
import { anyOf } from "../support/throws.js";

function fixture(options: { destination?: string; drift?: boolean; missingParent?: boolean; failCreate?: boolean } = {}) {
    const queries: CompiledQuery[] = [];
    let definition: string | undefined = options.drift ? "CREATE TABLE crm_sales_order_bank_assignment (wrong INT)" : undefined;
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
            if (query.sql.startsWith("CREATE TABLE")) {
                if (failCreate) {
                    failCreate = false;
                    return Promise.reject(new Error("DDL interrupted"));
                }
                definition = query.sql;
            }
            return Promise.resolve({ rows: rows as R[] });
        };
        return connection;
    };
    return { queries, db: new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (db) => new MysqlIntrospector(db), createQueryCompiler: () => new MysqlQueryCompiler() } }) };
}

describe("central sales-order bank assignment schema", () => {
    it("defines canonical identity, restrictive parents, version and column comments", () => {
        expect(salesOrderBankAssignmentDdl).toContain("PRIMARY KEY (source_bank_assignment,order_id_bank_assignment)");
        expect(salesOrderBankAssignmentDdl).toContain("CHECK (source_bank_assignment IN ('native','legacy'))");
        expect(salesOrderBankAssignmentDdl.match(/FOREIGN KEY/g)).toHaveLength(3);
        expect(salesOrderBankAssignmentDdl.match(/COMMENT '/g)).toHaveLength(7);
        expect(salesOrderBankAssignmentDdl).not.toContain("IF NOT EXISTS");
    });
    it("creates once and validates the complete shape on retry without DML", async () => {
        const f = fixture();
        await salesOrderBankAssignmentMigration.up(f.db);
        await salesOrderBankAssignmentMigration.up(f.db);
        expect(f.queries.filter((q) => q.sql.startsWith("CREATE TABLE"))).toHaveLength(1);
        expect(f.queries.some((q) => /^(INSERT|UPDATE|DELETE|ALTER)/.test(q.sql))).toBe(false);
        await f.db.destroy();
    });
    it.each([{ destination: "crmdatabase-api" }, { drift: true }, { missingParent: true }])("rejects preflight %j before DDL", async (options) => {
        const f = fixture(options);
        await expect(salesOrderBankAssignmentMigration.up(f.db)).rejects.toThrow(anyOf("Banks schema destination mismatch", "Bank assignment schema drift; reconcile explicitly before retry", "Bank assignment requires native InnoDB parent tables"));
        expect(f.queries.some((q) => q.sql.startsWith("CREATE TABLE"))).toBe(false);
        await f.db.destroy();
    });
    it("can retry an interrupted DDL without silently adopting drift", async () => {
        const f = fixture({ failCreate: true });
        await expect(salesOrderBankAssignmentMigration.up(f.db)).rejects.toThrow("DDL interrupted");
        await expect(salesOrderBankAssignmentMigration.up(f.db)).resolves.toBeUndefined();
        await f.db.destroy();
    });
});
