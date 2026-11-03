import type { PersistedOrderEvent } from "./netsuite-order-event.contract.js";

export interface PreviousOrderObservation {
    startedAt: string | null;
    completedAt: string | null;
    recordedAt: string;
}
/** El hash detecta igualdad, no orden. Solo aceptar contenido distinto cuando las lecturas no se solapan. */
export function isStaleOrderObservation(input: { event: PersistedOrderEvent; cursor: { observed: string | number | null; hash: string | null }; hash: string; previous: PreviousOrderObservation | null }): boolean {
    if (input.cursor.observed === null) return false;
    const modified = Date.parse(input.event.event.sourceModifiedAt);
    if (modified < Number(input.cursor.observed)) return true;
    const started = input.event.event.snapshotReadStartedAt;
    if (started === undefined) return input.previous?.completedAt != null || (modified === Number(input.cursor.observed) && input.cursor.hash !== input.hash);
    return windowIsStale(input);
}

function windowIsStale(input: Parameters<typeof isStaleOrderObservation>[0]): boolean {
    const previous = input.previous;
    if (previous === null) return true;
    const start = Date.parse(input.event.event.snapshotReadStartedAt ?? "");
    const end = Date.parse(input.event.event.snapshotReadCompletedAt ?? "");
    // Para eventos historicos sin ventana, el COMMIT previo es el limite conservador de transicion.
    const previousEnd = Date.parse(previous.completedAt ?? previous.recordedAt);
    if (![start, end, previousEnd].every(Number.isFinite)) return true;
    if (end < previousEnd) return true;
    return input.cursor.hash !== input.hash && start <= previousEnd;
}
