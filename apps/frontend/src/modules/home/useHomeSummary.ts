import { useEffect, useRef, useState } from "react";

import { getHomeSummary, type HomeSummary } from "../../services/formalization/home-summary-service";

/** Mount-local reads on entry, visible focus/tab return and retry; these counters are not realtime. */
export function useHomeSummary(enabled: boolean, refreshVersion = 0) {
    const [value, setValue] = useState<HomeSummary | null>(null);
    const [failed, setFailed] = useState(false);
    const [wasEnabled, setWasEnabled] = useState(enabled);
    // Shared in-flight promise de-duplicates focus/visibility/retry triggers; a stale response is ignored.
    const request = useRef<Promise<HomeSummary> | null>(null);
    // Bridge so the returned `retry` can call the `read` closure owned by the effect.
    const refresh = useRef<() => void>(() => {});
    // Clear during the render transition so a re-enabled Home cannot paint prior counts.
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
