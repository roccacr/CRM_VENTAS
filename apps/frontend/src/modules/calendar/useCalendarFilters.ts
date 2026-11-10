import { useMemo, useState } from "react";

import type { CalendarEvent } from "../../services/calendar/calendar-service";
import { visibleEvents } from "./calendar-view-tools";

/** Texto de búsqueda y los interruptores de tipo y de Outlook. Solo cambian lo dibujado. No cambian lo cargado. */
export function useCalendarFilters(events: readonly CalendarEvent[]) {
    const [query, setQuery] = useState("");
    const [hiddenTypes, setHiddenTypes] = useState<ReadonlySet<string>>(new Set());
    const [showOutlook, setShowOutlook] = useState(true);
    const visible = useMemo(() => visibleEvents(events, { query, hiddenTypes, showOutlook }), [events, query, hiddenTypes, showOutlook]);
    const toggleType = (code: string) => {
        setHiddenTypes((previous) => {
            const next = new Set(previous);
            if (!next.delete(code)) next.add(code);
            return next;
        });
    };
    const toggleOutlook = () => {
        setShowOutlook((previous) => !previous);
    };
    return { query, setQuery, hiddenTypes, showOutlook, visible, toggleType, toggleOutlook };
}
