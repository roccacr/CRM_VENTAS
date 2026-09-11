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

export function readStringPath(payload: unknown, path: readonly string[]): string | null {
    let current: unknown = payload;

    for (const segment of path) {
        if (!current || Array.isArray(current) || typeof current !== "object") {
            return null;
        }

        current = (current as Record<string, unknown>)[segment];
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
