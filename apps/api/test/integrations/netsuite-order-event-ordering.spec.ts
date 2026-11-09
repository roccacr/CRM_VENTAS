import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { PersistedOrderEvent } from "../../src/integrations/netsuite/netsuite-order-event.contract.js";
import { isStaleOrderObservation, type PreviousOrderObservation } from "../../src/integrations/netsuite/netsuite-order-event.ordering.js";

const T = (iso: string): number => Date.parse(iso);
const event = (sourceModifiedAt: string, window?: { startedAt: string; completedAt: string }): PersistedOrderEvent => ({ event: { sourceModifiedAt, ...(window ? { snapshotReadStartedAt: window.startedAt, snapshotReadCompletedAt: window.completedAt } : {}) } }) as unknown as PersistedOrderEvent;
const previous = (completedAt: string | null, recordedAt = "2026-01-01T00:00:10.000Z"): PreviousOrderObservation => ({ startedAt: null, completedAt, recordedAt });

describe("isStaleOrderObservation", () => {
    it("never marks the first observation (no cursor) as stale", () => {
        expect(isStaleOrderObservation({ event: event("2026-01-01T00:00:00.000Z"), cursor: { observed: null, hash: null }, hash: "a", previous: null })).toBe(false);
    });

    it("marks an older source modification as stale regardless of hash or window", () => {
        const input = { event: event("2026-01-01T00:00:00.000Z"), cursor: { observed: T("2026-01-01T00:00:01.000Z"), hash: "a" }, hash: "a", previous: null };
        expect(isStaleOrderObservation(input)).toBe(true);
        expect(isStaleOrderObservation({ ...input, hash: "b" })).toBe(true);
    });

    describe("events without a read window (legacy)", () => {
        const base = { event: event("2026-01-01T00:00:05.000Z"), cursor: { observed: T("2026-01-01T00:00:05.000Z"), hash: "a" } };

        it("accepts a replay with the same hash and no committed previous read", () => {
            expect(isStaleOrderObservation({ ...base, hash: "a", previous: previous(null) })).toBe(false);
        });

        it("rejects different content at the same modification time (equal timestamps cannot be ordered)", () => {
            expect(isStaleOrderObservation({ ...base, hash: "b", previous: previous(null) })).toBe(true);
        });

        it("rejects when a previous read already committed, even with newer modification", () => {
            const newer = { event: event("2026-01-01T00:00:09.000Z"), cursor: base.cursor };
            expect(isStaleOrderObservation({ ...newer, hash: "b", previous: previous("2026-01-01T00:00:08.000Z") })).toBe(true);
        });

        it("accepts a strictly newer modification when nothing committed before", () => {
            const newer = { event: event("2026-01-01T00:00:09.000Z"), cursor: base.cursor };
            expect(isStaleOrderObservation({ ...newer, hash: "b", previous: null })).toBe(false);
        });
    });

    describe("events with a read window", () => {
        const cursor = { observed: T("2026-01-01T00:00:05.000Z"), hash: "a" };
        const at = "2026-01-01T00:00:05.000Z";
        const windowed = (startedAt: string, completedAt: string) => event(at, { startedAt, completedAt });

        it("is stale when there is no previous observation to compare", () => {
            expect(isStaleOrderObservation({ event: windowed("2026-01-01T00:00:20.000Z", "2026-01-01T00:00:21.000Z"), cursor, hash: "b", previous: null })).toBe(true);
        });

        it("is stale when the window ends before the previous read ended", () => {
            expect(isStaleOrderObservation({ event: windowed("2026-01-01T00:00:01.000Z", "2026-01-01T00:00:05.000Z"), cursor, hash: "b", previous: previous("2026-01-01T00:00:10.000Z") })).toBe(true);
        });

        it("is stale when different content overlaps the previous read (start <= previous end)", () => {
            expect(isStaleOrderObservation({ event: windowed("2026-01-01T00:00:10.000Z", "2026-01-01T00:00:15.000Z"), cursor, hash: "b", previous: previous("2026-01-01T00:00:10.000Z") })).toBe(true);
        });

        it("accepts different content from a strictly later, non-overlapping read", () => {
            expect(isStaleOrderObservation({ event: windowed("2026-01-01T00:00:11.000Z", "2026-01-01T00:00:15.000Z"), cursor, hash: "b", previous: previous("2026-01-01T00:00:10.000Z") })).toBe(false);
        });

        it("accepts an identical hash that overlaps (hash only detects equality)", () => {
            expect(isStaleOrderObservation({ event: windowed("2026-01-01T00:00:09.000Z", "2026-01-01T00:00:15.000Z"), cursor, hash: "a", previous: previous("2026-01-01T00:00:10.000Z") })).toBe(false);
        });

        it("falls back to recordedAt when the previous read has no completion time", () => {
            expect(isStaleOrderObservation({ event: windowed("2026-01-01T00:00:09.000Z", "2026-01-01T00:00:15.000Z"), cursor, hash: "b", previous: previous(null, "2026-01-01T00:00:10.000Z") })).toBe(true);
        });

        it.each(["", "not-a-date", "NaN", "9e999", "' OR 1=1--"])("fails closed (stale) when any window timestamp is garbage: %j", (garbage) => {
            expect(isStaleOrderObservation({ event: windowed(garbage, "2026-01-01T00:00:15.000Z"), cursor, hash: "b", previous: previous("2026-01-01T00:00:10.000Z") })).toBe(true);
            expect(isStaleOrderObservation({ event: windowed("2026-01-01T00:00:11.000Z", garbage), cursor, hash: "b", previous: previous("2026-01-01T00:00:10.000Z") })).toBe(true);
            expect(isStaleOrderObservation({ event: windowed("2026-01-01T00:00:11.000Z", "2026-01-01T00:00:15.000Z"), cursor, hash: "b", previous: previous(garbage, garbage) })).toBe(true);
        });
    });

    it("property: never throws and never accepts an older modification, for arbitrary inputs", () => {
        const ms = fc.integer({ min: 0, max: 4_102_444_800_000 });
        fc.assert(
            fc.property(fc.record({ modified: ms, observed: ms, start: ms, end: ms, prevEnd: ms, sameHash: fc.boolean(), hasPrev: fc.boolean() }), ({ modified, observed, start, end, prevEnd, sameHash, hasPrev }) => {
                const result = isStaleOrderObservation({
                    event: event(new Date(modified).toISOString(), { startedAt: new Date(start).toISOString(), completedAt: new Date(end).toISOString() }),
                    cursor: { observed, hash: "a" },
                    hash: sameHash ? "a" : "b",
                    previous: hasPrev ? previous(new Date(prevEnd).toISOString()) : null,
                });
                if (modified < observed) expect(result).toBe(true);
            }),
            { numRuns: 500 },
        );
    });
});
