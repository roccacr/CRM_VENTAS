import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import { removeMarketingAppointmentsMigration } from "../../migrations/schema-only/202610260038_remove_marketing_appointments.js";

describe("retired Marketing appointments permission", () => {
    it.each([true, false])("removes only the retired permission and is safe when absent: %s", async (exists) => {
        const queries: CompiledQuery[] = [];
        class Driver extends DummyDriver {
            override async acquireConnection() {
                const connection = await super.acquireConnection();
                connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                    queries.push(query);
                    const rows = query.sql.includes("DATABASE()") ? [{ name: "CRM_THINK_V2" }] : query.sql.includes("FOR UPDATE") && exists ? [{ id: "3637" }] : [];
                    return Promise.resolve({ rows: rows as R[] });
                };
                return connection;
            }
        }
        const db = new Kysely<unknown>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
        try {
            await removeMarketingAppointmentsMigration.up(db);
            const deletes = queries.filter((q) => q.sql.startsWith("DELETE"));
            expect(deletes).toHaveLength(exists ? 3 : 0);
            for (const query of deletes) expect(query.parameters).toEqual(["3637"]);
            expect(queries.filter((q) => q.sql.startsWith("UPDATE sec_user"))).toHaveLength(exists ? 1 : 0);
        } finally {
            await db.destroy();
        }
    });
});
