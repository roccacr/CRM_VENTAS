import { expect, it } from "vitest";

import { finiquitoValidationEligible, validateFiniquitoInput } from "../../src/modules/crm/sales/sales-orders/finiquito.policy.js";

it("permite validar saldo de una caída con reserva sin exigir contrato firmado", () => {
    expect(finiquitoValidationEligible({ available: true, saleLost: true, reservationApplied: true })).toBe(true);
});
it.each([false, undefined])("no admite reserva sin confirmar: %s", (reservationApplied) => {
    expect(finiquitoValidationEligible({ available: true, saleLost: true, reservationApplied })).toBe(false);
});
it("la acción de saldo es explícita y no acepta checks ERP del cliente", () => {
    const input = { source: "legacy", id: "78", status: "balance_validated", expectedVersion: 0, operationId: "22222222-2222-4222-8222-222222222222" };
    expect(validateFiniquitoInput(input, true).change?.status).toBe("balance_validated");
    expect(() => validateFiniquitoInput({ ...input, contractSigned: true }, true)).toThrow();
});
