import { BadRequestException } from "@nestjs/common";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { contractTarget, FORMALIZATION_STAGE_CODES, validateContractTransition } from "../../src/modules/crm/sales/sales-orders/contract-transition.dto.js";
import { validatePurchaseFunds } from "../../src/modules/crm/sales/sales-orders/purchase-funds.dto.js";

const ULID = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
const OP_ULID = "01BX5ZZKBKACTAV9WEVGEMMVRY";
const OP_UUID = "123e4567-e89b-42d3-a456-426614174000";
const valid = (extra: Record<string, unknown> = {}) => ({ source: "native", id: ULID, expectedSequence: 0, operationId: OP_ULID, ...extra });
const reject = (input: unknown, action: "send" | "revert" | "set" = "send") => {
    expect(() => validateContractTransition(input, action)).toThrow(BadRequestException);
};

describe("validateContractTransition", () => {
    it("accepts a native order with ULID or UUID idempotency keys", () => {
        expect(validateContractTransition(valid(), "send").id).toBe(ULID);
        expect(validateContractTransition(valid({ operationId: OP_UUID }), "send").operationId).toBe(OP_UUID);
    });

    it("accepts legacy numeric ids up to INT max", () => {
        expect(validateContractTransition(valid({ source: "legacy", id: "2147483647" }), "send").id).toBe("2147483647");
        expect(validateContractTransition(valid({ source: "legacy", id: "1" }), "send").id).toBe("1");
    });

    it.each([null, undefined, [], "str", 5, true])("rejects non-object input: %j", (input) => {
        reject(input);
    });

    it.each([
        ["unknown source", { source: "other" }],
        ["id longer than 26", { id: `${ULID}0` }],
        ["lowercase native id", { id: ULID.toLowerCase() }],
        ["native id whose first char is > 7", { id: `8${ULID.slice(1)}` }],
        ["native id with forbidden letter U", { id: `${ULID.slice(0, 25)}U` }],
        ["negative sequence", { expectedSequence: -1 }],
        ["sequence above uint32-1", { expectedSequence: 4294967295 }],
        ["fractional sequence", { expectedSequence: 1.5 }],
        ["string sequence (no implicit coercion)", { expectedSequence: "1" }],
        ["NaN sequence", { expectedSequence: Number.NaN }],
        ["Infinity sequence", { expectedSequence: Number.POSITIVE_INFINITY }],
        ["operation id not ULID/UUID", { operationId: "not-an-id" }],
        ["operation id with SQL", { operationId: "' OR 1=1--" }],
        ["operation id over 100 chars", { operationId: "a".repeat(101) }],
        ["unknown extra field (forbidNonWhitelisted)", { actor: "admin" }],
        ["caller-supplied actor injection", { actorId: 1 }],
        ["reason over 500 chars", { reason: "x".repeat(501) }],
        ["unknown purchase funds origin", { purchaseFundsOrigin: "crypto" }],
        ["null purchase funds origin", { purchaseFundsOrigin: null }],
        ["unknown target state", { targetState: "closed_forever" }],
    ])("rejects %s", (_name, patch) => {
        reject(valid(patch));
    });

    it.each(["0", "01", "-1", "2147483648", "99999999999", "1.5", "1e3", " 1", "0x10", "1; DROP TABLE orders"])("rejects invalid legacy id %j", (id) => {
        reject(valid({ source: "legacy", id }));
    });

    it("requires a non-blank reason only for revert", () => {
        reject(valid(), "revert");
        reject(valid({ reason: "   " }), "revert");
        expect(validateContractTransition(valid({ reason: "error de captura" }), "revert").reason).toBe("error de captura");
        expect(validateContractTransition(valid(), "send")).toBeDefined();
    });

    it("targetState only applies to the 'set' action, and is mandatory there", () => {
        reject(valid({ targetState: "closed" }), "send");
        reject(valid({ targetState: "closed" }), "revert");
        reject(valid(), "set");
        expect(validateContractTransition(valid({ targetState: "closed" }), "set").targetState).toBe("closed");
    });

    it("does not pollute Object.prototype through __proto__ payloads", () => {
        const payload: unknown = JSON.parse(`{"source":"native","id":"${ULID}","expectedSequence":0,"operationId":"${OP_ULID}","__proto__":{"admin":true}}`);
        expect(() => validateContractTransition(payload, "send")).not.toThrow(TypeError);
        expect(({} as Record<string, unknown>)["admin"]).toBeUndefined();
    });

    it("property: arbitrary junk only ever fails with BadRequestException (never a raw TypeError/crash)", () => {
        fc.assert(
            fc.property(fc.anything(), fc.constantFrom("send", "revert", "set" as const), (input, action) => {
                try {
                    validateContractTransition(input, action);
                } catch (error) {
                    expect(error).toBeInstanceOf(BadRequestException);
                }
            }),
            { numRuns: 1000 },
        );
    });
});

describe("contractTarget", () => {
    it("fixes destinations for send/revert and validates set selection", () => {
        expect(contractTarget({ action: "send" })).toBe("contract_pending_signature");
        expect(contractTarget({ action: "revert" })).toBe("contract_pending_send");
        for (const code of FORMALIZATION_STAGE_CODES) expect(contractTarget({ action: "set", targetState: code })).toBe(code);
    });

    it.each([undefined, "", "closed ", "CLOSED", "__proto__", "constructor"])("rejects an unknown set target %j", (targetState) => {
        expect(() => contractTarget({ action: "set", targetState })).toThrow(BadRequestException);
    });
});

describe("validatePurchaseFunds", () => {
    const funds = (patch: Record<string, unknown> = {}) => ({ source: "native", id: ULID, expectedSequence: 3, expectedAuditSequence: 4, operationId: OP_ULID, purchaseFundsOrigin: "own_funds", expectedPurchaseFundsOrigin: null, ...patch });
    const rejectFunds = (input: unknown) => {
        expect(() => validatePurchaseFunds(input)).toThrow(BadRequestException);
    };

    it("accepts a complete payload, with null or set expected origin", () => {
        expect(validatePurchaseFunds(funds()).purchaseFundsOrigin).toBe("own_funds");
        expect(validatePurchaseFunds(funds({ expectedPurchaseFundsOrigin: "bank_financing" })).expectedPurchaseFundsOrigin).toBe("bank_financing");
    });

    it.each([
        ["extra field (strict)", { actor: "x" }],
        ["missing-style invalid origin", { purchaseFundsOrigin: "other" }],
        ["null origin (must be explicit)", { purchaseFundsOrigin: null }],
        ["bad expected origin", { expectedPurchaseFundsOrigin: "other" }],
        ["negative audit sequence", { expectedAuditSequence: -1 }],
        ["audit sequence above max", { expectedAuditSequence: 4294967295 }],
        ["fractional sequence", { expectedSequence: 0.5 }],
        ["invalid native id (inherits identity rules)", { id: "123" }],
        ["invalid idempotency key", { operationId: "abc" }],
        ["legacy id with letters", { source: "legacy", id: "ABC" }],
    ])("rejects %s", (_name, patch) => {
        rejectFunds(funds(patch));
    });

    it.each([null, undefined, [], "x", 1])("rejects non-object input %j", (input) => {
        rejectFunds(input);
    });

    it("property: arbitrary junk only fails with BadRequestException", () => {
        fc.assert(
            fc.property(fc.anything(), (input) => {
                try {
                    validatePurchaseFunds(input);
                } catch (error) {
                    expect(error).toBeInstanceOf(BadRequestException);
                }
            }),
            { numRuns: 1000 },
        );
    });
});
