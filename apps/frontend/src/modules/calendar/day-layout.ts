export interface Span {
    /** Minutes from 00:00, clamped to the shown window. */
    readonly from: number;
    readonly to: number;
}
export interface Placed<T extends Span> {
    readonly item: T;
    readonly lane: number;
    readonly lanes: number;
}

/** Two spans share time when each starts before the other ends. */
export const overlaps = (a: Span, b: Span): boolean => a.from < b.to && a.to > b.from;

/**
 * Side-by-side columns for events that share time, like Outlook's day view: every group of chained overlaps is split into as many lanes as it needs,
 * so a new event never hides the one it lands on.
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
