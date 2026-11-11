import { describe, expect, it, vi } from "vitest";

import type { PersistedOrderEvent } from "../../src/integrations/netsuite/netsuite-order-event.contract.js";
import type { ManualOrderSynchronization } from "../../src/integrations/netsuite/netsuite-order-event.repository.js";
import { NetsuiteSalesOrderService } from "../../src/integrations/netsuite/netsuite-sales-order.service.js";

function fixture(environment = "production", permission = true, enabled = true) {
    const profile = { user: { publicId: "user-1" }, roles: [{ code: "formalizacion", status: "active" }], permissions: [{ code: "formalizacion.orders.read", effect: "allow", scope: "all_areas" }, ...(permission ? [{ code: "formalizacion.orders.stage.update", effect: "allow", scope: "all_areas" }] : [])] };
    const identity = { getCurrentUser: vi.fn().mockResolvedValue(profile) };
    const repository = { resolve: vi.fn().mockResolvedValue({ source: "legacy", id: "legacy:1", netsuiteId: "123" }), authorizeSynchronization: vi.fn(), importNeedsRelation: vi.fn() };
    const now = "2026-11-03T18:00:00.000Z";
    const client = {
        integrationContext: () => ({ environment, accountId: environment === "production" ? "4552704" : "4552704_SB1" }),
        findSalesOrderByTranId: vi.fn().mockResolvedValue("123"),
        readImportCustomer: vi.fn(),
        readImportRelation: vi.fn(),
        readImportUnit: vi.fn(),
        readSalesOrderSnapshot: vi.fn().mockResolvedValue({ status: 200, sourceModifiedAt: now, snapshotReadStartedAt: now, snapshotReadCompletedAt: now, data: { type: "salesorder", id: "123", fields: { crm_sync_projection: 1, initialtranid: "BC448", entity: "2034401", custbody38: "8771", subsidiary: "13", crm_owner_employee: "1623817", opportunity: null, custbody37: "2" }, sublists: { item: [] } } }),
    };
    const events = { synchronizationEnabled: () => enabled, receive: vi.fn<(event: PersistedOrderEvent, manual?: ManualOrderSynchronization) => Promise<{ persisted: boolean; result: string; destination: string; changes: number }>>().mockResolvedValue({ persisted: true, result: "applied", destination: "legacy", changes: 2 }) };
    const service = new NetsuiteSalesOrderService(identity as never, repository as never, client as never, events as never);
    return { service, client, events, repository, identity, profile };
}
describe("manual NetSuite synchronization", () => {
    it("fetches the verified snapshot server-side and passes transactional authorization", async () => {
        const f = fixture();
        const result = await f.service.synchronize("session", { source: "legacy", id: "1" });
        expect(result).toMatchObject({ environment: "production", result: "applied", destination: "legacy" });
        expect(f.client.readSalesOrderSnapshot).toHaveBeenCalledWith("123");
        expect(f.events.receive).toHaveBeenCalledOnce();
        const call = f.events.receive.mock.calls.at(0);
        expect(call?.[0].source).toEqual({ system: "netsuite", accountId: "4552704", environment: "production" });
        expect(call?.[0].event.netsuiteId).toBe("123");
        expect(call?.[0].snapshot.data.id).toBe("123");
        expect(typeof call?.[1]?.authorize).toBe("function");
    });
    it("rejects a read-only user before contacting NetSuite", async () => {
        const f = fixture("production", false);
        await expect(f.service.synchronize("s", { source: "legacy", id: "1" })).rejects.toThrow("No tiene permiso para sincronizar esta orden.");
        expect(f.client.readSalesOrderSnapshot).not.toHaveBeenCalled();
        expect(f.events.receive).not.toHaveBeenCalled();
    });
    it("blocks disabled sandbox persistence before fetching or writing", async () => {
        const f = fixture("sandbox", true, false);
        await expect(f.service.synchronize("s", { source: "legacy", id: "1" })).rejects.toThrow("Sincronizacion deshabilitada para este ambiente y base de datos.");
        expect(f.client.readSalesOrderSnapshot).not.toHaveBeenCalled();
    });
    it("rejects a mismatched provider order before persistence", async () => {
        const f = fixture();
        f.client.readSalesOrderSnapshot.mockResolvedValueOnce({ status: 200, data: { id: "999" } });
        await expect(f.service.synchronize("s", { source: "legacy", id: "1" })).rejects.toThrow("Actualiza la libreria NetSuite: no devolvio una lectura verificada para sincronizar.");
        expect(f.events.receive).not.toHaveBeenCalled();
    });
    it("exposes the actual configured environment without writing", async () => {
        const f = fixture("sandbox", true, false);
        expect(await f.service.synchronizationContext("s", { source: "legacy", id: "1" })).toMatchObject({ environment: "sandbox", canSynchronize: false });
        expect(f.events.receive).not.toHaveBeenCalled();
    });
});

it("rechecks permissions during the locked write after the provider read", async () => {
    const f = fixture();
    f.identity.getCurrentUser.mockResolvedValueOnce(f.profile).mockResolvedValueOnce({ ...f.profile, permissions: [] });
    f.events.receive.mockImplementationOnce(async (_event, manual) => {
        if (!manual) throw new Error("Missing manual authorization");
        await manual.authorize({} as never, { destination: "legacy", id: "1" });
        return {} as never;
    });
    await expect(f.service.synchronize("session", { source: "legacy", id: "1" })).rejects.toThrow("La autorizacion cambio durante la consulta; recarga la orden.");
    expect(f.repository.authorizeSynchronization).not.toHaveBeenCalled();
});
it("rechecks a revoked session after the provider read", async () => {
    const f = fixture();
    f.identity.getCurrentUser.mockResolvedValueOnce(f.profile).mockRejectedValueOnce(new Error("revoked"));
    f.events.receive.mockImplementationOnce(async (_event, manual) => {
        if (!manual) throw new Error("Missing manual authorization");
        await manual.authorize({} as never, { destination: "legacy", id: "1" });
        return {} as never;
    });
    await expect(f.service.synchronize("session", { source: "legacy", id: "1" })).rejects.toThrow("revoked");
    expect(f.repository.authorizeSynchronization).not.toHaveBeenCalled();
});

it.each(["identity", "projection", "window"])("rejects an invalid verified snapshot: %s", async (mode) => {
    const f = fixture();
    const raw = (await f.client.readSalesOrderSnapshot()) as { data: { id: string; fields: { crm_sync_projection: number } }; snapshotReadCompletedAt: string };
    if (mode === "identity") raw.data.id = "999";
    if (mode === "projection") raw.data.fields.crm_sync_projection = 0;
    if (mode === "window") raw.snapshotReadCompletedAt = "2026-11-03T18:02:00.000Z";
    await expect(f.service.synchronize("s", { source: "legacy", id: "1" })).rejects.toThrow("NetSuite no devolvio la proyeccion completa y valida de esta orden.");
    expect(f.events.receive).not.toHaveBeenCalled();
});

it("imports the exact ERP number using a server-side verified snapshot", async () => {
    const f = fixture();
    await expect(f.service.importOrder("s", { tranid: " bc448 " })).resolves.toEqual({ result: "applied", tranid: "BC448" });
    expect(f.client.findSalesOrderByTranId).toHaveBeenCalledWith("BC448");
    expect(f.client.readSalesOrderSnapshot).toHaveBeenCalledWith("123");
    expect(f.events.receive.mock.calls[0]?.[1]?.importTranid).toBe("BC448");
});

it("blocks import for read-only users and rejects a different number from the snapshot", async () => {
    const denied = fixture("production", false);
    await expect(denied.service.importOrder("s", { tranid: "BC448" })).rejects.toMatchObject({ status: 403 });
    expect(denied.client.findSalesOrderByTranId).not.toHaveBeenCalled();
    const mismatch = fixture();
    await expect(mismatch.service.importOrder("s", { tranid: "BC449" })).rejects.toMatchObject({ status: 502 });
    expect(mismatch.events.receive).not.toHaveBeenCalled();
});

it("reads only missing customer data from NetSuite after local reconciliation checks", async () => {
    const f = fixture();
    f.repository.importNeedsRelation.mockImplementation((kind: string) => Promise.resolve(kind === "lead" || kind === "unit_file"));
    f.client.readImportCustomer.mockResolvedValue({ fullName: "Synthetic customer" });
    await f.service.executeQueuedImport("BC448", { user: { publicId: "requester", permissionVersion: 1 }, session: { publicId: "session" } });
    expect(f.repository.importNeedsRelation.mock.calls).toEqual([
        ["lead", "2034401"],
        ["subsidiary", "13"],
        ["unit_file", "8771"],
    ]);
    expect(f.client.readImportCustomer).toHaveBeenCalledWith("2034401");
    expect(f.client.readImportRelation).not.toHaveBeenCalled();
    expect(f.client.readImportUnit).toHaveBeenCalledExactlyOnceWith("8771");
    expect(f.events.receive).toHaveBeenCalledOnce();
});
