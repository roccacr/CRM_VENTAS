import { describe, expect, it } from "vitest";

import { mapOrderFields, orderApprovalMappings, orderFieldMappings, readOrderRelationValues } from "../../src/integrations/netsuite/netsuite-order-event.mapper.js";

const fields = () => ({ crm_currency_iso: "USD", crm_sync_projection: 1, initialtranid: "RDR123", custbody_aprueba_jefe_ventas: true, custbodyid_firma_rocca: false, custbodyid_firma_rc: "T", custbody74: true, custbody73: "F", custbody13: "125000.1500", custbody17: "120000", custbody_ix_total_amount: 130000, custbody21: "3500.25", crm_transaction_date: "2026-11-02" });

describe("NetSuite extended order projection", () => {
    it("uses only the confirmed legacy relation sources and preserves the estimate from CRM creation", () => {
        const result = readOrderRelationValues({ crm_sync_projection: 1, entity: "10", custbody38: "20", subsidiary: "30", opportunity: "40", crm_owner_employee: "50", salesrep: "999", createdfrom: "888" });
        expect(result).toEqual({ entity: "10", custbody38: "20", subsidiary: "30", opportunity: "40", crm_owner_employee: "50" });
    });
    it.each(["native", "legacy"] as const)("maps every declared direct field in %s without CRM internals", (destination) => {
        const changes = mapOrderFields({ ...fields(), status_ov: 0, id_sales_order: 999, pagadas_ov: 1 }, destination, {});
        expect(changes).toHaveLength(orderFieldMappings.length + orderApprovalMappings.length + 1);
        expect(changes.find((change) => change.field === "custbody21")?.after).toBe("3500.2500");
        expect(changes.find((change) => change.field === "custbody74")?.after).toBe(destination === "native" ? "yes" : 1);
        expect(changes.some((change) => ["status_ov", "id_sales_order", "pagadas_ov"].includes(change.column))).toBe(false);
    });
    it("preserves the existing v2 contract until the producer declares the extended projection", () => {
        expect(mapOrderFields({ custbody13: "invalid legacy display" }, "native", {})).toEqual([]);
    });
    it("compares decimals semantically without losing precision or recording false diffs", () => {
        const before = {
            currency_code_sales_order: "USD",
            transaction_number_sales_order_external_reference: "RDR123",
            approval_sales_management: "approved",
            approval_developer: "not_approved",
            approval_formalization: "approved",
            list_price_sales_order: "125000.1500",
            net_sale_price_sales_order: "120000.0000",
            sale_price_sales_order: "130000.0000",
            advisor_commission_sales_order: "3500.2500",
            transaction_date_sales_order: new Date(2026, 10, 2),
            advisor_commission_calculated_sales_order: "yes",
            broker_commission_calculated_sales_order: "no",
        };
        expect(mapOrderFields(fields(), "native", before)).toEqual([]);
    });
    it.each(["12,500", "NaN", "1e6", "1000000000000000", "0.00001", true, undefined])("rejects ambiguous or lossy money %s", (value) => {
        expect(() => mapOrderFields({ ...fields(), custbody13: value }, "native", {})).toThrow();
    });
    it.each(["02/11/2026", "2026-02-30", "2026-13-01", undefined])("rejects non-calendar dates %s", (value) => {
        expect(() => mapOrderFields({ ...fields(), crm_transaction_date: value }, "native", {})).toThrow();
    });
    it("propagates explicit empty money as NULL instead of zero", () => {
        expect(mapOrderFields({ ...fields(), custbody21: null }, "legacy", { comison_asesor_ov: "50" }).find((change) => change.field === "custbody21")).toEqual({ field: "custbody21", column: "comison_asesor_ov", before: "50", after: null });
    });
    it.each(["native", "legacy"] as const)("preserves columns without a legacy writer in %s", (destination) => {
        const changes = mapOrderFields({ ...fields(), crm_currency_iso: "USD", custbody73: true }, destination, { currency_code_sales_order: "CRC", broker_commission_calculated_sales_order: "no", calculo_comision_corredor_ov: 0 });
        expect(changes.some((change) => ["crm_currency_iso", "custbody73"].includes(change.field))).toBe(false);
    });
    it("does not silently accept another projection version", () => {
        expect(() => mapOrderFields({ ...fields(), crm_sync_projection: 2 }, "native", {})).toThrow();
    });
    it.each(["native", "legacy"] as const)("maps three approvals without treating a false checkbox as approval in %s", (destination) => {
        const changes = mapOrderFields(fields(), destination, {});
        expect(changes.find((change) => change.field === "custbodyid_firma_rocca")?.after).toBe(destination === "native" ? "not_approved" : 0);
        expect(changes.find((change) => change.field === "initialtranid")?.column).toBe(destination === "native" ? "transaction_number_sales_order_external_reference" : "id_ov_tranid");
    });
    it("rejects text which would be truncated by the legacy column", () => {
        expect(() => mapOrderFields({ ...fields(), initialtranid: "x".repeat(51) }, "legacy", {})).toThrow();
    });
});
