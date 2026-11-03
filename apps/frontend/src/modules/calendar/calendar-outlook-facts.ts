import type { OutlookEventDetail } from "../../services/calendar/calendar-service";

const SENSITIVITY: Record<string, string> = { normal: "Normal", personal: "Personal", private: "Privado", confidential: "Confidencial" };

/** Flags worth reading at a glance next to the title; nothing else is repeated. */
export function outlookTags(detail: OutlookEventDetail | undefined): string[] {
    if (!detail) return [];
    return [detail.isRecurring ? "Serie" : "", detail.importance === "high" ? "Importancia alta" : "", detail.sensitivity === "private" || detail.sensitivity === "confidential" ? (SENSITIVITY[detail.sensitivity] ?? "") : ""].filter(Boolean);
}
