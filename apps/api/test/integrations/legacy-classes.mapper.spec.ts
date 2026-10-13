import { describe, expect, it } from "vitest";

import { mapLegacyClass } from "../../src/integrations/legacy-crm/classes/legacy-classes.mapper.js";

describe("Classes canonical legacy mapping", () => {
    it("retains identity and signed provider references without fabricating timestamps", () => {
        expect(mapLegacyClass({ legacyId: 42, name: " Class ", externalId: -5, status: 1 })).toEqual({ publicId: "legacy:classes:42", nativeCode: "legacy_classes_42", id_old_produccion: 42, name: "Class", detail: null, status: "active", updatedAt: "", externalReferences: [{ systemCode: "netsuite", systemName: "NetSuite", externalId: "-5", status: "active" }] });
    });
    it.each([0, null])("maps nullable fields and inactive status %s", (status) => {
        expect(mapLegacyClass({ legacyId: 42, name: null, externalId: null, status })).toMatchObject({ name: "Sin asignar", status: "inactive", externalReferences: [] });
    });
    it("rejects unsupported statuses instead of silently publishing incorrect data", () => {
        expect(() => mapLegacyClass({ legacyId: 42, name: "Class", externalId: 5, status: 2 })).toThrow();
    });
});
