import { describe, expect, it } from "vitest";

import { mapLegacySalesOrder } from "../../src/integrations/legacy-crm/sales-order.mapper.js";

const row = { id_ov: 24, id_ov_netsuite: 900, id_ov_tranid: "OV24", status_ov: 1, caida_ov: 0, aprobacion__rdr_ov: 1, chekJefeVenta: 1, aprobacion_forma_ov: 0, pre_lista_ov: "229000.0000", trandate_ov: "2026-10-20", id_ov_est: 81 };
const observedAt = "2026-10-20T20:00:00Z";

describe("legacy sales-order observation", () => {
    it("maps the confirmed approval fields and preserves every original field", () => {
        const result = mapLegacySalesOrder(row, observedAt);
        expect(result.approvals).toEqual({ sales_management: "approved", developer: "approved", formalization: "not_approved" });
        expect(result.observedState).toEqual({ code: "pending_approval", effectiveAt: null, actor: null });
        expect(result.provenance.originalRecord).toEqual(row);
        expect(result.externalReferences).toEqual([{ systemCode: "netsuite", externalId: "900", transactionNumber: "OV24" }]);
        expect(result.identity).toEqual({ legacyId: 24, nativeCode: "LEGACY-OV-24" });
    });
    it.each([{ status_ov: 0 }, { caida_ov: 1 }, { aprobacion__rdr_ov: 0 }, { chekJefeVenta: 0 }, { aprobacion_forma_ov: 1 }, { aprobacion_forma_ov: null }])("does not invent another state when entry conditions are absent: %j", (changes) => {
        expect(mapLegacySalesOrder({ ...row, ...changes }, observedAt).observedState.code).toBe("unclassified");
    });
    it("does not interpret ambiguous numbers, invalid dates or unknown approval flags", () => {
        const result = mapLegacySalesOrder({ ...row, aprobacion_forma_ov: 8, pre_lista_ov: "1,234.50", trandate_ov: "2026-02-30" }, observedAt);
        expect(result.approvals.formalization).toBe("unknown");
        expect(result.commercial.listPrice).toBeNull();
        expect(result.commercial.transactionDate).toBeNull();
        expect(result.commercial.currencyCode).toBeNull();
    });
});
