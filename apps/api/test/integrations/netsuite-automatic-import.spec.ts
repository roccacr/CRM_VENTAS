import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";

import { productionOrderEvent } from "../../src/integrations/netsuite/netsuite-order-event.contract.js";
import { NetsuiteOrderImportQueue } from "../../src/integrations/netsuite/netsuite-order-import.queue.js";
import { NetsuiteProductionEventsController } from "../../src/integrations/netsuite/netsuite-production-events.controller.js";
import { NetsuiteSalesOrderService } from "../../src/integrations/netsuite/netsuite-sales-order.service.js";

const event = productionOrderEvent.parse({
    schemaVersion: 2,
    source: { system: "netsuite", accountId: "4552704", environment: "production" },
    event: { recordType: "salesorder", netsuiteId: "123", eventType: "edit", observedAt: "2026-11-10T12:00:00.000Z", eventId: "11111111-1111-4111-8111-111111111111", sourceModifiedAt: "2026-11-10T12:00:00.000Z" },
    snapshot: { status: 200, data: { type: "salesorder", id: "123", fields: { initialtranid: "AVI874" }, sublists: { item: [] } } },
});
const absent = { schemaVersion: 2, received: true, persisted: false, result: "not_found", netsuiteId: "123", eventId: event.event.eventId };
type Job = { tranid: string; netsuite: { netsuiteId: string; accountId: string; environment: "production" } };
type Link = { id: string; source: "native" | "legacy" };

function fixture() {
    const orders = { executeEventImport: vi.fn(), executeQueuedImport: vi.fn() };
    const queue = new NetsuiteOrderImportQueue({} as never, {} as never, {} as never, orders as never);
    const internals = queue as unknown as {
        persistRequest(key: string, payload: Job): Promise<void>;
        findExisting(tranid: string, netsuiteId?: string): Promise<Link | null>;
        importOrFind(payload: Job): Promise<{ order: Link; warning?: string }>;
    };
    const persist = vi.spyOn(internals, "persistRequest").mockResolvedValue();
    return { queue, orders, internals, persist };
}

describe("automatic import after an authenticated production edit", () => {
    it("acknowledges a durable queue request while leaving persisted false", async () => {
        const { queue, persist } = fixture();
        const service = { receive: vi.fn().mockResolvedValue(absent) };
        const controller = new NetsuiteProductionEventsController(service as never, queue);
        await expect(controller.receive(event)).resolves.toMatchObject({ ...absent, importQueued: true });
        expect(persist).toHaveBeenCalledWith(expect.any(String), { tranid: "AVI874", netsuite: { netsuiteId: "123", accountId: "4552704", environment: "production" } });
    });

    it("deduplicates different deliveries of the same order and isolates different IDs", async () => {
        const { queue, persist } = fixture();
        await queue.enqueueMissingEvent(event, absent);
        await queue.enqueueMissingEvent({ ...event, event: { ...event.event, eventId: "22222222-2222-4222-8222-222222222222", eventType: "xedit" } }, absent);
        await queue.enqueueMissingEvent({ ...event, event: { ...event.event, netsuiteId: "456" } }, absent);
        expect(persist.mock.calls[0]?.[0]).toBe(persist.mock.calls[1]?.[0]);
        expect(persist.mock.calls[0]?.[0]).not.toBe(persist.mock.calls[2]?.[0]);
    });

    it.each(["create", "approve", "cancel", "reject"] as const)("retains the existing no-create rule for %s", async (eventType) => {
        const { queue, persist } = fixture();
        await expect(queue.enqueueMissingEvent({ ...event, event: { ...event.event, eventType } }, absent)).resolves.toEqual(absent);
        expect(persist).not.toHaveBeenCalled();
    });

    it("does not enqueue existing orders and never acknowledges a failed queue commit", async () => {
        const { queue, persist } = fixture();
        await queue.enqueueMissingEvent(event, { ...absent, result: "applied", persisted: true });
        expect(persist).not.toHaveBeenCalled();
        persist.mockRejectedValueOnce(new Error("queue unavailable"));
        await expect(queue.enqueueMissingEvent(event, absent)).rejects.toThrow("queue unavailable");
    });

    it("finds an order by its immutable ID when the transaction number has changed", async () => {
        const { internals, orders } = fixture();
        const find = vi.spyOn(internals, "findExisting").mockResolvedValue({ id: "native-order", source: "native" });
        orders.executeEventImport.mockResolvedValue({ result: "unchanged" });
        await expect(internals.importOrFind({ tranid: "OLD-NUMBER", netsuite: { netsuiteId: "123", accountId: "4552704", environment: "production" } })).resolves.toEqual({ order: { id: "native-order", source: "native" } });
        expect(find).toHaveBeenCalledWith("OLD-NUMBER", "123");
        expect(orders.executeEventImport).toHaveBeenCalledOnce();
    });

    it("does not report an existing order as synchronized when the automatic update fails", async () => {
        const { internals, orders } = fixture();
        vi.spyOn(internals, "findExisting").mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "native-order", source: "native" });
        orders.executeEventImport.mockRejectedValueOnce(new Error("concurrent import"));
        await expect(internals.importOrFind({ tranid: "AVI874", netsuite: { netsuiteId: "123", accountId: "4552704", environment: "production" } })).rejects.toThrow("concurrent import");
        expect(orders.executeEventImport).toHaveBeenCalledWith({ netsuiteId: "123", accountId: "4552704", environment: "production" });
        expect(orders.executeQueuedImport).not.toHaveBeenCalled();
    });

    it("rejects account/environment mismatch before reading NetSuite", async () => {
        const client = { integrationContext: () => ({ accountId: "4552704", environment: "production" }), readSalesOrderSnapshot: vi.fn() };
        const service = new NetsuiteSalesOrderService({} as never, {} as never, client as never, {} as never);
        await expect(service.executeEventImport({ netsuiteId: "123", accountId: "4552704_SB1", environment: "sandbox" })).rejects.toThrow("otro entorno");
        expect(client.readSalesOrderSnapshot).not.toHaveBeenCalled();
    });

    it("reads a fresh verified snapshot by ID and enables atomic create-if-missing", async () => {
        const at = "2026-11-10T12:00:01.000Z";
        const client = {
            integrationContext: () => event.source,
            readSalesOrderSnapshot: vi.fn().mockResolvedValue({
                ...event.snapshot,
                data: { ...event.snapshot.data, fields: { initialtranid: "AVI874", crm_sync_projection: 1, entity: "300", custbody38: null, subsidiary: null, crm_owner_employee: "900", opportunity: null } },
                sourceModifiedAt: at,
                snapshotReadStartedAt: at,
                snapshotReadCompletedAt: at,
            }),
        };
        const events = { synchronizationEnabled: () => true, receive: vi.fn().mockResolvedValue({ result: "applied" }) };
        const repository = { importNeedsRelation: vi.fn().mockResolvedValue(false) };
        const service = new NetsuiteSalesOrderService({} as never, repository as never, client as never, events as never);
        await expect(service.executeEventImport({ netsuiteId: "123", accountId: "4552704", environment: "production" })).resolves.toMatchObject({ result: "applied", tranid: "AVI874" });
        expect(client.readSalesOrderSnapshot).toHaveBeenCalledWith("123");
        expect(repository.importNeedsRelation.mock.calls.some(([domain]) => domain === "user")).toBe(false);
        expect(events.receive.mock.calls[0]?.[0]).toMatchObject({ event: { netsuiteId: "123", snapshotReadCompletedAt: at } });
        expect(events.receive.mock.calls[0]?.[1]).toMatchObject({ importTranid: "AVI874", importIfMissing: true });
    });
});
