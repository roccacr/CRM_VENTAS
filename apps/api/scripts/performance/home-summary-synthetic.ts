/** Confirmed annual policy: distinct eligible orders with any effective closure in the Costa Rica year. */
export const PERIOD = { year: 2026, timeZone: "America/Costa_Rica", start: "2026-01-01T06:00:00.000Z", endExclusive: "2027-01-01T06:00:00.000Z" };
/** Counters per stage, same shape as the API. */
export type StageCounts = { contracts: { toSend: number; pendingSignature: number }; banking: number; balance: number; transferPending: number; transferSigned: number; closedThisYear: number };
/** Generated order with optional native alias and unordered event history. */
export type SyntheticOrder = { source: "native" | "legacy"; id: number; alias: number | null; eligible: boolean; approvals?: readonly boolean[]; events: { sequence: number; stage: string; at: string | null }[] };
/** Zeroed counters. */
export const emptyCounts = (): StageCounts => ({ contracts: { toSend: 0, pendingSignature: 0 }, banking: 0, balance: 0, transferPending: 0, transferSigned: 0, closedThisYear: 0 });
const stages = ["contract_pending_send", "contract_pending_signature", "bank_management", "pending_balance", "pending_transfer", "transfer_signed", "closed", "unclassified", "unknown", "pending_approval"];

/** Fixed seed arithmetic, unordered histories, exact row count including shadows. */
export function* generateOrders(size: number): Generator<SyntheticOrder> {
    for (let id = 0; id < size; id++) {
        const events = Array.from({ length: id % 5 }, (_, offset) => ({ sequence: offset + 1, stage: stages[(Math.floor(id / 5) * 17 + offset * 3 + 42) % stages.length] ?? "unknown", at: id % 13 === 0 ? null : id % 11 === 0 ? PERIOD.endExclusive : PERIOD.start }));
        yield { source: id % 2 === 0 ? "native" : "legacy", id, alias: id % 10 === 0 && id + 1 < size ? id + 1 : null, eligible: id % 7 !== 0, approvals: [id % 3 !== 0, id % 11 !== 0, id % 17 !== 0], events: events.reverse() };
    }
}

/** Seven integer buckets; no order/history objects survive the input iteration. */
function fromBuckets(values: number[]): StageCounts {
    return { contracts: { toSend: values[0] ?? 0, pendingSignature: values[1] ?? 0 }, banking: values[2] ?? 0, balance: values[3] ?? 0, transferPending: values[4] ?? 0, transferSigned: values[5] ?? 0, closedThisYear: values[6] ?? 0 };
}

/** JS model only: latest stage plus independent cumulative annual closure, with native identity precedence. */
// Keep this truth table independent from the oracle rather than sharing business predicates.
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity
export function evaluateSynthetic(rows: Iterable<SyntheticOrder>) {
    const aliases = new Set<number>();
    const pending = new Map<number, number>();
    const native = Array<number>(7).fill(0);
    const legacy = Array<number>(7).fill(0);
    for (const row of rows) {
        if (row.source === "native" && row.alias !== null) aliases.add(row.alias);
        if (!row.eligible) continue;
        const latest = row.events.reduce<SyntheticOrder["events"][number] | undefined>((best, event) => (!best || event.sequence > best.sequence ? event : best), undefined);
        const stage = latest?.stage ?? "contract_pending_send";
        const approvals = row.approvals ?? [true, true, true];
        const approved = approvals.length === 3 && approvals.filter(Boolean).length === 3;
        let bucket = ["contract_pending_send", "contract_pending_signature", "bank_management", "pending_balance", "pending_transfer", "transfer_signed"].indexOf(stage);
        if (["unclassified", "pending_approval"].includes(stage)) bucket = 0;
        if (bucket < 2 && !approved) bucket = -1;
        let mask = bucket >= 0 ? 1 << bucket : 0;
        for (const event of row.events) {
            if (event.stage === "closed" && event.at !== null && event.at >= PERIOD.start && event.at < PERIOD.endExclusive) mask |= 1 << 6;
        }
        if (row.source === "legacy") pending.set(row.id, mask);
        else
            native.forEach((value, index) => {
                if (mask & (1 << index)) native[index] = value + 1;
            });
    }
    let duplicatesExcluded = 0;
    for (const [id, mask] of pending) {
        if (aliases.has(id)) duplicatesExcluded++;
        else
            legacy.forEach((value, index) => {
                if (mask & (1 << index)) legacy[index] = value + 1;
            });
    }
    return { native: fromBuckets(native), legacy: fromBuckets(legacy), counts: fromBuckets(native.map((value, index) => value + (legacy[index] ?? 0))), duplicatesExcluded };
}

/** Independent oracle: sorted history and separate predicates, retaining only ID + bit mask. */
// Explicit independent predicates make mismatches observable instead of reproducing shared helper bugs.
// eslint-disable-next-line complexity, sonarjs/cognitive-complexity
export function oracle(rows: Iterable<SyntheticOrder>) {
    const aliases = new Set<number>();
    const eligibleLegacy = new Map<number, number>();
    const totals = { native: Array<number>(7).fill(0), legacy: Array<number>(7).fill(0) };
    for (const row of rows) {
        if (row.source === "native" && row.alias !== null) aliases.add(row.alias);
        if (!row.eligible) continue;
        const event = [...row.events].sort((a, b) => b.sequence - a.sequence)[0];
        const stage = event?.stage ?? "contract_pending_send";
        const approvals = row.approvals ?? [true, true, true];
        const approved = approvals.length === 3 && approvals.every(Boolean);
        const annualClosed = row.events.some((entry) => entry.stage === "closed" && entry.at !== null && Date.parse(entry.at) >= Date.parse(PERIOD.start) && Date.parse(entry.at) < Date.parse(PERIOD.endExclusive));
        const matches = [approved && ["contract_pending_send", "unclassified", "pending_approval"].includes(stage), approved && stage === "contract_pending_signature", stage === "bank_management", stage === "pending_balance", stage === "pending_transfer", stage === "transfer_signed", annualClosed];
        let mask = 0;
        matches.forEach((match, index) => {
            if (match) {
                totals[row.source][index] = (totals[row.source][index] ?? 0) + 1;
                mask |= 1 << index;
            }
        });
        if (row.source === "legacy") eligibleLegacy.set(row.id, mask);
    }
    let duplicatesExcluded = 0;
    for (const alias of aliases) {
        const mask = eligibleLegacy.get(alias);
        if (mask === undefined) continue;
        duplicatesExcluded++;
        totals.legacy.forEach((value, index) => {
            if (mask & (1 << index)) totals.legacy[index] = value - 1;
        });
    }
    return { native: fromBuckets(totals.native), legacy: fromBuckets(totals.legacy), counts: fromBuckets(totals.native.map((value, index) => value + (totals.legacy[index] ?? 0))), duplicatesExcluded };
}
