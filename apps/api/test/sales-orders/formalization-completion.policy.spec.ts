import { describe, expect, it } from "vitest";

import { type CompletionFlags, formalizationCompletionTarget, netsuiteFormalizationTarget } from "../../src/modules/crm/sales/sales-orders/formalization-completion.policy.js";

describe("combinaciones de cierre aprobadas por el propietario", () => {
    const combinations = [
        [false, false, false, false, null],
        [false, false, false, true, "closed"],
        [false, false, true, false, null],
        [false, false, true, true, "closed"],
        [false, true, false, false, null],
        [false, true, false, true, "closed"],
        [false, true, true, false, null],
        [false, true, true, true, "closed"],
        [true, false, false, false, "pending_transfer"],
        [true, false, false, true, "closed"],
        [true, false, true, false, "pending_transfer"],
        [true, false, true, true, "closed"],
        [true, true, false, false, "transfer_signed"],
        [true, true, false, true, "closed"],
        [true, true, true, false, null],
        [true, true, true, true, "closed"],
    ] as const;
    it.each(combinations.map(([paid, transferred, keys, delivered, expected]) => ({ paid, transferred, keys, delivered, expected })))("cuotas=$paid traspasada=$transferred llaves=$keys entregada=$delivered → $expected", ({ paid, transferred, keys, delivered, expected }) => {
        expect(formalizationCompletionTarget({ installmentsFullyPaid: paid, unitTransferred: transferred, keysDelivered: keys, unitDelivered: delivered })).toBe(expected);
    });

    it.each(["installmentsFullyPaid", "unitTransferred", "unitDelivered"] as const)("no interpreta %s desconocido como una confirmación", (field) => {
        const flags: CompletionFlags = { installmentsFullyPaid: true, unitTransferred: false, keysDelivered: null, unitDelivered: false };
        flags[field] = null;
        expect(formalizationCompletionTarget(flags)).toBeNull();
    });

    it("llaves desconocidas no impiden Traspasos pendientes, pero no confirman llaves pendientes en Traspaso firmado", () => {
        expect(formalizationCompletionTarget({ installmentsFullyPaid: true, unitTransferred: false, keysDelivered: null, unitDelivered: false })).toBe("pending_transfer");
        expect(formalizationCompletionTarget({ installmentsFullyPaid: true, unitTransferred: true, keysDelivered: null, unitDelivered: false })).toBeNull();
    });

    it("Unidad entregada cierra aunque los demás valores sean desconocidos", () => {
        expect(formalizationCompletionTarget({ installmentsFullyPaid: null, unitTransferred: null, keysDelivered: null, unitDelivered: true })).toBe("closed");
    });
});

it.each([
    ["own_funds", "pending_balance"],
    ["bank_financing", "bank_management"],
    [null, "bank_management"],
] as const)("reconciles a signed order without payment evidence for %s", (purchaseFundsOrigin, expected) => {
    expect(netsuiteFormalizationTarget({ installmentsFullyPaid: null, unitTransferred: null, unitDelivered: null, purchaseFundsOrigin })).toBe(expected);
});
