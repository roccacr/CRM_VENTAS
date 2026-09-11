import { classifyCustomerResponse } from "../../src/kapso-webhooks/kapso-whatsapp-webhook.classify";

describe("classifyCustomerResponse", () => {
    it.each(["Sí, enviar información", "si enviar informacion", "¡SÍ!! enviar información.", "SI, ENVIAR INFORMACION"])("classifies accepted response %s", (text) => {
        expect(classifyCustomerResponse(text)).toBe("accepted_info");
    });

    it.each(["No, gracias", "no gracias", "NO GRACIAS!"])("classifies rejected response %s", (text) => {
        expect(classifyCustomerResponse(text)).toBe("rejected_info");
    });

    it.each(["Mejor mañana", "", "si", "gracias", null])("leaves unmapped response %s without changing caida", (text) => {
        expect(classifyCustomerResponse(text)).toBe("unmapped_response");
    });
});
