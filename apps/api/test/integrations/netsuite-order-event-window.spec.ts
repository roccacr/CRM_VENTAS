import { describe, expect, it } from "vitest";

import { persistedOrderEvent } from "../../src/integrations/netsuite/netsuite-order-event.contract.js";

function payload() {
    return { schemaVersion: 2, source: { system: "netsuite", accountId: "4552704_SB1", environment: "sandbox" }, event: { recordType: "salesorder", netsuiteId: "123", eventType: "edit", observedAt: "2026-11-02T20:00:00.000Z", eventId: "11111111-1111-4111-8111-111111111111", sourceModifiedAt: "2026-11-02T20:00:00.000Z" }, snapshot: { status: 200, data: { type: "salesorder", id: "123", fields: {}, sublists: { item: [] } } } };
}
describe("trusted observation window contract", () => {
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
