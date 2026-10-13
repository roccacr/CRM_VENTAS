import { ConfigService } from "@nestjs/config";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { LegacyCrmDatabaseService } from "../../src/integrations/legacy-crm/legacy-crm-database.service.js";
import { LegacyUnitFilesReader } from "../../src/integrations/legacy-crm/unit-files/legacy-unit-files.reader.js";
import type { UnitFilter } from "../../src/modules/crm/unit-files/unit-files.contract.js";
import { UnitFilesRepository } from "../../src/modules/crm/unit-files/unit-files.repository.js";

function setup() {
    const queries: CompiledQuery[] = [];
    class RecordingDriver extends DummyDriver {
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                return Promise.resolve({rows: []});
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({dialect: {
        createDriver: () => new RecordingDriver(),
        createAdapter: () => new MysqlAdapter(),
        createIntrospector: (database) => new MysqlIntrospector(database),
        createQueryCompiler: () => new MysqlQueryCompiler(),
    }});
    const native = new UnitFilesRepository({db} as DatabaseService);
    const legacy = new LegacyUnitFilesReader(new ConfigService({ENABLE_LEGACY_FALLBACK: true}),{db} as LegacyCrmDatabaseService);
    return {db,queries,native,legacy};
}
const filter: UnitFilter = {moduleCode:"administration",projectIds:["scope"],limit:50,status:"primary",codes:["FF001","FF002"],housingTypes:["A",""],statuses:["Available"],paneProjectIds:["canonical"]};

describe("Unit Files SQL SearchPanes predicates", () => {
    it("parameterizes OR-within/AND-across selection in both bounded readers", async () => {
        const {db,queries,native,legacy}=setup();
        await native.list(filter,0,51);
        await legacy.list(filter,[{id:"scope",name:"Scope",externalReferences:[]}],0,51);
        expect(queries).toHaveLength(2);
        for(const query of queries) {
            expect(query.sql).toContain("IN (?, ?)");
            expect(query.sql).not.toContain("FF001");
            expect(query.parameters).toEqual(expect.arrayContaining(["primary","FF001","FF002","A","","Available","canonical",51]));
            expect(query.sql).toMatch(/^SELECT/);
        }
        expect(queries[1]?.sql).toContain("NOT EXISTS");
        await db.destroy();
    });
    it("facet counts omit only their own secondary predicate, retain primary constraints and anti-join", async () => {
        const {db,queries,native,legacy}=setup();
        await native.facets({...filter,kind:"code"},101);
        await legacy.facets({...filter,kind:"code"},101);
        for(const query of queries) {
            expect(query.sql).toContain("COUNT(*)");
            expect(query.sql).toContain("GROUP BY value ORDER BY value LIMIT ?");
            expect(query.parameters).not.toContain("FF001");
            expect(query.parameters).toEqual(expect.arrayContaining(["primary","A","","Available","canonical",101]));
        }
        expect(queries[1]?.sql).toContain("NOT EXISTS");
        await db.destroy();
    });
    it("disabled legacy performs no facet queries", async () => {
        const {db,queries}=setup();
        const reader=new LegacyUnitFilesReader(new ConfigService({ENABLE_LEGACY_FALLBACK:false}),{db} as LegacyCrmDatabaseService);
        expect(await reader.facets({...filter,kind:"status"},51)).toEqual([]);
        expect(queries).toHaveLength(0);
        await db.destroy();
    });
});
