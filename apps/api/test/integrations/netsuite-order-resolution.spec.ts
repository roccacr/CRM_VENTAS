import { ForbiddenException } from "@nestjs/common";
import { type CompiledQuery, DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { expect, it, vi } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { NetsuiteOrderRepository } from "../../src/integrations/netsuite/netsuite-order.repository.js";
import { NetsuiteSalesOrderService } from "../../src/integrations/netsuite/netsuite-sales-order.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import type { TimingOrder } from "../../src/modules/crm/sales/sales-orders/order-timing.contract.js";
import { anyOf } from "../support/throws.js";

const publicId = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
function fixture(native = true, externalIds = ["123"], live?: { version: number; session: boolean }) {
    const queries: CompiledQuery[] = [];
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = (q) => {
            queries.push(q);
            if (live && q.sql.includes("from `sec_user`")) return Promise.resolve({ rows: [{ id_user: 5, permission_version_user: live.version }] as never[] });
            if (live && q.sql.includes("from `sec_auth_session`")) return Promise.resolve({ rows: (live.session ? [{ id_auth_session: 6 }] : []) as never[] });
            return Promise.resolve({ rows: externalIds.map((externalId) => ({ externalId })) as never[] });
        };
        return connection;
    };
    const db = new Kysely<CrmDatabase>({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (instance) => new MysqlIntrospector(instance), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const profile = { user: { publicId: "actor" }, roles: [{ code: "formalizacion", status: "active" }], permissions: [{ code: "formalizacion.orders.read", effect: "allow", scope: "all_areas", source: "role" }] } as IdentityProfile;
    const order: TimingOrder = { id: "42", publicId, active: true, pendingApproval: false, approved: 1, rawStage: "contract_pending_send", contractSigned: 0, completedThisYear: 0, ownerId: "actor" };
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
    return { db, queries, profile, order, repository, legacy, client, service: new NetsuiteSalesOrderService(identity as never, new NetsuiteOrderRepository(repository as never, legacy as never, { readSnapshot } as never), client as never, {} as never) };
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
            expect(f.legacy.find).toHaveBeenCalledTimes(1);
            expect(f.queries[0]?.sql).toContain("id_ov_netsuite");
        }
        expect(f.queries.every((q) => !/INSERT|UPDATE|DELETE/.test(q.sql))).toBe(true);
    } finally {
        await f.db.destroy();
    }
});
it.each(["no-permission", "direct-deny", "deleted", "banner-only"])("blocks %s before provider access", async (mode) => {
    const f = fixture();
    try {
        if (mode === "no-permission") f.profile.permissions = [];
        if (mode === "direct-deny") f.profile.permissions.push({ code: "formalizacion.orders.read", effect: "deny", scope: null, source: "override" });
        if (mode === "deleted") f.order.deleted = true;
        if (mode === "banner-only") f.profile.permissions = [{ code: "formalizacion.home.stages.read", effect: "allow", scope: "self", source: "role" }];
        await expect(f.service.read("session", { source: "native", id: publicId })).rejects.toThrow(anyOf("Permiso insuficiente para consultar la orden.", "Orden disponible no encontrada."));
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
        await expect(f.service.read("session", { source: "native", id: publicId })).rejects.toThrow(anyOf("La orden no tiene una referencia NetSuite valida.", "Referencia NetSuite ambigua."));
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

it.each(["deny", "deleted", "category"])("blocks the database read for %s without data projection or fallback", async (mode) => {
    const f = fixture();
    try {
        if (mode === "deny") f.profile.permissions.push({ code: "formalizacion.orders.read", effect: "deny", scope: null, source: "override" });
        if (mode === "deleted") f.order.deleted = true;
        if (mode === "category") {
            f.profile.permissions = [{ code: "formalizacion.home.banking.read", effect: "allow", scope: "self", source: "role" }];
        }
        await expect(f.service.readDatabase("session", { source: "legacy", id: "208" })).rejects.toThrow(anyOf("Permiso insuficiente para consultar la orden.", "Orden disponible no encontrada."));
        expect(f.queries).toHaveLength(0);
        expect(f.legacy.find).not.toHaveBeenCalled();
        expect(f.client.readSalesOrder).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});

it.each(["deny", "category", "banner-only", "deleted"])("history blocks %s before reading audit rows", async (mode) => {
    const f = fixture();
    try {
        if (mode === "deny") f.profile.permissions.push({ code: "formalizacion.orders.read", effect: "deny", scope: null, source: "override" });
        if (mode === "category") {
            f.profile.permissions = [{ code: "formalizacion.home.banking.read", effect: "allow", scope: "self", source: "role" }];
        }
        if (mode === "banner-only") f.profile.permissions = [{ code: "formalizacion.home.approvals.read", effect: "allow", scope: "self", source: "role" }];
        if (mode === "deleted") f.order.deleted = true;
        await expect(f.service.readHistory("session", { source: "native", id: publicId })).rejects.toThrow(anyOf("Permiso insuficiente para consultar la orden.", "Orden disponible no encontrada."));
        expect(f.queries).toHaveLength(0);
        expect(f.client.readSalesOrder).not.toHaveBeenCalled();
    } finally {
        await f.db.destroy();
    }
});

it.each(["authority", "reference"])("manual synchronization rejects changed %s before writes", async (mode) => {
    const f = fixture(true, mode === "reference" ? ["999"] : ["123"]);
    const repo = new NetsuiteOrderRepository(f.repository as never, f.legacy as never, {} as never);
    try {
        await expect(f.db.transaction().execute((tx) => repo.authorizeSynchronization(tx, { target: { source: "legacy", id: "208" }, netsuiteId: "123", destination: { destination: "native", id: mode === "authority" ? "43" : "42" }, check: () => undefined, profile: f.profile }))).rejects.toThrow("identidad");
        expect(f.queries.every((q) => !/^\s*(INSERT|UPDATE|DELETE)/.test(q.sql))).toBe(true);
    } finally {
        await f.db.destroy();
    }
});

it.each(["version", "revoked", "expired"])("manual synchronization locks live authorization and rejects %s", async (mode) => {
    const f = fixture(true, ["123"], { version: mode === "version" ? 2 : 1, session: false });
    f.profile.user.permissionVersion = 1;
    f.profile.session = { publicId: "session", status: "active", permissionVersion: 1, expiresAt: "2099-01-01T00:00:00Z", expiresInSeconds: 3600 };
    const repo = new NetsuiteOrderRepository(f.repository as never, f.legacy as never, {} as never);
    try {
        await expect(f.db.transaction().execute((tx) => repo.authorizeSynchronization(tx, { target: { source: "legacy", id: "208" }, netsuiteId: "123", destination: { destination: "native", id: "42" }, check: () => undefined, profile: f.profile }))).rejects.toThrow(ForbiddenException);
        expect(f.queries.some((q) => q.sql.includes("from `sec_user`") && q.sql.includes("for update"))).toBe(true);
        if (mode !== "version") {
            const query = f.queries.find((q) => q.sql.includes("from `sec_auth_session`"));
            expect(query?.sql).toContain("expires_at_auth_session");
            expect(query?.sql).toContain("status_auth_session");
            expect(query?.sql).toContain("for update");
        }
        expect(f.queries.every((q) => !/^\s*(INSERT|UPDATE|DELETE)/.test(q.sql))).toBe(true);
    } finally {
        await f.db.destroy();
    }
});

it.each([true, false])("reads inactive order data and history native=%s while synchronization remains blocked", async (native) => {
    const f = fixture(native);
    f.order.active = false;
    try {
        await expect(f.service.readDatabase("session", { source: "legacy", id: "208" })).resolves.toMatchObject({ source: native ? "native" : "legacy" });
        await expect(f.service.readHistory("session", { source: "legacy", id: "208" })).resolves.toBeDefined();
        await expect(f.service.read("session", { source: "legacy", id: "208" })).resolves.toBeDefined();
        const resolver = new NetsuiteOrderRepository(f.repository as never, f.legacy as never, { readSnapshot: (run: (tx: never) => Promise<unknown>) => f.db.transaction().execute((tx) => run(tx as never)) } as never);
        await expect(resolver.resolve({ source: "legacy", id: "208" }, () => undefined)).rejects.toMatchObject({ status: 404 });
    } finally {
        await f.db.destroy();
    }
});
