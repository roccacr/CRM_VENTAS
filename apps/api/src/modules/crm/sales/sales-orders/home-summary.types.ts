/** Orders per formalization stage; every counter is a non-negative safe integer. */
export interface StageCounts {
    contracts: { toSend: number; pendingSignature: number };
    banking: number;
    balance: number;
    transferPending: number;
    transferSigned: number;
    closedThisYear: number;
}

/** Calendar-year window in Costa Rica time; `endExclusive` avoids double-counting boundary instants. */
export interface HomeSummaryPeriod {
    year: number;
    timeZone: "America/Costa_Rica";
    start: string;
    endExclusive: string;
}

/** Response of the Home summary: merged counts plus per-source breakdown for traceability. */
export interface HomeSummary {
    schemaVersion: 1;
    observedAt: string;
    period: HomeSummaryPeriod;
    counts: StageCounts;
    sources: { native: StageCounts; legacy: StageCounts; legacyEnabled: boolean; duplicatesExcluded: number };
}

/** Starting point for accumulating counts per source. */
export const emptyStageCounts = (): StageCounts => ({ contracts: { toSend: 0, pendingSignature: 0 }, banking: 0, balance: 0, transferPending: 0, transferSigned: 0, closedThisYear: 0 });

/** Aggregate values arrive as DECIMAL/count strings from mysql2; reject precision loss. */
export function aggregateNumber(value: string | number | null): number {
    if (value === null) return 0;
    if (typeof value !== "number" && (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value))) throw new Error("Invalid Home aggregate count");
    const count = Number(value);
    if (!Number.isSafeInteger(count) || count < 0) throw new Error("Invalid Home aggregate count");
    return count;
}

/** Raw aggregate row as returned by mysql2 (counts may be strings or NULL). */
export interface StageAggregateRow {
    toSend: string | number | null;
    pendingSignature: string | number | null;
    banking: string | number | null;
    balance: string | number | null;
    transferPending: string | number | null;
    transferSigned: string | number | null;
    closedThisYear: string | number | null;
    duplicatesExcluded?: string | number | null;
}

/** Missing rows/fields are source failures; only explicit SQL NULL denotes an empty SUM. */
export function stageCountsFromRow(row: StageAggregateRow | undefined): StageCounts {
    if (!row) throw new Error("Missing Home aggregate row");
    return { contracts: { toSend: aggregateNumber(row.toSend), pendingSignature: aggregateNumber(row.pendingSignature) }, banking: aggregateNumber(row.banking), balance: aggregateNumber(row.balance), transferPending: aggregateNumber(row.transferPending), transferSigned: aggregateNumber(row.transferSigned), closedThisYear: aggregateNumber(row.closedThisYear) };
}

/** Bounded personal audit projection; never contains arbitrary snapshots, notes or another actor. */
export interface RecentOrderActivity {
    id: string;
    source: "native" | "legacy";
    orderId: string;
    action: string;
    at: string;
    fromState: string | null;
    toState: string | null;
    approval: string | null;
}
