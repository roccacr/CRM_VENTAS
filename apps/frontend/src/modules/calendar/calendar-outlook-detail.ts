export interface OutlookDescription {
    /** La parte humana del cuerpo, sin el texto fijo de Teams. */
    readonly summary: string;
    /** Enlace de unión de Teams tomado del cuerpo, solo si apunta a teams.microsoft.com por https. */
    readonly joinUrl: string | null;
    readonly meetingId: string | null;
    readonly passcode: string | null;
    /** Referencia interna que el CRM agrega después del bloque de Teams. */
    readonly reference: string | null;
}

const JOIN_LINK = /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"]+/i;
const BOILERPLATE = /_{5,}|Microsoft Teams (?:meeting|reunión)|Reunión de Microsoft Teams/i;
const URL_IN_TEXT = /\s*https?:\/\/[^\s<>"]+/giu;

function safeJoinUrl(text: string): string | null {
    const found = JOIN_LINK.exec(text)?.[0];
    if (!found) return null;
    try {
        const url = new URL(found);
        return url.protocol === "https:" && url.hostname === "teams.microsoft.com" ? url.toString() : null;
    } catch {
        return null;
    }
}

const capture = (text: string, pattern: RegExp): string | null => pattern.exec(text)?.[1] ?? null;

/** El cuerpo de Outlook mezcla una nota corta con el bloque de Teams. Aquí se separan y no se confía en un enlace cualquiera. */
export function parseOutlookDescription(text: string | null): OutlookDescription {
    if (!text) return { summary: "", joinUrl: null, meetingId: null, passcode: null, reference: null };
    const human = text.split(BOILERPLATE)[0] ?? "";
    return {
        // Un enlace largo de seguimiento no aporta a la nota. El enlace de unión tiene su propio botón.
        summary: human.replace(URL_IN_TEXT, "").replace(/^\.+/, "").replace(/\s+/g, " ").trim(),
        joinUrl: safeJoinUrl(text),
        meetingId: capture(text, /(?:Meeting ID|Id\. de reuni\u00f3n):\s*(\d{3}(?: \d{3}){2,4})/i),
        passcode: capture(text, /(?:Passcode|C\u00f3digo de acceso):\s*([A-Za-z0-9]+)/i),
        reference: capture(text, /Referencia del sistema:\s*([A-Za-z0-9._/-]+)/i),
    };
}
