import { ENVIO_TEMPLATE_INICIAL_TEMPLATE_LANGUAGE, ENVIO_TEMPLATE_INICIAL_TEMPLATE_NAME } from "./envio-template-inicial.constants";
import { SendSaludoTemplateInput } from "./kapso-template-message.types";

const WHATSAPP_PRODUCT = {
    MESSAGING_PRODUCT: "whatsapp",
    RECIPIENT_TYPE: "individual",
    TEMPLATE_TYPE: "template",
} as const;

export type SaludoTemplatePayload = {
    readonly biz_opaque_callback_data: string;
    readonly messaging_product: "whatsapp";
    readonly recipient_type: "individual";
    readonly template: {
        readonly components: [
            {
                readonly parameters: [{ readonly text: string; readonly type: "text" }, { readonly text: string; readonly type: "text" }, { readonly text: string; readonly type: "text" }];
                readonly type: "body";
            },
        ];
        readonly language: { readonly code: string };
        readonly name: string;
    };
    readonly to: string;
    readonly type: "template";
};

/**
 * Payload del template `saludo`.
 *
 * `biz_opaque_callback_data` es el puente con el webhook de respuesta:
 * el boton del cliente vuelve con `crm_lead:{id}` y el webhook localiza el lead
 * sin guardar el wamid como indice principal.
 */
export function createSaludoTemplatePayload(input: SendSaludoTemplateInput): SaludoTemplatePayload {
    return {
        biz_opaque_callback_data: `crm_lead:${input.leadId};template:${ENVIO_TEMPLATE_INICIAL_TEMPLATE_NAME}`,
        messaging_product: WHATSAPP_PRODUCT.MESSAGING_PRODUCT,
        recipient_type: WHATSAPP_PRODUCT.RECIPIENT_TYPE,
        template: {
            components: [
                {
                    parameters: [
                        { text: input.leadName, type: "text" },
                        { text: input.adminName, type: "text" },
                        { text: input.projectName, type: "text" },
                    ],
                    type: "body",
                },
            ],
            language: { code: ENVIO_TEMPLATE_INICIAL_TEMPLATE_LANGUAGE },
            name: ENVIO_TEMPLATE_INICIAL_TEMPLATE_NAME,
        },
        to: input.to,
        type: WHATSAPP_PRODUCT.TEMPLATE_TYPE,
    };
}
