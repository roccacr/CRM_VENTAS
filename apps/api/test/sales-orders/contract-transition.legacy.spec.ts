import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants.js";
import { ConfigService } from "@nestjs/config";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, type Transaction } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacyContractTransitionWriter } from "../../src/integrations/legacy-crm/legacy-contract-transition.writer.js";

const event = { sequence: 1, from: null, state: "contract_pending_signature", actor: "actor-public", reason: "", operationId: "550e8400-e29b-41d4-a716-446655440000", correlationId: "trace" };
function setup(config: Record<string, unknown> = {}, rows: Record<string, unknown>[] = []) {
    const queries: CompiledQuery[] = [];
    const executeQuery = vi.fn().mockImplementation((q: CompiledQuery) => {
        queries.push(q);
        return Promise.resolve({ rows });
    });
    const driver = new DummyDriver();
    driver.acquireConnection = () =>
        Promise.resolve({
            executeQuery,
            async *streamQuery() {
                yield await Promise.resolve({ rows: [] });
            },
        });
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (database) => new MysqlIntrospector(database), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const tx = { isTransaction: true, getExecutor: () => db.getExecutor() } as unknown as Transaction<CrmDatabase>;
    return { writer: new LegacyContractTransitionWriter(new ConfigService({ ENABLE_LEGACY_FALLBACK: true, ENABLE_LEGACY_WRITES: true, LEGACY_CRM_DB_NAME: "crmdatabase-api", NODE_ENV: "development", ...config })), tx, queries, executeQuery };
}
describe("contract-only legacy gate and reviewed DDL", () => {
    it("declares its configuration injection explicitly", () => {
        expect(Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, LegacyContractTransitionWriter)).toContainEqual({ index: 0, param: ConfigService });
    });
    it.each([{ ENABLE_LEGACY_WRITES: false }, { ENABLE_LEGACY_FALLBACK: false }, { LEGACY_CRM_DB_NAME: "other" }])("503 before SQL when disabled %j", async (config) => {
        const f = setup(config);
        await expect(f.writer.lock(f.tx, "901")).rejects.toMatchObject({ status: 503 });
        await expect(f.writer.append(f.tx, "901", event)).rejects.toMatchObject({ status: 503 });
        expect(f.executeQuery).not.toHaveBeenCalled();
    });
    it("allows this writer's explicit flag in development and locks the legacy parent", async () => {
        const f = setup({}, [{ id_ov: 901, status_ov: 1, caida_ov: 0, chekJefeVenta: 1, aprobacion__rdr_ov: 1, aprobacion_forma_ov: 1 }]);
        await expect(f.writer.lock(f.tx, "901")).resolves.toMatchObject({ id: "901", active: true, approved: true });
        expect(f.queries[0]?.sql).toContain("`crmdatabase-api`.ordenventa");
        expect(f.queries[0]?.sql).toContain("FOR UPDATE");
        expect(f.queries[0]?.sql).not.toContain("contrato");
    });
    it("uses the existing canonical mapper for string flags and native business code", async () => {
        const f = setup({}, [{ id_ov: 901, status_ov: "1", caida_ov: "0", chekJefeVenta: "1", aprobacion__rdr_ov: "1", aprobacion_forma_ov: "1" }]);
        await expect(f.writer.lock(f.tx, "901")).resolves.toEqual({ id: "901", businessId: "LEGACY-OV-901", active: true, approved: true });
    });
    it("writes only additive legacy history using the DDL actor reference and first transition null from", async () => {
        const f = setup();
        await f.writer.append(f.tx, "901", event);
        expect(f.queries).toHaveLength(1);
        expect(f.queries[0]?.sql).toContain("INSERT INTO `crmdatabase-api`.audit_sales_order_state_event");
        expect(f.queries[0]?.sql).toContain("actor_reference_sales_order_state_event");
        expect(f.queries[0]?.sql).not.toContain("actor_user_id");
        expect(f.queries[0]?.parameters).toContain("CRM_THINK_V2:actor-public");
        expect(f.queries[0]?.parameters).toContain(null);
    });
    it("maps replay actor and sequence from reviewed schema without guessing signed state", async () => {
        const f = setup({}, [{ sequence: 4, state: "contract_pending_send", actor: "CRM_THINK_V2:actor-public", reason: "Correction" }]);
        await expect(f.writer.event(f.tx, "901", event.operationId)).resolves.toEqual({ sequence: 4, state: "contract_pending_send", actor: "actor-public", reason: "Correction" });
        expect(f.queries[0]?.sql).toContain("operation_id_sales_order_state_event");
        expect(f.queries[0]?.sql).toContain("FOR UPDATE");
    });
});
