import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { validateFiniquitoInput } from "../../src/modules/crm/sales/sales-orders/finiquito.policy.js";

const command = { source: "legacy", id: "78", status: "balance_validated", expectedVersion: 0, operationId: "550e8400-e29b-41d4-a716-446655440000" };

describe("validación de saldo: frontera adversarial", () => {
    it.each([
        { source: "legacy", id: "legacy:78", expectedId: "78" },
        { source: "native", id: "01M7695Y3X1ZA6XVQ65WC41SES", expectedId: "01M7695Y3X1ZA6XVQ65WC41SES" },
    ])("acepta la acción propia sin cambiar checks ERP: $source", ({ source, id, expectedId }) => {
        const body = { ...command, source, id };
        const original = structuredClone(body);
        expect(validateFiniquitoInput(body, true)).toMatchObject({ target: { source, id: expectedId }, change: { status: "balance_validated", expectedVersion: 0 } });
        expect(body).toEqual(original);
    });

    it.each(["actorPublicId", "validatedBy", "validatedAt", "balanceValidated", "saleLost", "contractSigned", "reservationApplied", "destination"])("no acepta autoridad o elegibilidad inyectada: %s", (field) => {
        fc.assert(
            fc.property(fc.jsonValue(), (value) => {
                expect(() => validateFiniquitoInput({ ...command, [field]: value }, true)).toThrow();
            }),
            { seed: 7612001, numRuns: 50 },
        );
    });

    it("rechaza versiones inválidas sin convertir strings ni booleanos", () => {
        const invalid = fc.oneof(fc.string(), fc.boolean(), fc.constant(null), fc.integer({ max: -1 }), fc.integer({ min: 4294967295, max: Number.MAX_SAFE_INTEGER }));
        fc.assert(
            fc.property(invalid, (expectedVersion) => {
                expect(() => validateFiniquitoInput({ ...command, expectedVersion }, true)).toThrow();
            }),
            { seed: 7612002, numRuns: 100 },
        );
    });

    it("la consulta no admite una acción o una marca encubierta", () => {
        expect(() => validateFiniquitoInput(command, false)).toThrow();
        expect(validateFiniquitoInput({ source: "legacy", id: "78" }, false)).toMatchObject({ target: { source: "legacy", id: "78" }, change: undefined });
    });
});
