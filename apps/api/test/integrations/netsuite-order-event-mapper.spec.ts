import { describe, expect, it } from "vitest";

import { mapOrderFlags, orderFlagMappings } from "../../src/integrations/netsuite/netsuite-order-event.mapper.js";

describe("NetSuite operational flags", () => {
    it("maps exactly the ten audited checkboxes to both destinations", () => {
        expect(orderFlagMappings).toHaveLength(10);
        const fields: Record<string, unknown> = Object.fromEntries(orderFlagMappings.map((field) => [field.netsuite, true]));
        const changes = mapOrderFlags(fields, "native", {});
        expect(changes).toHaveLength(10);
        expect(changes.find((change) => change.field === "custbody_cuotas_pagadas")).toMatchObject({ column: "installments_fully_paid_sales_order", after: "yes" });
        expect(mapOrderFlags(fields, "legacy", {}).every((change) => change.after === 1)).toBe(true);
    });
    it.each([
        [true, "yes", 1],
        [false, "no", 0],
        ["T", "yes", 1],
        ["F", "no", 0],
    ])("converts %s without truthiness coercion", (value, native, legacy) => {
        const fields: Record<string, unknown> = Object.fromEntries(orderFlagMappings.map((field) => [field.netsuite, value]));
        expect(mapOrderFlags(fields, "native", {}).every((change) => change.after === native)).toBe(true);
        expect(mapOrderFlags(fields, "legacy", {}).every((change) => change.after === legacy)).toBe(true);
    });
    it.each([undefined, null, "false", "true", 0, 1, ""])("rejects missing or ambiguous flags: %s", (value) => {
        const fields: Record<string, unknown> = Object.fromEntries(orderFlagMappings.map((field) => [field.netsuite, true]));
        fields.custbody_cuotas_pagadas = value;
        expect(() => mapOrderFlags(fields, "native", {})).toThrow();
    });
    it("reports only actual changes and preserves the previous value", () => {
        const fields: Record<string, unknown> = Object.fromEntries(orderFlagMappings.map((field) => [field.netsuite, false]));
        const before = Object.fromEntries(orderFlagMappings.map((field) => [field.native, "no"]));
        expect(mapOrderFlags(fields, "native", before)).toEqual([]);
        before.installments_fully_paid_sales_order = "unknown";
        expect(mapOrderFlags(fields, "native", before)).toEqual([{ field: "custbody_cuotas_pagadas", column: "installments_fully_paid_sales_order", before: "unknown", after: "no" }]);
    });
});
