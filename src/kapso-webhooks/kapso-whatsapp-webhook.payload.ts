const CRM_LEAD_MARKER = /(?:^|[;\s])crm_lead:(\d+)(?:$|[;\s])/i;
const MAX_PAYLOAD_WALK_DEPTH = 8;

const RESPONSE_TEXT_PATHS: readonly (readonly string[])[] = [
    ["message", "interactive", "button_reply", "title"],
    ["message", "interactive", "button_reply", "id"],
    ["message", "button", "text"],
    ["message", "button", "payload"],
    ["message", "text", "body"],
    ["message", "kapso", "content"],
];

const WHATSAPP_MESSAGE_ID_PATHS: readonly (readonly string[])[] = [["message", "id"], ["whatsapp_message_id"], ["raw_payload", "entry", "0", "changes", "0", "value", "statuses", "0", "id"]];

const WHATSAPP_REPLY_CONTEXT_MESSAGE_ID_PATHS: readonly (readonly string[])[] = [
    ["message", "context", "id"],
    ["raw_payload", "entry", "0", "changes", "0", "value", "messages", "0", "context", "id"],
];

const WHATSAPP_PHONE_NUMBER_ID_PATHS: readonly (readonly string[])[] = [["phone_number_id"], ["conversation", "phone_number_id"], ["raw_payload", "entry", "0", "changes", "0", "value", "metadata", "phone_number_id"]];

const WHATSAPP_CUSTOMER_PHONE_PATHS: readonly (readonly string[])[] = [["conversation", "phone_number"], ["message", "from"], ["from"], ["contacts", "0", "wa_id"], ["raw_payload", "entry", "0", "changes", "0", "value", "messages", "0", "from"], ["raw_payload", "entry", "0", "changes", "0", "value", "contacts", "0", "wa_id"]];

const FAILURE_REASON_PATHS: readonly (readonly string[])[] = [
    ["error", "message"],
    ["failure", "message"],
    ["message", "error", "message"],
    ["message", "failure_reason"],
    ["raw_payload", "entry", "0", "changes", "0", "value", "statuses", "0", "errors", "0", "message"],
    ["raw_payload", "entry", "0", "changes", "0", "value", "statuses", "0", "errors", "0", "error_data", "details"],
];

/**
 * Busca `crm_lead:{id}` en cualquier string del payload.
 * El template inicial lo mete en `biz_opaque_callback_data`; Kapso lo
 * reenvia en distintos paths segun tipo de mensaje.
 */
export function extractLeadIdFromPayload(payload: unknown): number | null {
    for (const value of collectStringValues(payload)) {
        const match = CRM_LEAD_MARKER.exec(value);

        if (match?.[1]) {
            return Number(match[1]);
        }
    }

    return null;
}

/** Primer texto usable del boton/mensaje. Orden: interactive → button → text → kapso.content. */
export function extractResponseText(payload: unknown): string | null {
    const candidates = RESPONSE_TEXT_PATHS.map((path) => readStringPath(payload, path));
    return candidates.find((candidate): candidate is string => Boolean(candidate?.trim())) ?? null;
}

/** Id `wamid...` del mensaje WhatsApp. Kapso lo manda como `message.id` en eventos simplificados. */
export function extractWhatsappMessageId(payload: unknown): string | null {
    const direct = WHATSAPP_MESSAGE_ID_PATHS.map((path) => readStringPath(payload, path)).find((candidate): candidate is string => Boolean(candidate));

    if (direct?.startsWith("wamid.")) {
        return direct;
    }

    return collectStringValues(payload).find((value) => value.startsWith("wamid.")) ?? null;
}

/** `wamid...` del mensaje saliente original cuando el cliente responde sobre un template/boton. */
export function extractReplyContextMessageId(payload: unknown): string | null {
    const direct = WHATSAPP_REPLY_CONTEXT_MESSAGE_ID_PATHS.map((path) => readStringPath(payload, path)).find((candidate): candidate is string => Boolean(candidate));
    return direct?.startsWith("wamid.") ? direct : null;
}

/** Numero de WhatsApp/Kapso que recibio el webhook. Sirve para distinguir integraciones. */
export function extractPhoneNumberId(payload: unknown): string | null {
    return WHATSAPP_PHONE_NUMBER_ID_PATHS.map((path) => readStringPath(payload, path)).find((candidate): candidate is string => Boolean(candidate?.trim())) ?? null;
}

/** Telefono del cliente en el webhook. La normalizacion final vive en `common/phone`. */
export function extractCustomerPhoneNumber(payload: unknown): string | null {
    return WHATSAPP_CUSTOMER_PHONE_PATHS.map((path) => readStringPath(payload, path)).find((candidate): candidate is string => Boolean(candidate?.trim())) ?? null;
}

/** Razon de fallo cuando Kapso/Meta la incluye; si no viene, el caller usa un fallback claro. */
export function extractFailureReason(payload: unknown): string | null {
    const fromKnownPaths = FAILURE_REASON_PATHS.map((path) => readStringPath(payload, path)).find((candidate): candidate is string => Boolean(candidate?.trim()));

    if (fromKnownPaths) {
        return fromKnownPaths;
    }

    return collectStringValues(payload).find((value) => /failed|error|experiment|invalid/i.test(value)) ?? null;
}

export function readStringPath(payload: unknown, path: readonly string[]): string | null {
    let current: unknown = payload;

    for (const segment of path) {
        if (!current || typeof current !== "object") {
            return null;
        }

        current = Array.isArray(current) ? current[Number(segment)] : (current as Record<string, unknown>)[segment];
    }

    return typeof current === "string" ? current : null;
}

/**
 * Recorre el JSON hasta `MAX_PAYLOAD_WALK_DEPTH` para no explotar con
 * payloads anidados (Kapso a veces embebe el mensaje original).
 */
function collectStringValues(value: unknown, depth = 0): string[] {
    if (depth > MAX_PAYLOAD_WALK_DEPTH) {
        return [];
    }

    if (typeof value === "string") {
        return [value];
    }

    if (!value || typeof value !== "object") {
        return [];
    }

    if (Array.isArray(value)) {
        return value.flatMap((item) => collectStringValues(item, depth + 1));
    }

    return Object.values(value).flatMap((item) => collectStringValues(item, depth + 1));
}

/** Quita acentos y puntuacion para comparar "Sí, enviar información" con "si enviar informacion". */
export function normalizeResponseText(value: string | null): string {
    return (value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\da-z]+/g, " ")
        .trim();
}
