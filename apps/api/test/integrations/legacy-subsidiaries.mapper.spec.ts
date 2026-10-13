import { describe, expect, it } from "vitest";

import { mapLegacySubsidiary } from "../../src/integrations/legacy-crm/subsidiaries/legacy-subsidiaries.mapper.js";

describe("Subsidiaries canonical legacy mapping", () => {
    it("retains identity and signed provider references without fabricating timestamps", () => {
        expect(mapLegacySubsidiary({ legacyId: 42, name: " Subsidiary ", externalId: -5, status: 1 })).toEqual({ publicId: "legacy:subsidiaries:42", nativeCode: "legacy_subsidiaries_42", id_old_produccion: 42, name: "Subsidiary", detail: null, status: "active", updatedAt: "", externalReferences: [{ systemCode: "netsuite", systemName: "NetSuite", externalId: "-5", status: "active" }] });
    });
    it.each([0, null])("maps nullable fields and inactive status %s", (status) => {
        expect(mapLegacySubsidiary({ legacyId: 42, name: null, externalId: null, status })).toMatchObject({ name: "Sin asignar", status: "inactive", externalReferences: [] });
    });
    it("rejects unsupported statuses instead of silently publishing incorrect data", () => {
        expect(() => mapLegacySubsidiary({ legacyId: 42, name: "Subsidiary", externalId: 5, status: 2 })).toThrow();
    });
});
