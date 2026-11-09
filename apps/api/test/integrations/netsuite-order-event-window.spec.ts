import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { persistedOrderEvent, productionOrderEvent } from "../../src/integrations/netsuite/netsuite-order-event.contract.js";

function payload() {
    return { schemaVersion: 2, source: { system: "netsuite", accountId: "4552704_SB1", environment: "sandbox" }, event: { recordType: "salesorder", netsuiteId: "123", eventType: "edit", observedAt: "2026-11-02T20:00:00.000Z", eventId: "11111111-1111-4111-8111-111111111111", sourceModifiedAt: "2026-11-02T20:00:00.000Z" }, snapshot: { status: 200, data: { type: "salesorder", id: "123", fields: {}, sublists: { item: [] } } } };
}
describe("trusted observation window contract", () => {
    it("accepts only complete read windows within the inclusive 60-second limit in both environments", () => {
        const durations = fc.oneof(fc.constantFrom(-1, 0, 60000, 60001), fc.integer({ min: -120000, max: 120000 }));
        fc.assert(
            fc.property(fc.integer({ min: 0, max: 86400000 }), durations, (offset, duration) => {
                const startedAt = Date.UTC(2026, 10, 2) + offset;
                const event = {
                    ...payload().event,
                    snapshotReadStartedAt: new Date(startedAt).toISOString(),
                    snapshotReadCompletedAt: new Date(startedAt + duration).toISOString(),
                };
                const sandbox = { ...payload(), event };
                const production = { ...sandbox, source: { system: "netsuite", accountId: "4552704", environment: "production" } };
                const valid = duration >= 0 && duration <= 60000;
                expect(persistedOrderEvent.safeParse(sandbox).success).toBe(valid);
                expect(productionOrderEvent.safeParse(production).success).toBe(valid);
                expect(persistedOrderEvent.safeParse(production).success).toBe(false);
                expect(productionOrderEvent.safeParse(sandbox).success).toBe(false);
            }),
            { numRuns: 300 },
        );
    });

    it("rejects generated mismatches between the event and snapshot order IDs", () => {
        fc.assert(
            fc.property(fc.integer({ min: 1, max: 999999 }), fc.integer({ min: 1, max: 999999 }), (id, delta) => {
                const input = payload();
                input.event.netsuiteId = String(id);
                input.snapshot.data.id = String(id + delta);
                expect(persistedOrderEvent.safeParse(input).success).toBe(false);
            }),
            { numRuns: 200 },
        );
    });
    it("keeps historical v2 reception and requires proof for extended projection", () => {
        const input = payload();
        expect(persistedOrderEvent.safeParse(input).success).toBe(true);
        Object.assign(input.snapshot.data.fields, { crm_sync_projection: 1 });
        expect(persistedOrderEvent.safeParse(input).success).toBe(false);
        Object.assign(input.event, { snapshotReadStartedAt: "2026-11-02T20:00:01.000Z", snapshotReadCompletedAt: "2026-11-02T20:00:01.500Z" });
        expect(persistedOrderEvent.safeParse(input).success).toBe(true);
    });
    it.each([{ snapshotReadStartedAt: "2026-11-02T20:00:01.000Z" }, { snapshotReadCompletedAt: "2026-11-02T20:00:01.000Z" }, { snapshotReadStartedAt: "2026-11-02T20:00:02.000Z", snapshotReadCompletedAt: "2026-11-02T20:00:01.000Z" }, { snapshotReadStartedAt: "2026-11-02T20:00:01.000Z", snapshotReadCompletedAt: "2026-11-02T20:01:02.000Z" }])("rejects partial, backwards or excessive read windows: %j", (window) => {
        const input = payload();
        Object.assign(input.event, window);
        expect(persistedOrderEvent.safeParse(input).success).toBe(false);
    });
});
