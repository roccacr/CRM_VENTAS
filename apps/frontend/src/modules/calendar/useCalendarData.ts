import { useCallback, useEffect, useMemo, useState } from "react";

import { type CalendarDescriptor, type CalendarEvent, type CalendarInterval, type CalendarModule, getCalendarFeed, getCalendars, type OutlookFeedStatus } from "../../services/calendar/calendar-service";

/** La clave de la petición oculta de inmediato los datos viejos. Al limpiar se descarta una respuesta tardía aunque el transporte no pueda abortar. */
export function useCalendarData(module: CalendarModule, readableModules: readonly CalendarModule[], authorizationKey: string) {
    const [catalog, setCatalog] = useState<{ key: string; calendars: CalendarDescriptor[]; error: boolean }>({ key: "", calendars: [], error: false });
    const [selected, setSelected] = useState<readonly CalendarModule[]>([module]);
    const [interval, setInterval] = useState<CalendarInterval>({ start: "", end: "" });
    const [revision, setRevision] = useState(0);
    const [result, setResult] = useState<{ key: string; events: CalendarEvent[]; error: boolean; outlookStatus?: OutlookFeedStatus }>({ key: "", events: [], error: false });
    const catalogKey = `${authorizationKey}:${readableModules.join(",")}:${String(revision)}`;
    useEffect(() => {
        let active = true;
        void getCalendars().then(
            (calendars) => {
                if (active) setCatalog({ key: catalogKey, calendars, error: false });
            },
            () => {
                if (active) setCatalog({ key: catalogKey, calendars: [], error: true });
            },
        );
        return () => {
            active = false;
        };
    }, [catalogKey]);
    const calendars = useMemo(() => (catalog.key === catalogKey ? catalog.calendars.filter((entry) => readableModules.includes(entry.moduleCode)) : []), [catalog, catalogKey, readableModules]);
    const selectedModules = calendars.map((entry) => entry.moduleCode).filter((code) => selected.includes(code));
    const modulesKey = selectedModules.join(",");
    const { start, end } = interval;
    const requestKey = JSON.stringify([module, modulesKey, start, end, revision, catalogKey]);
    useEffect(() => {
        if (!modulesKey || !start || !end) return;
        let active = true;
        const modules = modulesKey.split(",") as CalendarModule[];
        void getCalendarFeed(modules, { start, end }, module).then(
            (feed) => {
                if (active) setResult({ key: requestKey, ...feed, error: false });
            },
            () => {
                if (active) setResult({ key: requestKey, events: [], error: true });
            },
        );
        return () => {
            active = false;
        };
    }, [module, modulesKey, start, end, requestKey]);
    const refresh = () => {
        setRevision((value) => value + 1);
    };
    const toggle = (code: CalendarModule) => {
        setSelected((previous) => (previous.includes(code) ? previous.filter((entry) => entry !== code) : [...previous, code]));
    };
    const updateInterval = useCallback((next: CalendarInterval) => {
        setInterval((previous) => (previous.start === next.start && previous.end === next.end ? previous : next));
    }, []);
    const visibleResult = result.key === requestKey ? result : { events: [], error: false, outlookStatus: undefined };
    const catalogError = catalog.key === catalogKey ? catalog.error : false;
    return { calendars, selectedModules, toggle, updateInterval, refresh, events: visibleResult.events, outlookStatus: visibleResult.outlookStatus, error: catalogError || visibleResult.error, loading: requestLoading({ catalogReady: catalog.key === catalogKey, resultReady: result.key === requestKey, modulesKey, start }) };
}
function requestLoading({ catalogReady, resultReady, modulesKey, start }: { catalogReady: boolean; resultReady: boolean; modulesKey: string; start: string }) {
    return !catalogReady || Boolean(modulesKey && (!start || !resultReady));
}
