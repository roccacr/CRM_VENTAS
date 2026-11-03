export interface OutlookDescription {
    /** The human part of the body, without the Teams boilerplate. */
    readonly summary: string;
    /** A Teams join link taken from the body, only when it points at teams.microsoft.com over https. */
    readonly joinUrl: string | null;
    readonly meetingId: string | null;
    readonly passcode: string | null;
    /** Internal reference the CRM appends after the Teams block. */
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

/** Outlook bodies mix a short human note with the Teams join block; this separates them without trusting arbitrary links. */
export function parseOutlookDescription(text: string | null): OutlookDescription {
    if (!text) return { summary: "", joinUrl: null, meetingId: null, passcode: null, reference: null };
    const human = text.split(BOILERPLATE)[0] ?? "";
    return {
        // Long tracking links add nothing to a note; the join link has its own button.
        summary: human.replace(URL_IN_TEXT, "").replace(/^\.+/, "").replace(/\s+/g, " ").trim(),
        joinUrl: safeJoinUrl(text),
        meetingId: capture(text, /(?:Meeting ID|Id\. de reuni\u00f3n):\s*(\d{3}(?: \d{3}){2,4})/i),
        passcode: capture(text, /(?:Passcode|C\u00f3digo de acceso):\s*([A-Za-z0-9]+)/i),
        reference: capture(text, /Referencia del sistema:\s*([A-Za-z0-9._/-]+)/i),
    };
}
