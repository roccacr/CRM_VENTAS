import { readFile } from "node:fs/promises";

import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { recordAuditIdentifierCollationMigration } from "../../migrations/schema-only/202610220024_record_audit_identifier_collation.js";

const identityFields = ["source_schema_record", "entity_type_record", "source_table_record", "source_id_record"];
const columns = [
    ...identityFields.map((column_name) => ({ table_name: "audit_record", column_name, data_type: "varchar", character_maximum_length: column_name === "source_id_record" ? 191 : 64, is_nullable: "NO", character_set_name: "utf8mb4", collation_name: "utf8mb4_bin", column_default: null, extra: "", column_comment: "" })),
    { table_name: "audit_record_event", column_name: "operation_id_record_event", data_type: "varchar", character_maximum_length: 100, is_nullable: "NO", character_set_name: "utf8mb4", collation_name: "utf8mb4_bin", column_default: null, extra: "", column_comment: "" },
];
const baseline = await readFile(new URL("../../Arquitectura/SQL/023_record_audit.sql", import.meta.url), "utf8");
for (const column of columns) {
    const definition = baseline.split("\n").find((line) => line.trimStart().startsWith(`${column.column_name} VARCHAR`));
    column.column_comment = /COMMENT '([^']+)'/.exec(definition ?? "")?.[1] ?? "";
}
const indexes = [...identityFields.map((column_name, index) => ({ table_name: "audit_record", index_name: "uq_audit_record_identity", column_name, seq_in_index: index + 1, non_unique: 0, sub_part: null })), ...["record_id_record_event", "operation_id_record_event"].map((column_name, index) => ({ table_name: "audit_record_event", index_name: "uq_audit_record_event_operation", column_name, seq_in_index: index + 1, non_unique: 0, sub_part: null }))];
const tables = ["audit_record", "audit_record_event"].map((table_name) => ({ table_name, table_type: "BASE TABLE", engine: "InnoDB" }));
const support = [{ collation_name: "utf8mb4_0900_bin", character_set_name: "utf8mb4", pad_attribute: "NO PAD" }];

/** Captures compiled queries in memory; no mysql2 driver, environment or connection. */
const createDatabase = (overrides: Partial<Record<"destination" | "collation" | "tables" | "columns" | "indexes", unknown[]>> = {}, failAlter = -1) => {
    const queries: CompiledQuery[] = [];
    let alterCount = 0;
    const failure = new Error("Injected ALTER failure");
    const responses = { destination: [{ name: "CRM_THINK_V2" }], collation: support, tables, columns, indexes, ...overrides };
    class Driver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                if (query.sql.startsWith("ALTER") && alterCount++ === failAlter) return Promise.reject(failure);
                const stage = Object.entries({ destination: "DATABASE() AS name", collation: "information_schema.COLLATIONS", tables: "information_schema.TABLES", columns: "information_schema.COLUMNS", indexes: "information_schema.STATISTICS" }).find(([, fragment]) => query.sql.includes(fragment))?.[0] as keyof typeof responses | undefined;
                return Promise.resolve({ rows: (stage ? responses[stage] : []) as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries, failure };
};

describe("record audit exact identifiers without a database", () => {
    it.each([[], [{ name: "crmdatabase-api" }], [{ name: "crm_think_v2" }], [{ name: null }]].map((destination) => ({ destination })))("rejects destination $destination before other queries", async ({ destination }) => {
        const { db, queries } = createDatabase({ destination });
        try {
            await expect(recordAuditIdentifierCollationMigration.up(db)).rejects.toThrow("CRM_THINK_V2");
            expect(queries.map((query) => query.sql)).toEqual(["SELECT DATABASE() AS name"]);
        } finally {
            await db.destroy();
        }
    });

    it.each([[], [{ ...support[0], pad_attribute: "PAD SPACE" }], [{ ...support[0], character_set_name: "ascii" }]].map((collation) => ({ collation })))("rejects unsupported collation $collation before ALTER", async ({ collation }) => {
        const { db, queries } = createDatabase({ collation });
        try {
            await expect(recordAuditIdentifierCollationMigration.up(db)).rejects.toThrow("NO PAD");
            expect(queries.every((query) => query.sql.startsWith("SELECT"))).toBe(true);
        } finally {
            await db.destroy();
        }
    });

    it.each([
        { tables: tables.slice(0, 1) },
        { tables: [{ ...tables[0], engine: "MyISAM" }, tables[1]] },
        { tables: [{ ...tables[0], table_type: "VIEW" }, tables[1]] },
        ...columns.map((_column, index) => ({ columns: columns.filter((_value, position) => position !== index) })),
        ...Object.entries({ data_type: "char", character_maximum_length: 65, is_nullable: "YES", character_set_name: "ascii", collation_name: "utf8mb4_general_ci", column_default: "default", extra: "VIRTUAL GENERATED", column_comment: "changed" }).map(([field, value]) => ({ columns: [{ ...columns[0], [field]: value }, ...columns.slice(1)] })),
        { indexes: indexes.slice(1) },
        { indexes: [{ ...indexes[0], non_unique: 1 }, ...indexes.slice(1)] },
        { indexes: [{ ...indexes[0], sub_part: 10 }, ...indexes.slice(1)] },
        { indexes: [{ ...indexes[0], column_name: "source_id_record" }, ...indexes.slice(1)] },
    ])("rejects missing or incompatible metadata %# before either ALTER", async (metadata) => {
        const { db, queries } = createDatabase(metadata);
        try {
            await expect(recordAuditIdentifierCollationMigration.up(db)).rejects.toThrow("Incompatible audit");
            expect(queries.every((query) => query.sql.startsWith("SELECT"))).toBe(true);
        } finally {
            await db.destroy();
        }
    });

    it.each([0, 1])("propagates ALTER failure %i without retries or compensating DDL", async (failedIndex) => {
        const { db, queries, failure } = createDatabase({}, failedIndex);
        try {
            await expect(recordAuditIdentifierCollationMigration.up(db)).rejects.toBe(failure);
            expect(queries.filter((query) => query.sql.startsWith("ALTER"))).toHaveLength(failedIndex + 1);
            expect(queries.every((query) => /^(SELECT|ALTER TABLE)\b/.test(query.sql))).toBe(true);
        } finally {
            await db.destroy();
        }
    });

    it("emits only two static ALTERs preserving the exact five original definitions", async () => {
        const { db, queries } = createDatabase();
        try {
            expect(recordAuditIdentifierCollationMigration.name).toBe("202610220024_record_audit_identifier_collation");
            await recordAuditIdentifierCollationMigration.up(db);
            const alters = queries.filter((query) => query.sql.startsWith("ALTER"));
            expect(alters).toHaveLength(2);
            const expected = ["audit_record", "audit_record_event"].map(
                (table) =>
                    `ALTER TABLE ${table}\n${columns
                        .filter((column) => column.table_name === table)
                        .map((column) => `    MODIFY COLUMN ${column.column_name} VARCHAR(${String(column.character_maximum_length)}) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_bin NOT NULL COMMENT '${column.column_comment}'`)
                        .join(",\n")}`,
            );
            expect(alters.map((query) => query.sql)).toEqual(expected);
            expect(alters.every((query) => query.parameters.length === 0)).toBe(true);
            expect(queries.slice(0, -2).every((query) => query.sql.startsWith("SELECT"))).toBe(true);
            for (const query of queries.filter((query) => /information_schema\.(TABLES|COLUMNS|STATISTICS)/.test(query.sql))) expect(query.sql).toContain("TABLE_SCHEMA = DATABASE()");
        } finally {
            await db.destroy();
        }
    });
});
