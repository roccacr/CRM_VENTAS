import { toBitacoraInput, toErrorMessage, valueOrFallback } from "../../src/kapso-cronjobs/envio-template-inicial/envio-template-inicial.mapping";

const lead = {
    accionLead: 0,
    estadoLead: 2,
    idCaida: 0,
    idEmpleadoLead: 653055,
    idLead: 36640,
    idinternoLead: 6430001,
    idproyectoLead: 4,
    nombreLead: "Cliente Uno",
    proyectoLead: "La Estefana",
    segiminetoLead: "01-LEAD-INTERESADO",
    telefonoLead: "7045-2222",
    whatsappTemplateContactSent: 2,
};

describe("valueOrFallback", () => {
    it("keeps a usable name", () => {
        expect(valueOrFallback(" Roberto ", "cliente")).toBe("Roberto");
    });

    it.each([null, undefined, "", "   "])("uses the fallback when value is %s", (value) => {
        expect(valueOrFallback(value, "cliente")).toBe("cliente");
    });
});

describe("toErrorMessage", () => {
    it("reads Error.message", () => {
        expect(toErrorMessage(new Error("Kapso down"))).toBe("Kapso down");
    });

    it("stringifies non-Error values", () => {
        expect(toErrorMessage("timeout")).toBe("timeout");
    });
});

describe("toBitacoraInput", () => {
    it("omits idCaidaBit when the caller does not define it", () => {
        expect(toBitacoraInput(lead, { detalleBit: "skip", idAdminBit: 653055 })).not.toHaveProperty("idCaidaBit");
    });

    it("keeps explicit null caida instead of dropping the field", () => {
        expect(toBitacoraInput(lead, { detalleBit: "unmapped", idAdminBit: 653055, idCaidaBit: null }).idCaidaBit).toBeNull();
    });

    it("falls back to idLead when idinternoLead is missing", () => {
        expect(toBitacoraInput({ ...lead, idinternoLead: null }, { detalleBit: "skip", idAdminBit: 0 }).idLeadBit).toBe(36640);
    });
});
