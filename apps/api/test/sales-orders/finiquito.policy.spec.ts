import { describe, expect, it } from "vitest";

import { assertFiniquitoTransition, finiquitoEligible } from "../../src/modules/crm/sales/sales-orders/finiquito.policy.js";

describe("finiquito independiente", () => {
    it.each(["pending_approval", "contract_pending_send", "contract_pending_signature", "bank_management", "bank_management_in_progress", "pending_balance", "pending_transfer", "transfer_signed", "closed"])("aplica desde %s si ambos checks están confirmados", (stage) => {
        expect(finiquitoEligible({ available: true, saleLost: true, contractSigned: true, stage })).toBe(true);
    });
    it.each([
        [false, true],
        [true, false],
        [false, false],
        [undefined, true],
        [true, undefined],
    ])("rechaza checks no confirmados %s/%s", (saleLost, contractSigned) => {
        expect(finiquitoEligible({ available: true, saleLost, contractSigned })).toBe(false);
    });
    it("no habilita órdenes inactivas", () => {
        expect(finiquitoEligible({ available: false, saleLost: true, contractSigned: true })).toBe(false);
    });
    it.each([
        [null, "pending_send"],
        ["pending_send", "sent"],
        ["sent", "signed"],
    ] as const)("permite %s → %s", (before, after) => {
        expect(() => {
            assertFiniquitoTransition(before, after);
        }).not.toThrow();
    });
    it.each([
        [null, "sent"],
        [null, "signed"],
        ["pending_send", "signed"],
        ["signed", "sent"],
        ["sent", "pending_send"],
    ] as const)("rechaza saltar o retroceder %s → %s", (before, after) => {
        expect(() => {
            assertFiniquitoTransition(before, after);
        }).toThrow();
    });
});
