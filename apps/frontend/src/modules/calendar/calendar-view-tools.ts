import type { CalendarDescriptor, CalendarEvent, CalendarModule } from "../../services/calendar/calendar-service";

const PRIVATE = ["private", "confidential"];
/** Origen y tipo son señales independientes; sincronizar con Outlook no cambia el módulo CRM. */
export function calendarEventColors(event: CalendarEvent, calendars: readonly CalendarDescriptor[]) {
    const fallback = event.source === "outlook" ? "#0369A1" : "#64748b";
    const calendar = calendars.find((entry) => entry.moduleCode === event.originModule) ?? { color: fallback, label: event.originModule ?? "Outlook" };
    const stored = event.crmDetail ?? { typeColor: fallback, typeLabel: event.typeCode || "Evento Outlook" };
    const type = calendars.flatMap((entry) => entry.types).find((entry) => entry.code === event.typeCode) ?? { color: stored.typeColor || fallback, label: stored.typeLabel };
    return { moduleColor: calendar.color, typeColor: type.color, moduleLabel: calendar.label, typeLabel: type.label };
}
const fold = (text: string) =>
    text
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();

const isTentative = (event: CalendarEvent) => event.outlookDetail?.showAs === "tentative" || event.outlookDetail?.myResponse === "tentativelyAccepted";
const isPrivate = (event: CalendarEvent) => PRIVATE.includes(event.outlookDetail?.sensitivity ?? "");

/** Señales dibujadas en el propio evento: serie, provisional, privado, cancelado y que viene de Outlook. */
export function eventSignals(event: CalendarEvent): string[] {
    const flags: [boolean, string][] = [
        [event.source === "outlook", "cal-event--outlook"],
        [event.status === "cancelled", "cal-event--cancelled"],
        [Boolean(event.outlookDetail?.isRecurring), "cal-event--recurring"],
        [isTentative(event), "cal-event--tentative"],
        [isPrivate(event), "cal-event--private"],
    ];
    return flags.flatMap(([on, name]) => (on ? [name] : []));
}

export interface TypeFilter {
    readonly code: string;
    readonly label: string;
    readonly color: string;
}
/** Una entrada por tipo de evento entre los calendarios visibles, para filtrar juntos los del mismo tipo. */
export function typeFilters(calendars: readonly CalendarDescriptor[], selected: readonly CalendarModule[]): TypeFilter[] {
    const byCode = new Map<string, TypeFilter>();
    for (const calendar of calendars) {
        if (!selected.includes(calendar.moduleCode)) continue;
        for (const type of calendar.types) if (!byCode.has(type.code)) byCode.set(type.code, { code: type.code, label: type.label, color: type.color });
    }
    return [...byCode.values()];
}

export interface ViewFilters {
    readonly query: string;
    readonly hiddenTypes: ReadonlySet<string>;
    readonly showOutlook: boolean;
}
const matches = (event: CalendarEvent, query: string) => !query || fold([event.title, event.location ?? "", event.description ?? ""].join(" ")).includes(query);
/** La búsqueda y los filtros solo cambian lo que se dibuja. Los conteos del periodo cargado quedan como los devolvió el servidor. */
export function visibleEvents(events: readonly CalendarEvent[], filters: ViewFilters): CalendarEvent[] {
    const query = fold(filters.query.trim());
    return events.filter((event) => {
        if (event.source === "outlook" ? !filters.showOutlook : filters.hiddenTypes.has(event.typeCode)) return false;
        return matches(event, query);
    });
}
