import { describe, expect, it } from "vitest";

import { mapLegacyBroker } from "../../src/integrations/legacy-crm/brokers/legacy-brokers.mapper.js";

describe("Brokers canonical legacy mapping", () => {
    it("retains identity and signed provider references without fabricating timestamps", () => {
        expect(mapLegacyBroker({ legacyId: 42, name: " Broker ", externalId: -5, status: 1 })).toEqual({ publicId: "legacy:brokers:42", nativeCode: "legacy_brokers_42", id_old_produccion: 42, name: "Broker", detail: null, status: "active", updatedAt: "", externalReferences: [{ systemCode: "netsuite", systemName: "NetSuite", externalId: "-5", status: "active" }] });
    });
    it.each([0, null])("maps nullable fields and inactive status %s", (status) => {
        expect(mapLegacyBroker({ legacyId: 42, name: null, externalId: null, status })).toMatchObject({ name: "Sin asignar", status: "inactive", externalReferences: [] });
    });
    it("rejects unsupported statuses instead of silently publishing incorrect data", () => {
        expect(() => mapLegacyBroker({ legacyId: 42, name: "Broker", externalId: 5, status: 2 })).toThrow();
    });
    it("never exposes obsolete legacy fields in the canonical contract", () => {
        const item = mapLegacyBroker({ legacyId: 7, name: "Broker", externalId: 19, status: 1, valoridNetsuite: 99, categoria_corredor: "obsolete", empresa_corredor: "obsolete", telefono_corredor: "obsolete", correo__corredor: "obsolete" });
        expect(Object.keys(item).sort()).toEqual(["publicId", "nativeCode", "id_old_produccion", "name", "detail", "status", "updatedAt", "externalReferences"].sort());
        expect(item.externalReferences).toEqual([{ systemCode: "netsuite", systemName: "NetSuite", externalId: "19", status: "active" }]);
    });
});
