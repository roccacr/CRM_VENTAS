import { ConfigService } from "@nestjs/config";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult, type Transaction } from "kysely";
import { describe, expect, it } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacyLocationsWriter } from "../../src/integrations/legacy-crm/locations/legacy-locations.writer.js";

const setup = (enabled = true, results: QueryResult<unknown>[] = []) => {
    const queries: CompiledQuery[] = [];
    class RecordingDriver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                return Promise.resolve((results.shift() ?? { rows: [] }) as QueryResult<R>);
            };
            return connection;
        }
    }
    const database = new Kysely<CrmDatabase>({
        dialect: {
            createDriver: () => new RecordingDriver(),
            createAdapter: () => new MysqlAdapter(),
            createIntrospector: (db) => new MysqlIntrospector(db),
            createQueryCompiler: () => new MysqlQueryCompiler(),
        },
    });
    return { writer: new LegacyLocationsWriter(new ConfigService({ ENABLE_LEGACY_FALLBACK: enabled })), transaction: database as unknown as Transaction<CrmDatabase>, queries, database };
};
const payload = { name: "Location", status: "active" as const, externalReferences: [{ systemCode: "netsuite", externalId: "-5" }] };

describe("isolated legacy Locations writer", () => {
    it("performs no reads or writes when the global switch is off", async () => {
        const { writer, transaction, queries, database } = setup(false);
        expect(await writer.find(transaction, 42)).toBeNull();
        expect(await writer.create(transaction, payload)).toBeNull();
        await writer.update(transaction, 42, payload);
        expect(queries).toEqual([]);
        await database.destroy();
    });
    it("creates using bound values and maps Active to 1", async () => {
        const { writer, transaction, queries, database } = setup(true, [{ rows: [] }, { rows: [], insertId: 42n }]);
        expect(await writer.create(transaction, payload)).toBe(42);
        expect(queries[1]?.sql).toContain("INSERT INTO `crmdatabase-api`.ubicaciones");
        expect(queries[1]?.parameters).toEqual([-5, "Location", 1]);
        await database.destroy();
    });
    it("updates the existing identity and maps Inactive to 0 without delete SQL", async () => {
        const { writer, transaction, queries, database } = setup(true, [{ rows: [{ legacyId: 42, externalId: -5, name: "Before", status: 1 }] }, { rows: [] }, { rows: [] }]);
        await writer.update(transaction, 42, { ...payload, status: "inactive" });
        expect(queries[2]?.parameters).toEqual(["Location", -5, 0, 42]);
        expect(queries.every((query) => !/DELETE|TRUNCATE|DROP/i.test(query.sql))).toBe(true);
        await database.destroy();
    });
    it("rejects duplicates and invalid NetSuite IDs without insertion", async () => {
        const { writer, transaction, queries, database } = setup(true, [{ rows: [{ id_ubicaciones: 8 }] }]);
        await expect(writer.create(transaction, payload)).rejects.toThrow("ya existe");

        await expect(writer.create(transaction, { ...payload, externalReferences: [{ systemCode: "netsuite", externalId: "2147483648" }] })).rejects.toThrow("rango");
        expect(queries).toHaveLength(1);
        await database.destroy();
    });
    it("allows nullable NetSuite IDs and rejects names beyond the actual legacy limit", async () => {
        const { writer, transaction, queries, database } = setup(true, [{ rows: [] }, { rows: [], insertId: 42n }]);
        await expect(writer.create(transaction, { ...payload, name: "A".repeat(100), externalReferences: [] })).resolves.toBe(42);
        expect(queries[1]?.parameters).toEqual([null, "A".repeat(100), 1]);
        await expect(writer.create(transaction, { ...payload, name: "A".repeat(101) })).rejects.toThrow("100 characters");
        await expect(writer.update(transaction, 42, { ...payload, name: "A".repeat(101) })).rejects.toThrow("100 characters");
        expect(queries).toHaveLength(2);
        await database.destroy();
    });
});
