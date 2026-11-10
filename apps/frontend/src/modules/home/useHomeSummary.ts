import { useEffect, useRef, useState } from "react";

import { getHomeSummary, type HomeSummary } from "../../services/formalization/home-summary-service";

/** Lecturas locales al montar, al volver el foco o la pestaña y al reintentar. Estos contadores no son en tiempo real. */
export function useHomeSummary(enabled: boolean, refreshVersion = 0) {
    const [value, setValue] = useState<HomeSummary | null>(null);
    const [failed, setFailed] = useState(false);
    const [wasEnabled, setWasEnabled] = useState(enabled);
    // Una promesa en curso compartida evita repetir foco, visibilidad y reintento. Una respuesta vieja se ignora.
    const request = useRef<Promise<HomeSummary> | null>(null);
    // Puente para que el `retry` devuelto llame al `read` que pertenece al efecto.
    const refresh = useRef<() => void>(() => {});
    // Se limpia durante la transición de render para que un Inicio reactivado no pinte conteos anteriores.
    if (wasEnabled !== enabled) {
        setWasEnabled(enabled);
        setValue(null);
        setFailed(false);
    }
    useEffect(() => {
        if (!enabled) {
            request.current = null;
            return;
        }
        let active = true;
        const read = () => {
            setValue(null);
            setFailed(false);
            request.current ??= getHomeSummary();
            const pending = request.current;
            void pending
                .then((result) => {
                    if (active && request.current === pending) setValue(result);
                })
                .catch(() => {
                    if (active && request.current === pending) setFailed(true);
                })
                .finally(() => {
                    if (request.current === pending) request.current = null;
                });
        };
        const onFocus = () => {
            if (document.visibilityState === "visible" && !request.current) read();
        };
        refresh.current = () => {
            if (!request.current) read();
        };
        read();
        window.addEventListener("focus", onFocus);
        document.addEventListener("visibilitychange", onFocus);
        return () => {
            active = false;
            refresh.current = () => {};
            window.removeEventListener("focus", onFocus);
            document.removeEventListener("visibilitychange", onFocus);
        };
    }, [enabled, refreshVersion]);
    return {
        value: enabled ? value : null,
        failed: enabled && failed,
        retry: () => {
            refresh.current();
        },
    };
}
