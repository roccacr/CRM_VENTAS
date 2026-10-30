import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, sql } from "kysely";
import { describe, expect, it } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacyFollowUpReader } from "../../src/integrations/legacy-crm/legacy-follow-up.reader.js";
import { emptyFollowUpSource } from "../../src/modules/crm/sales/sales-orders/follow-up.contract.js";
import { followUpSourceQuery, readFollowUpSource } from "../../src/modules/crm/sales/sales-orders/follow-up.query.js";
import { FollowUpRepository } from "../../src/modules/crm/sales/sales-orders/follow-up.repository.js";
import { HomeSummaryRepository } from "../../src/modules/crm/sales/sales-orders/home-summary.repository.js";

const query = { search: "x%' OR 1=1 --", projectId: "", queue: "all" as const, page: 1, pageSize: 25, limit: 25, offset: 0 };
const access = { approvals: false, ownOnly: true, actorId: "actor", approvalOwnOnly: true };
const period = { start: "2026-01-01 06:00:00.000", endExclusive: "2027-01-01 06:00:00.000" };
function database(rows: Record<string, unknown>[] = [{ ...emptyFollowUpSource().counts, total: 0, items: [], projects: [] }]) {
    const queries: CompiledQuery[] = [];
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = (statement) => {
            queries.push(statement);
            return Promise.resolve({ rows: rows as never[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (instance) => new MysqlIntrospector(instance), createQueryCompiler: () => new MysqlQueryCompiler() } });
    return { db, queries };
}
describe("bounded federated follow-up SQL", () => {
    it("limits the portfolio, project options and All queue to the union of banner conditions", () => {
        const { db } = database();
        try {
            const compiled = followUpSourceQuery(sql`SELECT 1`, { ...query, search: "" }, access).compile(db);
            const visible = compiled.sql.split("visible AS (")[1]?.split("), searched AS")[0];
            expect(visible).toContain("approvalPending=1");
            expect(visible).toContain("approved=1 AND stateCode IN ('contract_pending_send','contract_pending_signature')");
            for (const stage of ["bank_management", "pending_balance", "pending_transfer", "transfer_signed"]) expect(visible).toContain(`stateCode='${stage}'`);
            expect(visible).toContain("completedThisYear=1");
            expect(compiled.sql).not.toContain("SUM(TRUE)");
            expect(compiled.sql).toContain("FROM visible WHERE projectId IS NOT NULL");
        } finally {
            void db.destroy();
        }
    });
    it("executes two SELECTs with bound filters and explicit native-first legacy shadowing", async () => {
        const { db, queries } = database();
        try {
            await new HomeSummaryRepository({ db } as never).readSnapshot(async (tx) => {
                await new FollowUpRepository().read(tx, query, period, access);
                await new LegacyFollowUpReader({ isConfigured: () => true } as never).read(tx, query, period, access);
            });
            expect(queries).toHaveLength(2);
            for (const compiled of queries) {
                expect(compiled.sql).toContain("LIMIT ? OFFSET ?");
                expect(compiled.sql).toContain("MAX_EXECUTION_TIME(5000)");
                expect(compiled.sql).not.toContain(query.search);
                expect(compiled.parameters).toContain(query.search.toLocaleLowerCase("es"));
                expect(compiled.sql).not.toContain("approvalPending=0 OR");
                expect(compiled.sql).toContain("ownerId=?");
                expect(compiled.sql).not.toMatch(/INSERT|UPDATE|DELETE|FOR UPDATE|YEAR\(/);
                expect(compiled.sql).not.toMatch(/password_admin|telefono_lead|token_admin/);
            }
            const [native, legacy] = queries.map((entry) => entry.sql);
            expect(native).toContain("l.id_lead=o.lead_id_sales_order");
            expect(native).toContain("c.email_contact");
            expect(native).toContain("o.contract_signed_sales_order='yes'");
            expect(legacy).toContain("o.contrado_frima_ov=1");
            for (const statement of [native, legacy]) {
                expect(statement).toContain("'contractSigned',contractSigned");
                for (const stage of ["bank_management", "pending_balance", "pending_transfer", "transfer_signed"]) expect(statement).toContain(`contractSigned=1 AND stateCode='${stage}'`);
            }
            expect(legacy).toContain("l.email_lead");
            for (const statement of [native, legacy]) expect(statement).toContain("'clientEmail',clientEmail");
            expect(native).toContain("u.id_user=l.owner_user_id_lead");
            expect(legacy).toContain("l.idinterno_lead=o.id_ov_lead");
            expect(legacy).not.toContain("l.id_lead=o.id_ov_lead");
            expect(legacy).toContain("n.id_old_produccion_sales_order=o.id_ov");
            expect(legacy).not.toMatch(/n.status_sales_order|n.deleted_at_sales_order/);
            expect(legacy).toContain("sibling.idinterno_lead=l.idinterno_lead");
        } finally {
            await db.destroy();
        }
    });
    it("keeps closure an annual historical membership but contracts and bank are current-state predicates", () => {
        const { db } = database();
        try {
            const compiled = followUpSourceQuery(sql`SELECT 1`, { ...query, queue: "closed" }, access).compile(db);
            expect(compiled.sql).toContain("WHERE contractSigned=1 AND completedThisYear=1");
            expect(compiled.sql).not.toContain("WHERE stateCode='closed'");
            expect(compiled.sql).toContain("SUM(contractSigned=1 AND stateCode='bank_management')");
            expect(compiled.sql).toContain("SUM(approved=1 AND stateCode='contract_pending_signature')");
        } finally {
            void db.destroy();
        }
    });
    it("rejects a missing source row instead of producing false zeros", async () => {
        const { db } = database([]);
        try {
            await db.transaction().execute(async (tx) => {
                await expect(readFollowUpSource(tx, sql`SELECT 1`)).rejects.toThrow("Missing follow-up");
            });
        } finally {
            await db.destroy();
        }
    });
});

it("binds an exact record identity and preserves native authority for a legacy alias", async () => {
    const { db, queries } = database();
    try {
        await readFollowUpSource(db as never, followUpSourceQuery(sql`SELECT 1`, { ...query, recordId: "legacy:208" }, access));
        expect(queries[0]?.sql).toContain("id_old_produccion_sales_order=?");
        expect(queries[0]?.sql).not.toContain("legacy:208");
        expect(queries[0]?.parameters).toContain("legacy:208");
        expect(queries[0]?.parameters).toContain("208");
    } finally {
        await db.destroy();
    }
});
it.each(["bank", "closed"] as const)("keeps signed %s membership independent of pending approvals before projects and pagination", (queue) => {
    const { db } = database();
    const compiled = followUpSourceQuery(sql`SELECT 1`, { ...query, queue }, { ...access, ownOnly: false, approvalOwnOnly: false, queues: { [queue]: true } }).compile(db);
    const visible = compiled.sql.split("visible AS (")[1]?.split("), searched AS")[0];
    expect(visible).not.toContain("approvalPending=0");
    expect(visible).toContain("contractSigned=1 AND stateCode='bank_management'");
    expect(visible).toContain("contractSigned=1 AND completedThisYear=1");
    expect(compiled.sql).toContain("approved=1 AND stateCode IN ('contract_pending_send','contract_pending_signature')");
    expect(compiled.sql).toContain("AND approvalPending=1");
    expect(compiled.sql).toContain("FROM visible WHERE projectId IS NOT NULL");
    void db.destroy();
});

it("bounds exact source projections before classification without portfolio counts or project catalogs", async () => {
    const { db, queries } = database([]);
    try {
        await db.transaction().execute(async (tx) => {
            await new FollowUpRepository().readRecord(tx, "01ARZ3NDEKTSV4RRFFQ69G5FAV", period);
            await new LegacyFollowUpReader({ isConfigured: () => true } as never).readRecord(tx, "208", period);
        });
        expect(queries).toHaveLength(2);
        expect(queries[0]?.sql).toContain("o.public_id_sales_order=?");
        expect(queries[0]?.parameters).toContain("01ARZ3NDEKTSV4RRFFQ69G5FAV");
        expect(queries[1]?.sql).toContain("o.id_ov=?");
        expect(queries[1]?.parameters).toContain(208);
        expect(queries[1]?.sql).toContain("n.id_old_produccion_sales_order=o.id_ov");
        for (const query of queries) {
            expect(query.sql).toContain("FROM classified LIMIT 1");
            expect(query.sql).toContain("ELSE 'unclassified'");
            expect(query.sql).toContain("'stateVersion',stateVersion");
            expect(query.sql).not.toMatch(/visible AS|searched AS|projects AS|JSON_ARRAYAGG|AS total|SUM\(/);
            expect(query.sql).not.toMatch(/INSERT|UPDATE|DELETE|FOR UPDATE/);
        }
    } finally {
        await db.destroy();
    }
});

it("resolves exact native authority without filtering inactive aliases or reading banner metadata", async () => {
    const { db, queries } = database([{ publicId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", active: 0 }]);
    try {
        await db.transaction().execute(async (tx) => {
            expect(await new FollowUpRepository().findRecordAuthority(tx, "legacy", "208")).toEqual({ publicId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", active: false });
            await new FollowUpRepository().findRecordAuthority(tx, "native", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
        });
        expect(queries[0]?.sql).toContain("WHERE o.id_old_produccion_sales_order=? LIMIT 1");
        expect(queries[0]?.parameters).toContain(208);
        expect(queries[1]?.sql).toContain("WHERE o.public_id_sales_order=? LIMIT 1");
        for (const q of queries) expect(q.sql).not.toMatch(/COUNT\(|JOIN|rawStage|approved|completedThisYear|crmdatabase-api/);
    } finally {
        await db.destroy();
    }
});
