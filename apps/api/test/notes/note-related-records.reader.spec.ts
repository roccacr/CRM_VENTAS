import { ConfigService } from "@nestjs/config";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import { NoteRelatedRecordsReader } from "../../src/modules/crm/notes/note-related-records.reader.js";

const native = { kind: "lead" as const, source: "native" as const, id: "01K00000000000000000000000" };
const legacy = { kind: "lead" as const, source: "legacy" as const, id: "208" };
const row = { id: native.id, label: "Cliente", description: null, active: 1, ownerId: "actor", hasOrder: 0, relatedLeadId: null, legacyAliases: '["208"]' };
function fixture() {
    const queries: CompiledQuery[] = [];
    const transactions: unknown[] = [];
    class Driver extends DummyDriver {
        override beginTransaction(_connection?: unknown, options?: unknown) {
            transactions.push(options);
            return Promise.resolve();
        }
        override async acquireConnection() {
            const connection = await super.acquireConnection();
            connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
                queries.push(query);
                const rows = query.sql.startsWith("SELECT COUNT") ? [{ total: 1 }] : [row];
                return Promise.resolve({ rows: rows as R[] });
            };
            return connection;
        }
    }
    const db = new Kysely<CrmDatabase>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new Driver(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { reader: new NoteRelatedRecordsReader({ db } as DatabaseService, new ConfigService({ LEGACY_CRM_DB_NAME: "crmdatabase-api" })), queries, transactions };
}
describe("related resource SQL boundaries", () => {
    it("batch loads one kind with bound IDs and an explicit legacy alias", async () => {
        const f = fixture();
        const rows = await f.reader.readNative([native, legacy]);
        expect(f.queries).toHaveLength(1);
        expect(f.queries[0]?.sql).toContain("crm_lead_external_reference");
        expect(f.queries[0]?.sql).toContain("s.code_external_system='legacy_crm'");
        expect(f.queries[0]?.parameters).toEqual([native.id, legacy.id]);
        expect(rows[0]?.aliases).toEqual([native, legacy]);
        expect(f.transactions).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
    });
    it("uses legacy primary key rather than its nonunique provider reference", async () => {
        const f = fixture();
        await f.reader.readLegacy([legacy]);
        expect(f.queries[0]?.sql).toContain("WHERE `l`.`id_lead` IN (?)");
        expect(f.queries[0]?.parameters).toEqual([208]);
        expect(f.queries[0]?.sql).toContain("sibling.idinterno_lead=l.idinterno_lead");
    });
    it("scopes before counting/paging and treats wildcard text as a bound literal", async () => {
        const f = fixture();
        const search = "O'Hara_%!";
        await f.reader.searchNative("lead", search, 25, 26, { actor: "actor", all: false, own: true, orders: false });
        expect(f.queries).toHaveLength(2);
        expect(f.queries[0]?.sql).not.toContain(search);
        expect(f.queries[0]?.sql).toContain("u.public_id_user");
        expect(f.queries[0]?.parameters).toContain("%O'Hara!_!%!!%");
        expect(f.queries[1]?.parameters.slice(-2)).toEqual([26, 25]);
    });
    it("suppresses mapped legacy copies without filtering away native tombstones", async () => {
        const f = fixture();
        await f.reader.searchLegacy("sales_order", "OV-", 0, 26, { actor: "actor", all: true, own: false, orders: true });
        expect(f.queries[0]?.sql).toContain("NOT EXISTS(SELECT 1 FROM crm_sales_order no WHERE no.id_old_produccion_sales_order=o.id_ov)");
        expect(f.queries[0]?.sql).not.toContain("no.deleted_at_sales_order IS NULL");
    });
    it("does not configure legacy merely because native exists", () => {
        const f = fixture();
        expect(f.reader.legacyEnabled()).toBe(true);
        const disabled = new NoteRelatedRecordsReader({} as DatabaseService, new ConfigService());
        expect(disabled.legacyEnabled()).toBe(false);
    });
});
