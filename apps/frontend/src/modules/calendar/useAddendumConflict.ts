import { useEffect, useState } from "react";

import type { CalendarLink } from "../../services/calendar/calendar-service";
import { futureAddendumMessage, getFutureOrderAddendum } from "../../services/formalization/order-addendum-service";

interface ConflictResult {
    readonly key: string;
    readonly blocked: boolean;
    readonly failed: boolean;
    readonly message: string | null;
}
function selection(enabled: boolean, links: readonly CalendarLink[], excludeEventId: string | undefined, attempt: number) {
    const orders = links.filter((link) => link.entityType === "sales_order");
    if (!enabled || orders.length !== 1) return null;
    const order = orders[0];
    if (!order) return null;
    return { source: order.source, id: order.id, key: JSON.stringify([order.source, order.id, excludeEventId, attempt]) };
}
function conflictView(key: string | undefined, result: ConflictResult | null) {
    if (!key) return { checking: false, blocked: false, failed: false, message: null };
    if (!result || result.key !== key) return { checking: true, blocked: true, failed: false, message: "Verificando si existe un Adéndum futuro para esta orden…" };
    return { checking: false, blocked: result.blocked, failed: result.failed, message: result.message };
}

/** Solo una identidad exacta dispara la consulta; cada resultado pertenece a esa selección y no a la fecha visible. */
export function useAddendumConflict(enabled: boolean, links: readonly CalendarLink[], excludeEventId?: string) {
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<ConflictResult | null>(null);
    const selected = selection(enabled, links, excludeEventId, attempt);
    const source = selected?.source;
    const id = selected?.id;
    const key = selected?.key;
    const [previousKey, setPreviousKey] = useState(key);
    // Reinicia el resultado antes de presentar otra selección, incluso al reactivar la misma orden.
    if (previousKey !== key) {
        setPreviousKey(key);
        setResult(null);
    }
    useEffect(() => {
        if (!source || !id || !key) return;
        let active = true;
        const timer = setTimeout(() => {
            void getFutureOrderAddendum({ source, id }, excludeEventId).then(
                (response) => {
                    if (active) setResult({ key, blocked: response.blocked, failed: false, message: response.blocked ? futureAddendumMessage(response.existing) : null });
                },
                () => {
                    if (active) setResult({ key, blocked: true, failed: true, message: "No fue posible verificar si existe otro Adéndum futuro. Reintenta la verificación antes de guardar." });
                },
            );
        }, 250);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [source, id, key, excludeEventId]);
    return {
        ...conflictView(key, result),
        retry: () => {
            setAttempt((value) => value + 1);
        },
    };
}
