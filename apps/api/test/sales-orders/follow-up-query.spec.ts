import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, sql } from "kysely";
import { describe, expect, it } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { LegacyFollowUpReader } from "../../src/integrations/legacy-crm/legacy-follow-up.reader.js";
import { outsideFiniquito } from "../../src/modules/crm/sales/sales-orders/finiquito-exclusion.query.js";
import { emptyFollowUpSource } from "../../src/modules/crm/sales/sales-orders/follow-up.contract.js";
import { followUpSourceQuery, projectDistributionQuery, projectDistributionSeries, readFollowUpSource, readProjectDistribution } from "../../src/modules/crm/sales/sales-orders/follow-up.query.js";
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
    it("shares finiquito classification and combines its queues with existing selections without bypassing order access", () => {
        const { db } = database();
        try {
            const input = { ...query, queues: ["send", "finiquito_validation", "finiquito_signed"] as const };
            const read = { ...input, queues: [...input.queues] };
            const granted = followUpSourceQuery(sql`SELECT 1`, read, { ...access, finiquito: true }).compile(db);
            const denied = followUpSourceQuery(sql`SELECT 1`, read, { ...access, finiquito: false }).compile(db);
            expect(granted.sql).toContain("AS finiquitoSection");
            expect(granted.sql).toContain("$.finiquitoManualStage");
            expect(granted.sql).toContain("ORDER BY manual_event.sequence_record_event DESC LIMIT 1");
            expect(granted.sql).toContain("WHEN balanceValidated=0 AND saleLost=1 AND reservationApplied=1 THEN 'validation'");
            expect(granted.sql).toContain("finiquitoSection='validation'");
            expect(granted.sql).toContain("finiquitoSection='waiting_signature'");
            const selected = granted.sql.split("selected AS (SELECT * FROM searched WHERE")[1]?.split("filtered AS")[0];
            expect(selected).toContain("stateCode='contract_pending_send'");
            expect(selected).toContain(" OR ");
            expect(granted.parameters.filter((value) => value === true).length).toBeGreaterThan(denied.parameters.filter((value) => value === true).length);
        } finally {
            void db.destroy();
        }
    });

    it("adds a bound exact order lookup only for authorized searches without filtered results", async () => {
        const { db } = database();
        try {
            const input = { ...query, search: "BC486" };
            const authorized = followUpSourceQuery(sql`SELECT 1`, input, { ...access, exactOrderSearch: true }).compile(db);
            expect(authorized.sql).toContain("NOT EXISTS (SELECT 1 FROM selected)");
            expect(authorized.sql).toContain("LOWER(candidate.number)=?");
            expect(authorized.sql).toContain("LOWER(TRIM(ref.transaction_number_sales_order_external_reference))=?");
            expect(authorized.parameters).toContain("bc486");
            expect(followUpSourceQuery(sql`SELECT 1`, input, access).compile(db).sql).not.toContain("candidate.number");
        } finally {
            await db.destroy();
        }
    });
    it("limits the portfolio, project options and All queue to the union of banner conditions", () => {
        const { db } = database();
        try {
            const compiled = followUpSourceQuery(sql`SELECT 1`, { ...query, search: "" }, access).compile(db);
            const exclusion = outsideFiniquito(sql`source`, sql`sortId`).compile(db).sql;
            const visible = compiled.sql.split("visible AS (")[1]?.split("), searched AS")[0];
            expect(visible).toContain("approvalPending=1");
            expect(visible).toContain("approved=1 AND stateCode IN ('contract_pending_send','contract_pending_signature')");
            for (const stage of ["pending_balance", "pending_transfer", "transfer_signed"]) expect(visible).toContain(`stateCode='${stage}'`);
            expect(visible).toContain("completedThisYear=1");
            expect(compiled.sql).not.toContain("SUM(TRUE)");
            expect(visible).not.toContain("unitDelivered=");
            expect(compiled.sql).toContain(`SUM((saleLost=0 AND ${exclusion} AND contractSigned=1 AND stateCode='pending_transfer' AND installmentsFullyPaid=1))`);
            expect(compiled.sql).toContain(`SUM((saleLost=0 AND ${exclusion} AND contractSigned=1 AND stateCode='transfer_signed' AND installmentsFullyPaid=1 AND keysDelivered=0 AND unitDelivered=0))`);
            expect(compiled.sql).toContain(`SUM((saleLost=0 AND ${exclusion} AND contractSigned=1 AND completedThisYear=1))`);
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
                expect(compiled.sql).toContain("WHERE pageOrdinal > ? AND pageOrdinal <= ?");
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
            expect(native).toContain("CASE o.installments_fully_paid_sales_order WHEN 'yes' THEN 1 WHEN 'no' THEN 0 ELSE NULL END AS installmentsFullyPaid");
            expect(legacy).toContain("CASE o.cuotas_pagadas_completo_ov WHEN 1 THEN 1 WHEN 0 THEN 0 ELSE NULL END AS installmentsFullyPaid");
            for (const statement of [native, legacy]) expect(statement).toContain("'installmentsFullyPaid',installmentsFullyPaid");
            expect(native).toContain("o.contract_signed_sales_order='yes'");
            expect(legacy).toContain("o.contrado_frima_ov=1");
            for (const statement of [native, legacy]) {
                expect(statement).toContain("'contractSigned',contractSigned");
                for (const stage of ["pending_balance", "pending_transfer", "transfer_signed"]) expect(statement).toContain(`contractSigned=1 AND stateCode='${stage}'`);
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
            const exclusion = outsideFiniquito(sql`source`, sql`sortId`).compile(db).sql;
            expect(compiled.sql).toContain(`WHERE (saleLost=0 AND ${exclusion} AND contractSigned=1 AND completedThisYear=1`);
            expect(compiled.sql).not.toContain("WHERE stateCode='closed'");
            expect(compiled.sql).toContain(`SUM((saleLost=0 AND ${exclusion} AND contractSigned=1 AND stateCode IN ('bank_management','bank_management_in_progress'))`);
            expect(compiled.sql).toContain(`SUM((saleLost=0 AND ${exclusion} AND approved=1 AND stateCode='contract_pending_signature'))`);
        } finally {
            void db.destroy();
        }
    });
    it("projects the banking subset counter without adding another queue or permission", async () => {
        const { db } = database([{ ...emptyFollowUpSource().counts, bank: 5, bankInProgress: 2, total: 0, items: [], projects: [] }]);
        try {
            const statement = followUpSourceQuery(sql`SELECT 1`, query, { ...access, queues: { bank: false } });
            const compiled = statement.compile(db);
            expect(compiled.sql).toContain("AND contractSigned=1 AND stateCode='bank_management_in_progress'),0) AS bankInProgress");
            expect(compiled.parameters).toContain(false);
            const result = await readFollowUpSource(db as never, statement);
            expect(result.counts).toMatchObject({ bank: 5, bankInProgress: 2 });
        } finally {
            await db.destroy();
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
    expect(visible).toContain("contractSigned=1 AND stateCode IN ('bank_management','bank_management_in_progress')");
    expect(visible).toContain("contractSigned=1 AND (stateCode='closed' OR completedThisYear=1)");
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
            expect(await new FollowUpRepository().findRecordAuthority(tx, "legacy", "208")).toEqual({ publicId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", active: false, deleted: false });
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

it("filters several projects and queues with bound OR predicates in both source projections", async () => {
    const f = database();
    try {
        const statement = followUpSourceQuery(sql`SELECT 1`, { ...query, projectIds: ["legacy-project:7", "legacy-project:8"], queues: ["send", "bank"], bankStages: ["bank_management_in_progress"] }, access);
        const compiled = statement.compile(f.db);
        expect(compiled.parameters).toContain("legacy-project:7");
        expect(compiled.parameters).toContain("legacy-project:8");
        expect(compiled.parameters).toContain("bank_management_in_progress");
        expect(compiled.sql).toContain("COALESCE(projectId,'unassigned') IN");
        expect(compiled.sql).not.toContain("legacy-project:7");
    } finally {
        await f.db.destroy();
    }
});

it.each([true, false])("la visibilidad de finiquito usa permiso de orden explícito=%s", async (finiquito) => {
    const f = database();
    try {
        const compiled = followUpSourceQuery(sql`SELECT 1`, query, { ...access, queues: { approvals: true }, finiquito }).compile(f.db);
        const sqlText = compiled.sql;
        expect(sqlText).toContain("AND saleLost=1");
        expect(sqlText).not.toContain("AND saleLost=1 AND contractSigned=1");
        expect(sqlText).toContain("saleLost=0 AND");
        const predicate = sqlText.split("AND (saleLost=1 OR")[0];
        const position = (predicate?.match(/\?/g)?.length ?? 0) - 1;
        expect(compiled.parameters[position]).toBe(finiquito);
    } finally {
        await f.db.destroy();
    }
});
it("incluye caídas sin contrato ni estado activo en ambas fuentes y conserva autoridad y filtros", async () => {
    const f = database();
    try {
        await f.db.transaction().execute(async (tx) => {
            await new FollowUpRepository().read(tx, query, period, { ...access, finiquito: true });
            await new LegacyFollowUpReader({ isConfigured: () => true } as never).read(tx, query, period, { ...access, finiquito: true });
        });
        const native = f.queries[0]?.sql;
        const legacy = f.queries[1]?.sql;
        expect(native).toContain("((o.status_sales_order='active' AND o.cancelled_sales_order='no') OR o.cancelled_sales_order='yes' OR o.balance_validated_sales_order=1 OR o.finiquito_sent_sales_order=1 OR o.finiquito_received_sales_order=1)");
        expect(native).toContain("o.deleted_at_sales_order IS NULL");
        expect(native).not.toContain("o.cancelled_sales_order='yes' AND o.contract_signed_sales_order='yes'");
        expect(legacy).toContain("((o.status_ov=1 AND o.caida_ov=0) OR o.caida_ov=1 OR o.saldo_validado_ov=1 OR o.finiquito_enviado_ov=1 OR o.finiquito_recibido_ov=1)");
        expect(legacy).not.toContain("o.caida_ov=1 AND o.contrado_frima_ov=1");
        expect(legacy).toContain("NOT EXISTS(SELECT 1 FROM crm_sales_order n WHERE n.id_old_produccion_sales_order=o.id_ov)");
        for (const compiled of f.queries) {
            expect(compiled.sql).toContain("WHEN saleLost=1 THEN CASE WHEN rawStage IN");
            expect(compiled.sql).toContain("THEN rawStage ELSE 'unclassified' END");
            expect(compiled.sql).toContain("ownerId=?");
            expect(compiled.sql).toContain("FROM visible WHERE");
            expect(compiled.sql).toContain("WHERE pageOrdinal > ? AND pageOrdinal <= ?");
            expect(compiled.parameters).toContain(access.actorId);
        }
    } finally {
        await f.db.destroy();
    }
});
it("orders the complete filtered portfolio by project and unit before selecting a page", () => {
    const { db } = database();
    try {
        const compiled = followUpSourceQuery(sql`SELECT 1`, query, access).compile(db);
        expect(compiled.sql).toContain(
            "ROW_NUMBER() OVER (ORDER BY FIELD(stateCode,'pending_approval','contract_pending_send','contract_pending_signature','bank_management','bank_management_in_progress','pending_balance','pending_transfer','transfer_signed','closed')=0,FIELD(stateCode,'pending_approval','contract_pending_send','contract_pending_signature','bank_management','bank_management_in_progress','pending_balance','pending_transfer','transfer_signed','closed'),projectName IS NULL,projectName,unit IS NULL,unit,source,sortId,id)",
        );
        expect(compiled.sql).toContain("FROM ranked WHERE pageOrdinal > ? AND pageOrdinal <= ?");
        expect(compiled.sql).toContain("COUNT(*) FROM filtered WHERE source='native'");
        expect(compiled.sql).toContain("COUNT(*) FROM filtered WHERE source='legacy'");
    } finally {
        void db.destroy();
    }
});

it.each([
    { offset: 0, expected: [0, 100] },
    { offset: 100, expected: [100, 200] },
    { offset: 400, expected: [400, 500] },
])("bounds a 100-order selection page by its existing ordinal: offset=$offset", ({ offset, expected }) => {
    const { db } = database();
    try {
        const compiled = followUpSourceQuery(sql`SELECT 1`, { ...query, offset, limit: 100, pageSize: 100 }, access).compile(db);
        const prefix = compiled.sql.split("WHERE pageOrdinal >")[0] ?? "";
        const parameterIndex = (prefix.match(/\?/g) ?? []).length;
        expect(compiled.parameters.slice(parameterIndex, parameterIndex + 2)).toEqual(expected);
        expect(compiled.sql).not.toContain("ORDER BY pageOrdinal LIMIT ? OFFSET ?");
        expect(compiled.sql).toContain("MAX_EXECUTION_TIME(5000)");
    } finally {
        void db.destroy();
    }
});
it("unions native and legacy projections before one filtered and bounded global page", async () => {
    const { db, queries } = database();
    try {
        const legacy = new LegacyFollowUpReader({ isConfigured: () => true } as never);
        await db.transaction().execute((tx) => new FollowUpRepository().readCombined(tx, { ...query, offset: 25 }, period, { access, legacy: legacy.projection(period) }));
        expect(queries).toHaveLength(1);
        const statement = queries[0];
        if (!statement) throw new Error("Missing compiled statement");
        expect(statement.sql).toContain("UNION ALL");
        expect(statement.sql).toContain("n.id_old_produccion_sales_order=o.id_ov");
        expect(statement.sql.indexOf("UNION ALL")).toBeLessThan(statement.sql.indexOf("classified AS"));
        expect(statement.sql.indexOf("WHERE source='native'")).toBeGreaterThan(statement.sql.indexOf("filtered AS"));
        expect(statement.parameters).toContain(25);
    } finally {
        await db.destroy();
    }
});

it("restores the SQL page ordinal across sources without reordering by source IDs or leaking sort metadata", async () => {
    const row = { number: "OV", nativeCode: null, client: null, project: { id: "p", name: "AM" }, unit: "FF001", responsible: null, stateCode: "contract_pending_send", stateSince: null, completedThisYear: false };
    const { db } = database([
        {
            ...emptyFollowUpSource().counts,
            total: 3,
            nativeTotal: 1,
            legacyTotal: 2,
            projects: [],
            items: [
                { ...row, id: "native-id", source: "native", sortId: "1", pageOrdinal: "27", unit: "FF003" },
                { ...row, id: "legacy:500", source: "legacy", sortId: "500", pageOrdinal: "25" },
                { ...row, id: "legacy:3", source: "legacy", sortId: "3", pageOrdinal: "26", unit: "FF002" },
            ],
        },
    ]);
    try {
        const result = await readFollowUpSource(db as never, sql`SELECT 1`);
        expect(result.items.map((item) => item.id)).toEqual(["legacy:500", "legacy:3", "native-id"]);
        expect(result.sourceTotals).toEqual({ native: 1, legacy: 2 });
        expect(result.items[0]).not.toHaveProperty("sortId");
        expect(result.items[0]).not.toHaveProperty("pageOrdinal");
    } finally {
        await db.destroy();
    }
});

describe("project distribution aggregates", () => {
    it("adds all four finiquito stages only with independent order-read access", () => {
        const { db } = database();
        try {
            expect(projectDistributionSeries({ ...access, queues: {}, finiquito: true })).toEqual(["finiquito_validation", "finiquito_pending", "finiquito_signed", "finiquito_formalized"]);
            expect(projectDistributionSeries({ ...access, queues: {}, finiquito: false })).toEqual([]);
            const statement = projectDistributionQuery(sql`SELECT 1`, { ...access, queues: {}, finiquito: true }).compile(db);
            expect(statement.sql).toContain("AS `finiquito_validation`");
            expect(statement.sql).toContain("COALESCE(SUM(FALSE),0) AS total");
            expect(statement.sql).toContain("AS finiquitoSection");
        } finally {
            void db.destroy();
        }
    });
    it("keeps finiquito-only projects without adding their counts to commercial totals", async () => {
        const { db } = database([{ id: null, name: "Sin proyecto", total: 0, finiquito_validation: 9, finiquito_pending: 1, finiquito_signed: 0, finiquito_formalized: 2 }]);
        try {
            await db.transaction().execute(async (tx) => {
                const result = await readProjectDistribution(tx, sql`SELECT 1`, { ...access, queues: {}, finiquito: true });
                expect(result.totalOrders).toBe(0);
                expect(result.projects[0]?.counts).toMatchObject({ finiquito_validation: 9, finiquito_formalized: 2 });
            });
        } finally {
            await db.destroy();
        }
    });
    it("binds the unassigned project filter instead of reading the whole portfolio", () => {
        const { db } = database();
        try {
            const statement = followUpSourceQuery(sql`SELECT 1`, { ...query, projectIds: ["unassigned"], queue: "finiquito_validation" }, { ...access, finiquito: true }).compile(db);
            expect(statement.sql).toContain("COALESCE(projectId,'unassigned') IN");
            expect(statement.parameters).toContain("unassigned");
        } finally {
            void db.destroy();
        }
    });
    const distributionAccess = { ...access, ownOnly: false, approvals: true, queues: { approvals: true, contracts: true, bank: true, closed: true, addendum: true } };
    it("uses exact authorized banners globally with overlapping annual closure and pending addendum", () => {
        const { db } = database();
        const statement = projectDistributionQuery(sql`SELECT 1`, distributionAccess).compile(db);
        expect(projectDistributionSeries(distributionAccess)).toEqual(["approvals", "send", "signature", "bank_not_started", "bank_in_progress", "closed", "addendum"]);
        expect(statement.sql).toContain("GROUP BY projectId ORDER BY total DESC,name,projectId");
        expect(statement.sql).toContain("completedThisYear=1");
        expect(statement.sql).toContain("addendumStatus='pending'");
        expect(statement.sql).toContain("saleLost=0");
        expect(statement.sql).not.toContain("LIMIT");
        expect(statement.sql).not.toContain("JSON_ARRAYAGG");
        expect(statement.sql).not.toContain("AS `balance`");
        const visible = statement.sql.split("visible AS")[1]?.split("SELECT /*+")[0];
        expect(visible).not.toContain("stateCode IN ('contract_pending_send','contract_pending_signature')");
        void db.destroy();
    });
    it("strips source/contact and unauthorized counts while preserving null project and unique totals", async () => {
        const { db } = database([{ id: null, name: "Sin proyecto", total: "1", closed: "1", addendum: "1", clientEmail: "private@example.com", balance: 99 }]);
        await db.transaction().execute(async (tx) => {
            const result = await readProjectDistribution(tx, sql`SELECT 1`, { ...access, queues: { closed: true, addendum: true } });
            expect(result).toEqual({ totalOrders: 1, series: ["closed", "addendum"], projects: [{ id: null, name: "Sin proyecto", total: 1, counts: { closed: 1, addendum: 1 } }] });
        });
        await db.destroy();
    });
    it("federates with native alias authority before global aggregation", async () => {
        const { db, queries } = database([]);
        await db.transaction().execute(async (tx) => {
            await new FollowUpRepository().projectDistribution(tx, period, { access: distributionAccess, legacy: new LegacyFollowUpReader({ get: () => true } as never).projection(period) });
        });
        const statement = queries.find((entry) => entry.sql.includes("GROUP BY projectId"))?.sql ?? "";
        expect(statement).toContain("UNION ALL");
        expect(statement).toContain("n.id_old_produccion_sales_order=o.id_ov");
        expect(statement).toContain("COLLATE utf8mb4_unicode_ci");
        await db.destroy();
    });
});

it("separates inactive search candidates from active banner membership", async () => {
    const { db, queries } = database();
    try {
        await db.transaction().execute(async (tx) => {
            const repository = new FollowUpRepository();
            const legacy = new LegacyFollowUpReader({ isConfigured: () => true } as never);
            await repository.readCombined(tx, { ...query, search: "RDR611" }, period, {
                access: { ...access, exactOrderSearch: true },
                legacy: legacy.projection(period),
                searchLegacy: legacy.projection(period, true),
            });
        });
        const statement = queries[0]?.sql ?? "";
        const active = statement.split("classified AS")[0];
        const candidates = statement.split("search_candidates AS")[1]?.split("visible AS")[0] ?? "";
        expect(active).toContain("o.status_ov=1");
        expect(active).toContain("o.status_sales_order='active'");
        expect(candidates).toContain("crmdatabase-api");
        expect(candidates).not.toContain("o.status_ov=1");
        expect(candidates).not.toContain("o.status_sales_order='active'");
        expect(candidates).toContain("o.deleted_at_sales_order IS NULL");
        expect(candidates).toContain("n.id_old_produccion_sales_order=o.id_ov");
        expect(statement).toContain("FROM search_candidates candidate");
        expect(queries[0]?.parameters).toContain("rdr611");
    } finally {
        await db.destroy();
    }
});
