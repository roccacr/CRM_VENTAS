import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { expect, it } from "vitest";

import { leadQualificationMigration, planLeadQualification, runLeadQualification } from "../../migrations/schema-only/202611030073_lead_qualification.js";
import { parseLegacyLeadQualificationArgs } from "../../scripts/migrate-legacy-lead-qualification.js";
import { selectSchemaMigrations } from "../../scripts/run-schema-migrations.js";
function fixture(source: "native" | "legacy", column?: object, constraint?: string, schema?: string) {
    const schemaName = schema ?? (source === "native" ? "CRM_THINK_V2" : "crmdatabase-api");
    const queries: CompiledQuery[] = [];
    let rejectDDL = false;
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        // Dispatch SQL fixture responses; branches model metadata and failures, not business policy.
        // eslint-disable-next-line complexity
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            if (rejectDDL && query.sql.startsWith("ALTER TABLE")) return Promise.reject(new Error("DDL rejected"));
            let rows: object[] = [];
            if (query.sql.includes("SELECT @@SESSION.lock_wait_timeout")) rows = [{ timeout: 31536000 }];
            if (query.sql.includes("SELECT @@SESSION.restrict_fk_on_non_standard_key")) rows = [{ restricted: 1, checks: 1 }];
            if (query.sql.includes("SELECT DATABASE()")) rows = [{ name: schemaName }];
            if (query.sql.includes("information_schema.TABLES")) rows = [{ engine: "InnoDB", kind: "BASE TABLE" }];
            if (query.sql.includes("information_schema.COLUMNS")) rows = column ? [column] : [];
            if (query.sql.includes("information_schema.CHECK_CONSTRAINTS")) rows = constraint ? [{ clause: constraint, enforced: "YES" }] : [];
            return Promise.resolve({ rows: rows as R[] });
        };
        return connection;
    };
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => driver, createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return {
        db,
        queries,
        failDDL: () => {
            rejectDDL = true;
        },
    };
}
it.each(["native", "legacy"] as const)("planifica solo columna y restricción en %s", async (source) => {
    const f = fixture(source);
    try {
        const statements = await planLeadQualification(f.db, source);
        expect(statements).toHaveLength(2);
        expect(statements[0]).toContain("TINYINT(1) NOT NULL DEFAULT 0");
        expect(statements[0]).toContain(source === "native" ? "`crm_lead`" : "`leads`");
        expect(statements[0]).toContain("ALGORITHM=INSTANT");
        expect(statements[1]).toContain("IN (0,1)");
        expect(statements.every((statement) => statement.startsWith("ALTER TABLE"))).toBe(true);
    } finally {
        await f.db.destroy();
    }
});
it.each(["native", "legacy"] as const)("es idempotente y conserva valores en %s", async (source) => {
    const field = source === "native" ? "is_qualified_lead" : "calificado_lead";
    const f = fixture(source, { type: "tinyint(1)", nullable: "NO", defaultValue: "0", extra: "" }, `(${field} in (0,1))`);
    try {
        expect(await planLeadQualification(f.db, source)).toEqual([]);
    } finally {
        await f.db.destroy();
    }
});
it.each([{ type: "text" }, { nullable: "YES" }, { defaultValue: "1" }, { extra: "INVISIBLE" }])("rechaza drift %j", async (change) => {
    const f = fixture("native", { type: "tinyint(1)", nullable: "NO", defaultValue: "0", extra: "", ...change });
    try {
        await expect(planLeadQualification(f.db, "native")).rejects.toThrow("drift");
    } finally {
        await f.db.destroy();
    }
});
it("rechaza otro esquema sin planificar DDL", async () => {
    const f = fixture("native", undefined, undefined, "crmdatabase-api");
    try {
        await expect(planLeadQualification(f.db, "native")).rejects.toThrow("destination");
        expect(f.queries).toHaveLength(1);
    } finally {
        await f.db.destroy();
    }
});
it("registra 073 para ejecutar únicamente esta migración", () => {
    expect(selectSchemaMigrations(leadQualificationMigration.name)).toEqual([leadQualificationMigration]);
});

it("no permite aplicar legacy con argumentos ambiguos", () => {
    expect(parseLegacyLeadQualificationArgs(["--plan"])).toBe(false);
    expect(parseLegacyLeadQualificationArgs(["--apply=crmdatabase-api"])).toBe(true);
    expect(() => parseLegacyLeadQualificationArgs([])).toThrow();
    expect(() => parseLegacyLeadQualificationArgs(["--apply"])).toThrow();
    expect(() => parseLegacyLeadQualificationArgs(["--apply=CRM_THINK_V2"])).toThrow();
});

it("compatibilidad legacy es solo de sesión y conserva las FK", async () => {
    const f = fixture("legacy");
    try {
        await runLeadQualification(f.db, "legacy", true);
        const statements = f.queries.map((query) => query.sql);
        expect(statements).toContain("SET SESSION restrict_fk_on_non_standard_key=OFF");
        const restore = f.queries.find((query) => query.sql === "SET SESSION restrict_fk_on_non_standard_key=?");
        expect(restore?.parameters).toEqual([1]);
        expect(statements.some((query) => /SET GLOBAL|SET.*foreign_key_checks|DROP.*(INDEX|FOREIGN)/i.test(query))).toBe(false);
        expect(statements.filter((query) => query.startsWith("ALTER TABLE"))).toHaveLength(2);
    } finally {
        await f.db.destroy();
    }
});
it("restaura ambas variables de sesión incluso si falla DDL", async () => {
    const f = fixture("legacy");
    f.failDDL();
    try {
        await expect(runLeadQualification(f.db, "legacy", true)).rejects.toThrow("DDL rejected");
        expect(f.queries.find((query) => query.sql === "SET SESSION restrict_fk_on_non_standard_key=?")?.parameters).toEqual([1]);
        expect(f.queries.at(-1)?.sql).toBe("SET SESSION lock_wait_timeout=?");
        expect(f.queries.at(-1)?.parameters).toEqual([31536000]);
    } finally {
        await f.db.destroy();
    }
});
