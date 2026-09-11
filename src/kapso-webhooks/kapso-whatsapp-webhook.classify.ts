import { normalizeResponseText } from "./kapso-whatsapp-webhook.payload";

export type CustomerResponseKind = "accepted_info" | "rejected_info" | "unmapped_response";

const ACCEPTED_RESPONSE = "si enviar informacion";
const REJECTED_RESPONSE = "no gracias";

/**
 * Clasifica el texto del boton/mensaje del template `saludo`.
 * Cualquier otra frase queda `unmapped_response` (se bitacorea, no cambia caida).
 */
export function classifyCustomerResponse(responseText: string | null): CustomerResponseKind {
    const normalized = normalizeResponseText(responseText);

    if (normalized === ACCEPTED_RESPONSE) {
        return "accepted_info";
    }

    if (normalized === REJECTED_RESPONSE) {
        return "rejected_info";
    }

    return "unmapped_response";
}
