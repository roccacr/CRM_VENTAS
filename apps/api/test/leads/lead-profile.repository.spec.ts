import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type QueryResult } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { DatabaseService } from "../../src/database/database.service.js";
import type { CrmDatabase } from "../../src/database/database.types.js";
import type { LeadProfileSource } from "../../src/modules/crm/leads/lead-profile.contract.js";
import { LeadProfileRepository } from "../../src/modules/crm/leads/lead-profile.repository.js";

const nativeId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const old: LeadProfileSource = { source: "legacy", id: "12", internalId: "12", reference: "400", values: { fullName: "Nombre anterior", email: "old@example.test" } };
function fixture(options: { native?: boolean; legacy?: boolean; linked?: boolean; ambiguous?: boolean; enabled?: boolean; failed?: boolean } = {}) {
    const queries: CompiledQuery[] = [];
    const nativeCandidates = [{ id: nativeId }];
    if (options.ambiguous) nativeCandidates.push({ id: "another" });
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = <R>(query: CompiledQuery): Promise<QueryResult<R>> => {
            queries.push(query);
            if (options.failed) return Promise.reject(new Error("private database failure"));
            let rows: object[] = [];
            if (query.sql.includes("SELECT DISTINCT l.public_id_lead")) rows = options.linked ? nativeCandidates : [];
            else if (query.sql.includes("SELECT 'reference' AS kind")) rows = options.linked ? [{ kind: "reference", value: "400" }] : [];
            else if (query.sql.includes("l.public_id_lead AS id")) rows = options.native ? [{ id: nativeId, internalId: "1", fullName: "Nombre actual", email: null }] : [];
            return Promise.resolve({ rows: rows as R[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const legacy = { enabled: () => options.enabled !== false, find: vi.fn().mockResolvedValue(options.legacy ? old : null), orders: vi.fn().mockResolvedValue({ items: [], hasMore: false, page: 1 }) };
    return { db, queries, legacy, repository: new LeadProfileRepository({ db } as DatabaseService, legacy) };
}

describe("resolución federada del perfil", () => {
    it("lee legacy sin fabricar un registro nativo", async () => {
        const f = fixture({ legacy: true });
        try {
            const result = await f.repository.read({ source: "legacy", id: "12" });
            expect(result.source).toBe("legacy");
            expect(result.sources).toEqual(["legacy"]);
            expect(f.queries.every((query) => query.sql.startsWith("SELECT"))).toBe(true);
        } finally {
            await f.db.destroy();
        }
    });
    it.each(["native", "legacy"] as const)("unifica las dos fuentes desde una URL %s", async (source) => {
        const f = fixture({ native: true, legacy: true, linked: true });
        try {
            const result = await f.repository.read({ source, id: source === "native" ? nativeId : "12" });
            expect(result.sources).toEqual(["native", "legacy"]);
            expect(result.sections[0]?.fields).toContainEqual(expect.objectContaining({ code: "fullName", value: "Nombre actual", legacyValue: "Nombre anterior" }));
            expect(result.sections[1]?.fields).toContainEqual(expect.objectContaining({ code: "email", value: "old@example.test", source: "legacy" }));
            const historyScope = f.queries.find((query) => query.sql.includes("LIMIT 3") && query.sql.includes("FROM audit_record r WHERE"));
            expect(historyScope?.parameters).toContain("12");
            expect(historyScope?.sql).not.toContain("int_lead_history_link");
        } finally {
            await f.db.destroy();
        }
    });
    it.each(["native", "legacy"] as const)("devuelve 404 para un lead %s inexistente", async (source) => {
        const f = fixture();
        try {
            await expect(f.repository.read({ source, id: source === "native" ? nativeId : "12" })).rejects.toMatchObject({ status: 404 });
        } finally {
            await f.db.destroy();
        }
    });
    it("no une una referencia con más de un lead nativo", async () => {
        const f = fixture({ native: true, legacy: true, linked: true, ambiguous: true });
        try {
            await expect(f.repository.read({ source: "legacy", id: "12" })).rejects.toMatchObject({ status: 409 });
            expect(f.legacy.orders).not.toHaveBeenCalled();
        } finally {
            await f.db.destroy();
        }
    });
    it.each([{ enabled: false }, { failed: true }])("no presenta una fuente caída como perfil completo: %j", async (options) => {
        const f = fixture(options);
        try {
            await expect(f.repository.read({ source: "native", id: nativeId })).rejects.toMatchObject({ status: 503 });
        } finally {
            await f.db.destroy();
        }
    });
});
