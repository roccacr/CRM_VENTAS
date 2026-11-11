import "reflect-metadata";

import { DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { bankAssignmentInput, bankAssignmentUnlinkInput, OrderBankAssignmentService } from "../../src/modules/crm/sales/sales-orders/order-bank-assignment.js";
import { OrderBankAssignmentRepository } from "../../src/modules/crm/sales/sales-orders/order-bank-assignment.repository.js";
const id = "01K8SJ7KXKWWPMAWEA8NXGWW83";
const body = { bankPublicId: id, advisorPublicId: id, expectedVersion: 0, reason: "Asignación solicitada" };
function fixture() {
    const profile = {
        user: { publicId: "actor", status: "active" },
        roles: [
            { code: "owner", status: "active" },
            { code: "formalizacion", status: "active" },
        ],
        orgUnits: [],
        permissions: ["formalizacion.orders.read", "formalizacion.catalog_bank.read", "formalizacion.catalog_bank.update"].map((code) => ({ code, effect: "allow" })),
    } as unknown as IdentityProfile;
    const repository = { unlink: vi.fn().mockResolvedValue({ version: 2, bank: null, advisor: null }), read: vi.fn().mockResolvedValue({ source: "native", id, version: 0, bank: null, advisor: null, changedAt: null }), change: vi.fn().mockResolvedValue({ version: 1 }) };
    const identity = { getCurrentUser: vi.fn().mockResolvedValue(profile) };
    return { profile, repository, service: new OrderBankAssignmentService(identity as unknown as IdentityService, repository as unknown as OrderBankAssignmentRepository) };
}
describe("Order bank assignment authorization and validation", () => {
    it("attributes unlink to the session and preserves its version", async () => {
        const f = fixture();
        await expect(f.service.unlink("session", { source: "legacy", id: "legacy:42" }, { expectedVersion: 1, reason: "  Retirar vínculo  " })).resolves.toMatchObject({ version: 2, bank: null, advisor: null });
        expect(f.repository.unlink).toHaveBeenCalledWith({ source: "legacy", id: "42" }, { expectedVersion: 1, reason: "Retirar vínculo", actorPublicId: "actor" });
    });
    it.each([0, -1, 0.5, 4294967295])("rejects unlink version %s", (expectedVersion) => {
        expect(bankAssignmentUnlinkInput.safeParse({ expectedVersion, reason: "Motivo" }).success).toBe(false);
    });
    it.each(["  ", "ab", "x".repeat(256)])("rejects invalid unlink reason", (reason) => {
        expect(bankAssignmentUnlinkInput.safeParse({ expectedVersion: 1, reason }).success).toBe(false);
    });
    it("rejects extra fields in unlink", () => {
        expect(bankAssignmentUnlinkInput.safeParse({ expectedVersion: 1, reason: "Motivo", bankPublicId: id }).success).toBe(false);
    });
    it("returns the empty snapshot and attributes changes to the session", async () => {
        const f = fixture();
        expect(await f.service.read("session", { source: "native", id })).toMatchObject({ version: 0, bank: null });
        await f.service.change("session", { source: "legacy", id: "legacy:42" }, body);
        expect(f.repository.change).toHaveBeenCalledWith({ source: "legacy", id: "42" }, { ...body, actorPublicId: "actor" });
    });
    it.each(["formalizacion.orders.read", "formalizacion.catalog_bank.read", "formalizacion.catalog_bank.update"])("denies explicit %s deny", async (code) => {
        const f = fixture();
        f.profile.permissions.push({ code, effect: "deny", scope: null, source: "role" });
        await expect(f.service.change("session", { source: "native", id }, body)).rejects.toMatchObject({ status: 403 });
        expect(f.repository.change).not.toHaveBeenCalled();
        await expect(f.service.unlink("session", { source: "native", id }, { expectedVersion: 1, reason: "Retirar" })).rejects.toMatchObject({ status: 403 });
        expect(f.repository.unlink).not.toHaveBeenCalled();
    });
    it.each(["formalizacion", "ventas"])("honors effective permissions with role %s", async (code) => {
        const f = fixture();
        f.profile.roles = [{ code, status: "active" }] as IdentityProfile["roles"];
        f.profile.orgUnits = [{ code: "formalizacion", status: "active" }] as IdentityProfile["orgUnits"];
        await expect(f.service.read("session", { source: "native", id })).resolves.toBeDefined();
    });
    it("rejects inactive actors and roles", async () => {
        const f = fixture();
        f.profile.user.status = "inactive";
        await expect(f.service.read("session", { source: "native", id })).rejects.toMatchObject({ status: 403 });
        f.profile.user.status = "active";
        f.profile.roles = f.profile.roles.map((role) => ({ ...role, status: "inactive" }));
        await expect(f.service.change("session", { source: "native", id }, body)).rejects.toMatchObject({ status: 403 });
    });
    it("requires update in addition to read", async () => {
        const f = fixture();
        f.profile.permissions = f.profile.permissions.filter((p) => !p.code.endsWith(".update"));
        await expect(f.service.read("session", { source: "native", id })).resolves.toMatchObject({ version: 0 });
        await expect(f.service.change("session", { source: "native", id }, body)).rejects.toMatchObject({ status: 403 });
    });
    it.each([
        { ...body, expectedVersion: -1 },
        { ...body, expectedVersion: 0.5 },
        { ...body, reason: "  " },
        { ...body, reason: "x".repeat(256) },
        { ...body, bankPublicId: "123" },
        { ...body, actorPublicId: "spoof" },
    ])("rejects invalid command %#", (command) => {
        expect(bankAssignmentInput.safeParse(command).success).toBe(false);
    });
    it("rejects ERP/native internal identifiers before persistence", async () => {
        const f = fixture();
        await expect(f.service.change("session", { source: "native", id: "123" }, body)).rejects.toMatchObject({ status: 400 });
        expect(f.repository.change).not.toHaveBeenCalled();
    });
});

it.each([false, true])("reads inactive banking without allowing unlink legacy=%s", async (legacy) => {
    const driver = new DummyDriver();
    driver.acquireConnection = async () => {
        const connection = await DummyDriver.prototype.acquireConnection.call(driver);
        connection.executeQuery = (query) =>
            Promise.resolve({
                rows: (query.sql.includes("FROM crm_sales_order o WHERE") ? (legacy ? [] : [{ id, internalId: "85", active: 0, deleted: 0 }]) : query.sql.includes("from `sec_user`") ? [{ id_user: 1 }] : []) as never[],
            });
        return connection;
    };
    const db = new Kysely({ dialect: { createDriver: () => driver, createAdapter: () => new MysqlAdapter(), createIntrospector: (instance) => new MysqlIntrospector(instance), createQueryCompiler: () => new MysqlQueryCompiler() } });
    const old = { read: vi.fn().mockResolvedValue({ source: "legacy", id: "85", internalId: "85", active: false }) };
    const repository = new OrderBankAssignmentRepository({ db } as never, { enabled: true, captureActor: vi.fn().mockResolvedValue({}) } as never, {} as never, old);
    const identity = { source: legacy ? ("legacy" as const) : ("native" as const), id: legacy ? "85" : id };
    try {
        await expect(repository.read(identity)).resolves.toMatchObject({ bank: null, advisor: null });
        await expect(repository.unlink(identity, { expectedVersion: 0, reason: "Retirar", actorPublicId: "actor" })).rejects.toMatchObject({ status: 404 });
    } finally {
        await db.destroy();
    }
});
