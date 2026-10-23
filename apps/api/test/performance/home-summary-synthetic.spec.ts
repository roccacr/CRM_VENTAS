import { describe, expect, it } from "vitest";

import { evaluateSynthetic, generateOrders, oracle, PERIOD } from "../../scripts/performance/home-summary-synthetic.js";

describe("synthetic Home model (no SQL execution)", () => {
    it.each([[], [true, true], [true, true, true, false], [true, true, true, true]])("rejects wrong-length contract approval fixtures: %j", (...approvals: boolean[]) => {
        const rows = [{ source: "native" as const, id: 1, alias: null, eligible: true, approvals, events: [] }];
        expect(evaluateSynthetic(rows)).toEqual(oracle(rows));
        expect(evaluateSynthetic(rows).counts.contracts.toSend).toBe(0);
    });
    it("matches an independent oracle with histories and native shadows", () => {
        const rows = [...generateOrders(2000)];
        expect(evaluateSynthetic(rows)).toEqual(oracle(rows));
        expect(evaluateSynthetic(rows).duplicatesExcluded).toBeGreaterThan(0);
        const counts = evaluateSynthetic(rows).counts;
        for (const value of [counts.contracts.toSend, counts.contracts.pendingSignature, counts.banking, counts.balance, counts.transferPending, counts.transferSigned, counts.closedThisYear]) expect(value).toBeGreaterThan(0);
    });
    it("gates only contracts on all three approvals and counts only eligible legacy duplicates", () => {
        const rows = ["contract_pending_send", "contract_pending_signature", "bank_management", "pending_balance", "pending_transfer", "transfer_signed", "closed"].map((stage, id) => ({ source: "native" as const, id, alias: id + 100, eligible: true, approvals: [true, false, true], events: [{ sequence: 1, stage, at: PERIOD.start }] }));
        const legacy = [
            { source: "legacy" as const, id: 100, alias: null, eligible: false, events: [] },
            { source: "legacy" as const, id: 101, alias: null, eligible: true, events: [] },
        ];
        const result = evaluateSynthetic([...rows, ...legacy]);
        expect(result).toEqual(oracle([...rows, ...legacy]));
        expect(result.counts).toEqual({ contracts: { toSend: 0, pendingSignature: 0 }, banking: 1, balance: 1, transferPending: 1, transferSigned: 1, closedThisYear: 1 });
        expect(result.duplicatesExcluded).toBe(1);
    });
    it("uses sequence over date and suppresses legacy for ineligible native identities", () => {
        const rows = [
            { source: "native" as const, id: 1, alias: 7, eligible: false, events: [] },
            { source: "legacy" as const, id: 7, alias: null, eligible: true, events: [{ sequence: 1, stage: "bank_management", at: PERIOD.start }] },
            {
                source: "native" as const,
                id: 2,
                alias: null,
                eligible: true,
                events: [
                    { sequence: 2, stage: "pending_balance", at: PERIOD.start },
                    { sequence: 1, stage: "closed", at: PERIOD.endExclusive },
                ],
            },
        ];
        const result = evaluateSynthetic(rows);
        expect(result).toEqual(oracle(rows));
        expect(result.counts.balance).toBe(1);
        expect(result.counts.banking).toBe(0);
        expect(result.duplicatesExcluded).toBe(1);
    });
    it.each(["native", "legacy"] as const)("counts repeated annual closures once alongside a reopened current stage: %s", (source) => {
        const rows = [
            {
                source,
                id: 1,
                alias: null,
                eligible: true,
                approvals: [false, false, false],
                events: [
                    { sequence: 4, stage: "pending_balance", at: PERIOD.endExclusive },
                    { sequence: 2, stage: "closed", at: PERIOD.start },
                    { sequence: 3, stage: "closed", at: "2026-08-01T06:00:00.000Z" },
                    { sequence: 1, stage: "closed", at: null },
                ],
            },
        ];
        const result = evaluateSynthetic(rows);
        expect(result).toEqual(oracle(rows));
        expect(result.counts.balance).toBe(1);
        expect(result.counts.closedThisYear).toBe(1);
        expect(result[source].closedThisYear).toBe(1);
    });
    it("excludes shadowed annual history even when native is ineligible or has no closure", () => {
        const rows = [{ source: "native" as const, id: 1, alias: 7, eligible: false, events: [] }, { source: "native" as const, id: 2, alias: 8, eligible: true, events: [] }, ...[7, 8, 9].map((id) => ({ source: "legacy" as const, id, alias: null, eligible: id !== 9, events: [{ sequence: 1, stage: "closed", at: PERIOD.start }] }))];
        const result = evaluateSynthetic(rows);
        expect(result).toEqual(oracle(rows));
        expect(result.counts.closedThisYear).toBe(0);
        expect(result.duplicatesExcluded).toBe(2);
    });
    it("uses half-open Costa Rica year boundaries and ignores unknown effective dates", () => {
        const rows = ["2026-01-01T05:59:59.999Z", PERIOD.start, "2027-01-01T05:59:59.999Z", PERIOD.endExclusive, null].map((at, id) => ({ source: "native" as const, id, alias: null, eligible: true, events: [{ sequence: 1, stage: "closed", at }] }));
        expect(evaluateSynthetic(rows).counts.closedThisYear).toBe(2);
        expect(evaluateSynthetic(rows)).toEqual(oracle(rows));
    });
});
