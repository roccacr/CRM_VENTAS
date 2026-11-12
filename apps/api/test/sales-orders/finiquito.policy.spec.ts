import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { assertFiniquitoTransition, DEFAULT_FINIQUITO_REASON, FINIQUITO_MANUAL_STAGES, finiquitoEligible, manualFiniquitoPlan, planFiniquitoUpdate, validateFiniquitoInput } from "../../src/modules/crm/sales/sales-orders/finiquito.policy.js";

it("manual destinations normalize flags regardless of their historical combination", () => {
    fc.assert(
        fc.property(fc.constantFrom(...FINIQUITO_MANUAL_STAGES), fc.boolean(), fc.boolean(), fc.boolean(), (targetStage, balanceValidated, sent, received) => {
            const result = planFiniquitoUpdate(null, { balanceValidated, sent, received }, { status: "set_stage", targetStage, reason: "Regularización histórica", expectedVersion: 0 }, false);
            const index = FINIQUITO_MANUAL_STAGES.indexOf(targetStage);
            expect(result.flags).toEqual({ balanceValidated: index > 0, sent: index > 1, received: index > 2 });
        }),
        { seed: 120778, numRuns: 80 },
    );
});
it.each(["x".repeat(1001)])("rejects an oversized manual reason: %s", (reason) => {
    expect(() => validateFiniquitoInput({ source: "legacy", id: "7", operationId: "550e8400-e29b-41d4-a716-446655440000", expectedVersion: 0, status: "set_stage", targetStage: "formalized", reason }, true)).toThrow();
});
it("does not relax the normal signature action while manual completion is explicit", () => {
    expect(() => planFiniquitoUpdate(null, { balanceValidated: false, sent: false, received: false }, { status: "signed", expectedVersion: 0 }, false)).toThrow();
    expect(manualFiniquitoPlan("formalized").flags).toEqual({ balanceValidated: true, sent: true, received: true });
});

describe("finiquito independiente", () => {
    it.each(["pending_approval", "contract_pending_send", "contract_pending_signature", "bank_management", "bank_management_in_progress", "pending_balance", "pending_transfer", "transfer_signed", "closed"])("aplica desde %s si ambos checks están confirmados", (stage) => {
        expect(finiquitoEligible({ available: true, saleLost: true, contractSigned: true, reservationApplied: true, stage })).toBe(true);
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
    it.each([false, undefined])("no permite finiquito sin Reserva Aplicada confirmada: %s", (reservationApplied) => {
        expect(finiquitoEligible({ available: true, saleLost: true, contractSigned: true, reservationApplied })).toBe(false);
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
        }).toThrow("El finiquito cambió o la transición no es válida. Actualiza la orden.");
    });
});

it.each([undefined, "", "  "])("defaults an omitted or empty manual reason: %s", (reason) => {
    const result = validateFiniquitoInput({ source: "legacy", id: "7", operationId: "550e8400-e29b-41d4-a716-446655440000", expectedVersion: 0, status: "set_stage", targetStage: "formalized", reason }, true);
    expect(result.change?.reason).toBe(DEFAULT_FINIQUITO_REASON);
});
