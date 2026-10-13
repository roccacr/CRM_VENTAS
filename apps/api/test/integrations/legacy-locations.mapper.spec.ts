import { describe, expect, it } from "vitest";

import { mapLegacyLocation } from "../../src/integrations/legacy-crm/locations/legacy-locations.mapper.js";

describe("Locations canonical legacy mapping", () => {
    it("retains identity and signed provider references without fabricating timestamps", () => {
        expect(mapLegacyLocation({ legacyId: 42, name: " Location ", externalId: -5, status: 1 })).toEqual({ publicId: "legacy:locations:42", nativeCode: "legacy_locations_42", id_old_produccion: 42, name: "Location", detail: null, status: "active", updatedAt: "", externalReferences: [{ systemCode: "netsuite", systemName: "NetSuite", externalId: "-5", status: "active" }] });
    });
    it.each([0, null])("maps nullable fields and inactive status %s", (status) => {
        expect(mapLegacyLocation({ legacyId: 42, name: null, externalId: null, status })).toMatchObject({ name: "Sin asignar", status: "inactive", externalReferences: [] });
    });
    it("rejects unsupported statuses instead of silently publishing incorrect data", () => {
        expect(() => mapLegacyLocation({ legacyId: 42, name: "Location", externalId: 5, status: 2 })).toThrow();
    });
});
