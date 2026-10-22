import { describe, expect, it } from "vitest";

import { legacyStateStatements, salesOrderStatements } from "../../migrations/schema-only/202610200021_sales_orders.js";

describe("sales order schema boundaries", () => {
    it("creates only additive legacy tables without touching ordenventa", () => {
        expect(legacyStateStatements).toHaveLength(2);
        for (const statement of legacyStateStatements) expect(statement).toMatch(/^CREATE TABLE IF NOT EXISTS /);
        expect(legacyStateStatements.join("\n")).not.toMatch(/ALTER TABLE|DROP TABLE|TRIGGER|INSERT INTO ordenventa/i);
    });
    it("separates provider references, approvals and append-only state history", () => {
        const schema = salesOrderStatements.join("\n");
        for (const table of ["crm_sales_order", "crm_sales_order_external_reference", "conf_sales_order_state", "conf_sales_order_approval_type", "crm_sales_order_approval", "audit_sales_order_state_event", "audit_sales_order_approval_event", "int_sales_order_source_snapshot"]) expect(schema).toContain(table);
        expect(schema).not.toMatch(/netsuite|odoo/i);
        expect(schema).toContain("UNIQUE KEY uq_so_state_sequence");
        expect(schema).toContain("UNIQUE KEY uq_so_state_operation");
        expect(schema).toContain("effective_at_sales_order_state_event");
    });
});
