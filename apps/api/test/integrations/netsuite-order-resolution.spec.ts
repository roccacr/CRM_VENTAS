import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { expect, it, vi } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { NetsuiteOrderRepository } from "../../src/integrations/netsuite/netsuite-order.repository.js";
import { NetsuiteSalesOrderService } from "../../src/integrations/netsuite/netsuite-sales-order.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import type { TimingOrder } from "../../src/modules/crm/sales/sales-orders/order-timing.contract.js";

const publicId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
function fixture(native = true, externalIds = ["123"]) {
    const queries: CompiledQuery[] = [];
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = (q) => {
            queries.push(q);
            return Promise.resolve({ rows: externalIds.map((externalId) => ({ externalId })) as never[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (instance) => new MysqlIntrospector(instance), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const profile = { user: { publicId: "actor" }, roles: [{ code: "formalizacion", status: "active" }], permissions: [{ code: "formalizacion.home.stages.read", effect: "allow", scope: "all_areas", source: "role" }] } as IdentityProfile;
    const order: TimingOrder = { id: "42", publicId, active: true, pendingApproval: false, ownerId: "actor" };
    const identity = { getCurrentUser: vi.fn().mockResolvedValue(profile) };
    const repository = { find: vi.fn().mockImplementation(() => Promise.resolve(native ? order : undefined)) };
    const legacy = { enabled: () => true, find: vi.fn().mockImplementation(() => Promise.resolve({ ...order, id: "208", publicId: "legacy:208" })) };
    let snapshotOpen = false;
    const readSnapshot = async <T>(read: (tx: never) => Promise<T>) => {
        snapshotOpen = true;
        try {
            return await db
                .transaction()
                .setAccessMode("read only")
                .execute((tx) => read(tx as never));
        } finally {
            snapshotOpen = false;
        }
    };
    const client = {
        readSalesOrder: vi.fn().mockImplementation(() => {
            expect(snapshotOpen).toBe(false);
            return Promise.resolve({ fields: { tranid: "RDR673" } });
        }),
    };
    return { db, queries, profile, order, repository, legacy, client, service: new NetsuiteSalesOrderService(identity as never, new NetsuiteOrderRepository(repository as never, legacy as never, { readSnapshot } as never), client as never) };
}
it.each([true, false])("resolves authorized source native=%s before one provider GET outside DB transaction", async (native) => {
    const f = fixture(native);
    try {
        const result = await f.service.read("session", { source: "legacy", id: "208" });
        expect(result.order).toMatchObject({ source: native ? "native" : "legacy", netsuiteId: "123" });
        expect(f.client.readSalesOrder).toHaveBeenCalledExactlyOnceWith("123");
        if (native) {
            expect(f.legacy.find).not.toHaveBeenCalled();
            expect(f.queries[0]?.sql).toContain("s.code_external_system='netsuite'");
        } else {
            expect(f.legacy.find).toHaveBeenCalled();
            expect(f.queries[0]?.sql).toContain("id_ov_netsuite");
        }
        expect(f.queries.every((q) => !/INSERT|UPDATE|DELETE/.test(q.sql))).toBe(true);
    } finally {
        await f.db.destroy();
    }
});
it.each(["no-permission", "direct-deny", "foreign-owner", "inactive", "approvals"])("blocks %s before provider access", async (mode) => {
    const f = fixture();
    try {
        if (mode === "no-permission") f.profile.permissions = [];
        if (mode === "direct-deny") f.profile.permissions.push({ code: "formalizacion.home.stages.read", effect: "deny", scope: null, source: "override" });
        if (mode === "foreign-owner") {
            for (const permission of f.profile.permissions) permission.scope = "self";
            f.order.ownerId = "other";
        }
        if (mode === "inactive") f.order.active = false;
        if (mode === "approvals") f.order.pendingApproval = true;
        await expect(f.service.read("session", { source: "native", id: publicId })).rejects.toThrow();
        expect(f.client.readSalesOrder).not.toHaveBeenCalled();
        expect(f.legacy.find).not.toHaveBeenCalled();
        expect(f.queries).toHaveLength(0);
    } finally {
        await f.db.destroy();
    }
});
it.each([{ ids: [] }, { ids: ["123", "456"] }, { ids: ["odoo-id"] }])("refuses missing, ambiguous or non-NetSuite reference %j", async ({ ids }) => {
    const f = fixture(true, ids);
    try {
        await expect(f.service.read("session", { source: "native", id: publicId })).rejects.toThrow();
        expect(f.client.readSalesOrder).not.toHaveBeenCalled();
        expect(f.legacy.find).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});

it.each([true, false])("reads the database source native=%s without calling NetSuite", async (native) => {
    const f = fixture(native);
    try {
        const result = await f.service.readDatabase("session", { source: "legacy", id: "208" });
        expect(result.source).toBe(native ? "native" : "legacy");
        expect(f.client.readSalesOrder).not.toHaveBeenCalled();
        expect(f.legacy.find).toHaveBeenCalledTimes(native ? 0 : 1);
        expect(f.queries.every((q) => !/INSERT|UPDATE|DELETE/.test(q.sql))).toBe(true);
    } finally {
        await f.db.destroy();
    }
});
it("does not treat a native database failure as native absence", async () => {
    const f = fixture();
    f.repository.find.mockRejectedValue(new Error("db unavailable"));
    try {
        await expect(f.service.readDatabase("session", { source: "legacy", id: "208" })).rejects.toThrow("No fue posible resolver");
        expect(f.legacy.find).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});

it.each(["deny", "inactive", "scope"])("blocks the database read for %s without data projection or fallback", async (mode) => {
    const f = fixture();
    try {
        if (mode === "deny") f.profile.permissions.push({ code: "formalizacion.home.stages.read", effect: "deny", scope: null, source: "override" });
        if (mode === "inactive") f.order.active = false;
        if (mode === "scope") {
            f.order.ownerId = "other";
            for (const permission of f.profile.permissions) permission.scope = "self";
        }
        await expect(f.service.readDatabase("session", { source: "legacy", id: "208" })).rejects.toThrow();
        expect(f.queries).toHaveLength(0);
        expect(f.legacy.find).not.toHaveBeenCalled();
        expect(f.client.readSalesOrder).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});
