import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import { failedOrderIds, retryOrderEvents } from "../../scripts/retry-netsuite-order-events.js";
import type { PersistedOrderEvent } from "../../src/integrations/netsuite/netsuite-order-event.contract.js";

const row = (id: string, delivered = false) => ({ Detalles: JSON.stringify({ recordType: "salesorder", netsuiteId: id, delivered }) });
const snapshot = (id: string) => {
    const at = new Date().toISOString();
    return { status: 200, sourceModifiedAt: at, snapshotReadStartedAt: at, snapshotReadCompletedAt: at, data: { type: "salesorder", id, fields: { crm_sync_projection: 1, initialtranid: "OV" + id }, sublists: { item: [] } } };
};

describe("recover failed order events", () => {
    it("deduplicates failed orders and ignores successful and non-order events", () => {
        expect(failedOrderIds([row("123"), row("123"), row("456", true), { Detalles: JSON.stringify({ recordType: "lead", delivered: false }) }])).toEqual(["123"]);
    });
    it("never accepts arbitrary external IDs or executable document content", () => {
        fc.assert(
            fc.property(
                fc.string().filter((value) => !/^[1-9][0-9]{0,14}$/.test(value)),
                (value) => {
                    expect(() => failedOrderIds([row(value)])).toThrow();
                },
            ),
            { seed: 20261112, numRuns: 100 },
        );
    });
    it("reads fresh snapshots and only accepts a matching committed receipt", async () => {
        const read = vi.fn((id: string) => Promise.resolve(snapshot(id)));
        const send = vi.fn((event: PersistedOrderEvent) => Promise.resolve(Response.json({ schemaVersion: 2, received: true, persisted: true, netsuiteId: event.event.netsuiteId, eventId: event.event.eventId, result: "applied" })));
        expect(await retryOrderEvents(["123", "123"], read, send)).toEqual([{ id: "123", result: "applied", httpStatus: 200 }]);
        expect(read).toHaveBeenCalledExactlyOnceWith("123");
    });
    it.each(["wrong-id", "wrong-event", "not-persisted", "not-queued"])("does not claim success for %s", async (mode) => {
        const read = vi.fn((id: string) => Promise.resolve(snapshot(id)));
        const send = vi.fn((event: PersistedOrderEvent) => Promise.resolve(Response.json({ schemaVersion: 2, received: true, persisted: mode !== "not-persisted" && mode !== "not-queued", netsuiteId: mode === "wrong-id" ? "999" : event.event.netsuiteId, eventId: mode === "wrong-event" ? "11111111-1111-4111-8111-111111111111" : event.event.eventId, result: mode === "not-queued" ? "not_found" : "applied" })));
        expect(await retryOrderEvents(["123"], read, send)).toEqual([{ id: "123", result: "failed" }]);
    });
    it("rejects the entire invalid ID list before any network operation", async () => {
        const read = vi.fn();
        const send = vi.fn();
        await expect(retryOrderEvents(["123", "../bad"], read, send)).rejects.toThrow();
        expect(read).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
    });
    it("continues after a rejected order and does not expose the response", async () => {
        const read = vi.fn((id: string) => Promise.resolve(snapshot(id)));
        const send = vi
            .fn()
            .mockResolvedValueOnce(new Response("PRIVATE_BODY", { status: 401 }))
            .mockRejectedValueOnce(new Error("PRIVATE_SECRET"));
        const results = await retryOrderEvents(["123", "456"], read, send);
        expect(results).toEqual([
            { id: "123", result: "failed", httpStatus: 401 },
            { id: "456", result: "failed" },
        ]);
        expect(JSON.stringify(results)).not.toContain("PRIVATE");
    });
});
