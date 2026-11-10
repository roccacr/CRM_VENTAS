import type { OutlookEventDetail } from "../../services/calendar/calendar-service";

const SENSITIVITY: Record<string, string> = { normal: "Normal", personal: "Personal", private: "Privado", confidential: "Confidencial" };

/** Banderas que se leen de un vistazo junto al título. Lo demás no se repite. */
export function outlookTags(detail: OutlookEventDetail | undefined): string[] {
    if (!detail) return [];
    return [detail.isRecurring ? "Serie" : "", detail.importance === "high" ? "Importancia alta" : "", detail.sensitivity === "private" || detail.sensitivity === "confidential" ? (SENSITIVITY[detail.sensitivity] ?? "") : ""].filter(Boolean);
}
