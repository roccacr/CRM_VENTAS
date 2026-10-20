import { describe, expect, it } from "vitest";

import { FORMALIZATION_EXAMPLES } from "../../src/modules/home/formalization-preview.model";
import { applyScenarioAction, createScenario, getScenarioActionReason, getScenarioFlow } from "../../src/modules/home/formalization-scenario.model";

const at = "14/10/2026, 11:30:00";

describe("local visual Formalization scenarios", () => {
    it("guides a new user from assignment through contract and credit, never skipping credit for a paid financed order", () => {
        const initial = createScenario(FORMALIZATION_EXAMPLES[4]);
        expect(getScenarioFlow(initial).action).toBe("assign");
        const assigned = applyScenarioAction(initial, "assign", { owner: "Gestor de ejemplo 1" }, at);
        expect(getScenarioFlow(assigned).action).toBe("attach");
        const bank = createScenario(FORMALIZATION_EXAMPLES[0]);
        const paid = applyScenarioAction(bank, "finance", { result: "paid" }, at);
        expect(getScenarioFlow(paid).action).toBe("complete");
        expect(getScenarioActionReason(paid, "transfer")).toContain("crédito");
        expect(() => applyScenarioAction(paid, "transfer", { document: "respaldo.pdf" }, at)).toThrow();
    });
    it("retains document references and closes the visual process without allowing further mutations", () => {
        const ready = createScenario(FORMALIZATION_EXAMPLES[3]);
        const transferred = applyScenarioAction(ready, "transfer", { document: "traspaso-ejemplo.pdf", sample: "yes" }, at);
        expect(transferred.documents.some((doc) => doc.name === "traspaso-ejemplo.pdf")).toBe(true);
        const closed = applyScenarioAction(transferred, "close", { result: "closed", reason: "Ejemplo finalizado" }, at);
        expect(getScenarioFlow(closed).action).toBeNull();
        expect(() => applyScenarioAction(closed, "mode", { mode: "own" }, at)).toThrow();
    });
    it("requires a document, then simulates sending and signature with automatic history", () => {
        const initial = createScenario(FORMALIZATION_EXAMPLES[4]);
        expect(() => applyScenarioAction(initial, "send", {}, at)).toThrow();
        const attached = applyScenarioAction(initial, "attach", { document: "contrato-ejemplo.pdf", sample: "yes" }, at);
        const sent = applyScenarioAction(attached, "send", { recipient: "cliente@example.invalid", subject: "Contrato", message: "Mensaje de ejemplo" }, at);
        const signed = applyScenarioAction(sent, "sign", { document: "contrato-firmado.pdf", sample: "yes" }, at);
        expect(signed.contract).toBe("signed");
        expect(signed.dates.sent).toBe(at);
        expect(signed.dates.signed).toBe(at);
        expect(signed.history).toHaveLength(initial.history.length + 3);
        expect(initial.document).toBeNull();
        expect(FORMALIZATION_EXAMPLES[4].contract).toBe("No adjunto · Envío bloqueado");
    });

    it("skips credit for own resources and never treats unknown finance as paid", () => {
        const state = createScenario(FORMALIZATION_EXAMPLES[2]);
        expect(state.credit).toBe("No aplica");
        expect(() => applyScenarioAction(state, "start", {}, at)).toThrow();
        expect(() => applyScenarioAction(state, "transfer", {}, at)).toThrow();
    });

    it("shows requested versus authorized exception outcomes and both closure scenarios", () => {
        const state = createScenario(FORMALIZATION_EXAMPLES[3]);
        const request = applyScenarioAction(state, "exception", { result: "requested", reason: "Motivo ficticio", authorizer: "Revisor de ejemplo", document: "respaldo.pdf" }, at);
        expect(request.transfer).toBe("requested");
        expect(getScenarioFlow(request).label).toBe("Excepción pendiente de autorización");
        expect(getScenarioFlow(request).action).toBe("exception");
        expect(() => applyScenarioAction(request, "close", { result: "closed", reason: "Cierre" }, at)).toThrow();
        const authorized = applyScenarioAction(state, "exception", { result: "authorized", reason: "Motivo ficticio", authorizer: "Revisor de ejemplo", document: "respaldo.pdf" }, at);
        expect(applyScenarioAction(authorized, "close", { result: "closed", reason: "Cierre ficticio" }, at).closure).toBe("closed");
        expect(applyScenarioAction(request, "close", { result: "later", reason: "Otra fase" }, at).closure).toBe("later");
    });

    it("simulates bank changes, credit completion, finance and transfer without real services", () => {
        const state = createScenario(FORMALIZATION_EXAMPLES[0]);
        const bank = applyScenarioAction(state, "bank", { bank: "Banco de ejemplo B", advisor: "Asesor B" }, at);
        const credit = applyScenarioAction(bank, "complete", {}, at);
        const paid = applyScenarioAction(credit, "finance", { result: "paid" }, at);
        expect(applyScenarioAction(paid, "transfer", { document: "traspaso.pdf" }, at).transfer).toBe("done");
        expect(bank.bank).toBe("Banco de ejemplo B");
        expect(credit.dates.creditCompleted).toBe(at);
    });
});
