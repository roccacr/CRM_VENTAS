import { useCallback, useEffect, useRef, useState } from "react";

export interface Cooldown {
    /** true mientras la acción protegida debe estar deshabilitada. */
    readonly isActive: boolean;
    /** Bloquea sin plazo, por ejemplo mientras una petición sigue en curso. */
    readonly hold: () => void;
    /** Desbloquea de inmediato y cancela cualquier plazo pendiente. */
    readonly release: () => void;
    /** Bloquea durante el plazo configurado y luego desbloquea solo. */
    readonly start: () => void;
}

/**
 * Bloqueo temporal de una acción repetible, como "Reintentar conexión".
 *
 * Evita que el usuario dispare ráfagas de peticiones contra un servicio que
 * acaba de fallar. No arranca solo: al montar la acción sigue habilitada.
 * `hold` y `release` mantienen su identidad. `start` cambia si cambia el plazo,
 * y un temporizador que ya está corriendo conserva la duración con la que empezó.
 * Volver a llamar `start` o `hold` cancela el plazo anterior. `hold` no se suelta solo.
 */
export function useCooldown(durationMs: number): Cooldown {
    const [isActive, setIsActive] = useState(false);
    const timerRef = useRef<number | null>(null);

    const clearTimer = useCallback((): void => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const hold = useCallback((): void => {
        clearTimer();
        setIsActive(true);
    }, [clearTimer]);

    const release = useCallback((): void => {
        clearTimer();
        setIsActive(false);
    }, [clearTimer]);

    const start = useCallback((): void => {
        hold();
        timerRef.current = window.setTimeout(() => {
            timerRef.current = null;
            setIsActive(false);
        }, durationMs);
    }, [durationMs, hold]);

    // Al desmontar se cancela el plazo para que no actualice el estado de un componente que ya no está.
    useEffect(() => clearTimer, [clearTimer]);

    return { hold, isActive, release, start };
}
