import { createSaludoTemplatePayload } from "../../src/kapso-cronjobs/envio-template-inicial/kapso-template-message.payload";

describe("createSaludoTemplatePayload", () => {
    const input = {
        adminName: "Roberto Carlos",
        leadId: 36640,
        leadName: "Cliente Uno",
        phoneNumberId: "1197677976762773",
        projectName: "La Estefana",
        to: "50670452222",
    };

    it("embeds crm_lead and template name in biz_opaque_callback_data", () => {
        expect(createSaludoTemplatePayload(input).biz_opaque_callback_data).toBe("crm_lead:36640;template:saludo");
    });

    it("sends the three body parameters in lead, admin, project order", () => {
        expect(createSaludoTemplatePayload(input).template.components[0].parameters).toEqual([
            { text: "Cliente Uno", type: "text" },
            { text: "Roberto Carlos", type: "text" },
            { text: "La Estefana", type: "text" },
        ]);
    });

    it("uses the approved saludo template language", () => {
        const payload = createSaludoTemplatePayload(input);

        expect(payload.template.name).toBe("saludo");
        expect(payload.template.language.code).toBe("es_ES");
        expect(payload.to).toBe("50670452222");
        expect(payload.messaging_product).toBe("whatsapp");
    });
});
