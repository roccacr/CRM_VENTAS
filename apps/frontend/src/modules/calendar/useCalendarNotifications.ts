import { useCallback, useEffect, useState } from "react";

import { type CalendarNotification, getCalendarNotifications, markCalendarNotificationRead } from "../../services/calendar/calendar-service";

/** Calendario consulta su propia campana incluso cuando el socket de notas está conectado. */
export function useCalendarNotifications(enabled: boolean) {
    const [data, setData] = useState<Awaited<ReturnType<typeof getCalendarNotifications>>>({ items: [], unreadCount: 0 });
    const [failure, setFailure] = useState("");
    const refresh = useCallback(async () => {
        try {
            setData(await getCalendarNotifications());
            setFailure("");
        } catch {
            setFailure("No se pudieron cargar los avisos del calendario.");
        }
    }, []);
    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        const update = async () => {
            if (document.visibilityState === "hidden") return;
            try {
                const next = await getCalendarNotifications();
                if (!controller.signal.aborted) {
                    setData(next);
                    setFailure("");
                }
            } catch {
                if (!controller.signal.aborted) setFailure("No se pudieron cargar los avisos del calendario.");
            }
        };
        void update();
        const timer = window.setInterval(() => {
            void update();
        }, 30000);
        const onFocus = () => {
            void update();
        };
        window.addEventListener("focus", onFocus);
        window.addEventListener("calendar-notifications-changed", onFocus);
        return () => {
            controller.abort();
            window.clearInterval(timer);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("calendar-notifications-changed", onFocus);
        };
    }, [enabled]);
    const mark = async (item: CalendarNotification) => {
        try {
            await markCalendarNotificationRead(item.id);
            await refresh();
        } catch {
            setFailure("No se pudo marcar el aviso como leído.");
        }
    };
    return { ...data, failure, mark, refresh };
}
