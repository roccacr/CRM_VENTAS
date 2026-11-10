export interface Span {
    /** Minutos desde las 00:00, recortados a la ventana que se muestra. */
    readonly from: number;
    readonly to: number;
}
export interface Placed<T extends Span> {
    readonly item: T;
    readonly lane: number;
    readonly lanes: number;
}

/** Dos tramos comparten hora cuando cada uno empieza antes de que el otro termine. */
export const overlaps = (a: Span, b: Span): boolean => a.from < b.to && a.to > b.from;

/**
 * Columnas lado a lado para eventos que comparten hora, como la vista de día de Outlook. Cada grupo de solapes encadenados se parte en los carriles que necesita,
 * así un evento nuevo no tapa aquel sobre el que cae.
 */
export function arrange<T extends Span>(items: readonly T[]): Placed<T>[] {
    const sorted = [...items].sort((a, b) => a.from - b.from || a.to - b.to);
    const placed: Placed<T>[] = [];
    let group: { item: T; lane: number }[] = [];
    let laneEnds: number[] = [];
    let groupEnd = 0;
    const close = () => {
        for (const entry of group) placed.push({ ...entry, lanes: laneEnds.length });
        group = [];
        laneEnds = [];
    };
    for (const item of sorted) {
        if (group.length > 0 && item.from >= groupEnd) close();
        const free = laneEnds.findIndex((end) => end <= item.from);
        const lane = free === -1 ? laneEnds.length : free;
        laneEnds[lane] = item.to;
        group.push({ item, lane });
        groupEnd = Math.max(groupEnd, item.to);
    }
    close();
    return placed;
}
