import { describe, expect, it } from "vitest";

import { planSalesOrderCancellation } from "../../src/integrations/netsuite/netsuite-sales-order-cancellation.handler.js";

describe("Order-only cancellation parity", () => {
    it.each(["native", "legacy"] as const)("records the Costa Rica date only on a transition to marked: %s", (destination) => {
        const flag = destination === "native" ? { before: "no", after: "yes" as const } : { before: 0, after: 1 as const };
        const result = planSalesOrderCancellation({ destination, before: {}, changes: [{ field: "custbody43", column: "ignored", ...flag }], at: new Date("2026-11-03T02:00:00.000Z") });
        expect(result).toEqual([{ field: "cancellationMarkedOn", column: destination === "native" ? "cancellation_marked_on_sales_order" : "envioReservaCaida", before: null, after: "2026-11-02" }]);
    });
    it.each(["native", "legacy"] as const)("does not renew the date for an unchanged marked flag: %s", (destination) => {
        expect(planSalesOrderCancellation({ destination, before: { envioReservaCaida: "2026-10-01" }, changes: [], at: new Date() })).toEqual([]);
    });
    it.each(["native", "legacy"] as const)("keeps the date when unmarking: %s", (destination) => {
        const change = destination === "native" ? { before: "yes", after: "no" as const } : { before: 1, after: 0 as const };
        expect(planSalesOrderCancellation({ destination, before: { envioReservaCaida: "2026-10-01" }, changes: [{ field: "custbody43", column: "ignored", ...change }], at: new Date() })).toEqual([]);
    });
    it("replaces the historical date on a new mark and never plans other business side effects", () => {
        const result = planSalesOrderCancellation({ destination: "legacy", before: { envioReservaCaida: "2026-01-01", status_ov: 1, pagadas_ov: 1 }, changes: [{ field: "custbody43", column: "caida_ov", before: 0, after: 1 }], at: new Date("2026-11-02T17:00:00Z") });
        expect(result).toEqual([{ field: "cancellationMarkedOn", column: "envioReservaCaida", before: "2026-01-01", after: "2026-11-02" }]);
    });
});
