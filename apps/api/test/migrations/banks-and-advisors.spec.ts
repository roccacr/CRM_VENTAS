import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { banksAndAdvisorsMigration } from "../../migrations/schema-only/202611030068_banks_and_advisors.js";
import { assertBankSchemaDestination, bankTableDefinitions, normalizeBankDdl, planBankTables } from "../../migrations/schema-only/banks-schema.js";
import { parseLegacyBanksArgs, runLegacyBanks } from "../../scripts/migrate-legacy-banks.js";

function fixture(options: { database?: string; foldNames?: number; actor?: boolean; drift?: boolean; failAudit?: boolean; inactiveGrant?: boolean } = {}) {
    const queries: CompiledQuery[] = [];
    const driver = new DummyDriver();
    const transactionEvents: string[] = [];
    driver.beginTransaction = () => {
        transactionEvents.push("begin");
        return Promise.resolve();
    };
    driver.commitTransaction = () => {
        transactionEvents.push("commit");
        return Promise.resolve();
    };
    driver.rollbackTransaction = () => {
        transactionEvents.push("rollback");
        return Promise.resolve();
    };
    const definitions = new Map<string, string>();
    const permissions: object[] = [];
    const grants: { role: number; code: string; status: string }[] = options.inactiveGrant ? [{ role: 1, code: "ventas.catalog_bank.read", status: "inactive" }] : [];
    const securityTables = ["sec_permission", "sec_role", "sec_role_permission", "sec_user", "sec_user_role", "audit_security_event"].map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "InnoDB" }));
    function readTables(query: CompiledQuery): object[] {
        if (query.parameters.includes("sec_permission")) return securityTables;
        if (options.drift) return [{ table_name: "crm_bank", table_type: "VIEW", engine: null, collation: null }];
        return [...definitions.keys()].map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "InnoDB", collation: "utf8mb4_unicode_ci" }));
    }
    function write(query: CompiledQuery): void {
        if (query.sql.startsWith("CREATE TABLE")) definitions.set(query.sql.split(" ")[2] ?? "", query.sql);
        if (query.sql.startsWith("INSERT INTO sec_permission")) {
            const [code, module, action, description, status] = query.parameters;
            permissions.push({ code, module, action, description, status });
        }
        if (query.sql.startsWith("INSERT INTO sec_role_permission")) grants.push({ role: query.parameters[0] as number, code: query.parameters[1] as string, status: "active" });
        if (query.sql.startsWith("INSERT INTO audit_security_event") && options.failAudit) throw new Error("audit unavailable");
    }
    function read(query: CompiledQuery): object[] {
        const inventory: [string, () => object[]][] = [
            ["SELECT DATABASE()", () => [{ name: options.database ?? "CRM_THINK_V2", fold_names: options.foldNames ?? 0 }]],
            ["information_schema.TABLES", () => readTables(query)],
            ["SHOW CREATE", () => [{ "Create Table": definitions.get(query.sql.includes("advisor") ? "crm_bank_advisor" : "crm_bank") }]],
            ["FROM sec_permission", () => [...permissions]],
            ["FROM sec_role_permission", () => [...grants]],
            ["FROM sec_role WHERE", () => ["owner", "jefe_general"].map((code, index) => ({ id: index + 1, code, status: "active", deleted: null }))],
            ["FROM sec_user u JOIN", () => (options.actor === false ? [] : [{ id: 1, publicId: "owner", name: "Owner" }])],
            ["GET_LOCK", () => [{ acquired: 1 }]],
        ];
        return inventory.find(([fragment]) => query.sql.includes(fragment))?.[1]() ?? [];
    }
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            write(query);
            return Promise.resolve({ rows: read(query) as R[] });
        };
        return connection;
    };
    return { queries, transactionEvents, db: new Kysely<unknown>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (db) => new MysqlIntrospector(db), createQueryCompiler: () => new MysqlQueryCompiler() } }) };
}

describe("bank schema and scoped migration", () => {
    it("defines identical canonical tables without silent adoption", () => {
        expect(bankTableDefinitions.map((definition) => definition.name)).toEqual(["crm_bank", "crm_bank_advisor"]);
        const ddl = bankTableDefinitions.map((definition) => definition.ddl).join(" ");
        expect(ddl).toContain("UNIQUE KEY uq_crm_bank_name (name_bank)");
        expect(ddl).toContain("UNIQUE KEY uq_crm_bank_advisor_email (bank_id_bank_advisor,email_bank_advisor)");
        expect(ddl).toContain("ON DELETE RESTRICT ON UPDATE RESTRICT");
        expect(ddl).not.toMatch(/IF NOT EXISTS|created_by|updated_by/);
    });
    it("preflights Owner before any DDL", async () => {
        const f = fixture({ actor: false });
        await expect(banksAndAdvisorsMigration.up(f.db)).rejects.toThrow("Owner");
        expect(f.queries.some((query) => query.sql.startsWith("CREATE"))).toBe(false);
        await f.db.destroy();
    });
    it("creates tables and only the twenty context permissions for the two roles", async () => {
        const f = fixture();
        await banksAndAdvisorsMigration.up(f.db);
        expect(f.queries.filter((query) => query.sql.startsWith("CREATE TABLE"))).toHaveLength(2);
        expect(f.queries.filter((query) => query.sql.startsWith("INSERT INTO sec_permission"))).toHaveLength(20);
        expect(f.queries.filter((query) => query.sql.startsWith("INSERT INTO sec_role_permission"))).toHaveLength(40);
        expect(f.queries.map((query) => query.sql).join(" ")).not.toMatch(/sec_user_permission_override|UPDATE sec_role |DELETE FROM|crmdatabase-api/);
        await f.db.destroy();
    });
    it("retries compatibly without new writes and preserves inactive grants", async () => {
        const f = fixture({ inactiveGrant: true });
        await banksAndAdvisorsMigration.up(f.db);
        expect(f.queries.filter((query) => query.sql.startsWith("INSERT INTO sec_role_permission"))).toHaveLength(39);
        const before = f.queries.length;
        await banksAndAdvisorsMigration.up(f.db);
        expect(f.queries.slice(before).filter((query) => /^(CREATE|INSERT|UPDATE)/.test(query.sql))).toEqual([]);
        await f.db.destroy();
    });
    it("rolls security DML back when audit fails", async () => {
        const f = fixture({ failAudit: true });
        await expect(banksAndAdvisorsMigration.up(f.db)).rejects.toThrow("audit unavailable");
        expect(f.transactionEvents).toEqual(["begin", "rollback"]);
        await f.db.destroy();
    });
    it("preserves literal content while comparing SHOW CREATE formatting", () => {
        const ddl = bankTableDefinitions[0].ddl;
        expect(normalizeBankDdl(ddl)).not.toBe(normalizeBankDdl(ddl.replace("'active'", "'ac tive'")));
        expect(normalizeBankDdl(ddl)).toBe(normalizeBankDdl(ddl.replace("BIGINT UNSIGNED", "bigint(20) unsigned").replace("DEFAULT 1", "DEFAULT '1'")));
    });
    it("rejects an incompatible existing table before creating the other one", async () => {
        const f = fixture({ drift: true });
        await expect(planBankTables(f.db, "CRM_THINK_V2")).rejects.toThrow("drift");
        expect(f.queries.some((query) => query.sql.startsWith("CREATE"))).toBe(false);
        await f.db.destroy();
    });
    it("legacy plan never writes and rejects the wrong destination", async () => {
        const f = fixture({ database: "crmdatabase-api" });
        expect(await runLegacyBanks(f.db, false)).toHaveLength(2);
        expect(f.queries.some((query) => query.sql.startsWith("CREATE"))).toBe(false);
        await f.db.destroy();
        const wrong = fixture();
        await expect(runLegacyBanks(wrong.db, true)).rejects.toThrow("destination");
        await wrong.db.destroy();
    });
    it("accepts case folding only when the server declares insensitive schema names", async () => {
        const sensitive = fixture({ database: "crm_think_v2", foldNames: 0 });
        await expect(assertBankSchemaDestination(sensitive.db, "CRM_THINK_V2")).rejects.toThrow("destination");
        await sensitive.db.destroy();
        const insensitive = fixture({ database: "crm_think_v2", foldNames: 1 });
        await expect(assertBankSchemaDestination(insensitive.db, "CRM_THINK_V2")).resolves.toBeUndefined();
        await insensitive.db.destroy();
    });
    it("accepts only the explicit legacy CLI modes", () => {
        expect(parseLegacyBanksArgs(["--plan"])).toBe(false);
        expect(parseLegacyBanksArgs(["--apply=crmdatabase-api"])).toBe(true);
        for (const args of [[], ["--apply"], ["--apply=CRM_THINK_V2"], ["--plan", "extra"]]) expect(() => parseLegacyBanksArgs(args)).toThrow("exactly");
    });
});
