import { describe, expect, it } from "vitest";

import { processBpmnXml } from "../../src/components/processes/process-definition";
import { ADDENDUM_PROCESS, FINIQUITO_PROCESS, FORMALIZATION_PROCESS, formalizationCurrentStep } from "../../src/modules/home/formalization-processes";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { ORDER_STAGES } from "../../src/services/formalization/order-stage-service";

describe.each([FORMALIZATION_PROCESS, ADDENDUM_PROCESS, FINIQUITO_PROCESS])("BPMN de $title", (definition) => {
    it("exporta XML con referencias completas, carriles y coordenadas para todas las actividades", () => {
        const document = new DOMParser().parseFromString(processBpmnXml(definition), "application/xml");
        expect(document.querySelector("parsererror")).toBeNull();
        expect(document.getElementsByTagNameNS("http://www.omg.org/spec/BPMN/20100524/MODEL", "process")[0]?.getAttribute("isExecutable")).toBe("false");
        const ids = new Set(Array.from(document.querySelectorAll("[id]"), (entry) => entry.id));
        expect(ids.size).toBe(document.querySelectorAll("[id]").length);
        for (const entry of Array.from(document.querySelectorAll("[sourceRef], [targetRef], [bpmnElement]"))) {
            for (const attribute of ["sourceRef", "targetRef", "bpmnElement"]) {
                const id = entry.getAttribute(attribute);
                if (id) expect(ids.has(id), id).toBe(true);
            }
        }
        expect(document.getElementsByTagNameNS("http://www.omg.org/spec/BPMN/20100524/DI", "BPMNShape")).toHaveLength(definition.steps.length + definition.lanes.length);
    });
    it("permite alcanzar cada actividad desde el inicio y termina sin conexiones salientes", () => {
        const start = definition.steps.find((entry) => entry.kind === "startEvent");
        const reached = new Set([start?.id]);
        for (let index = 0; index < definition.steps.length; index++) {
            definition.flows.filter((flow) => reached.has(flow.from)).forEach((flow) => reached.add(flow.to));
        }
        expect(definition.steps.every((entry) => reached.has(entry.id))).toBe(true);
        for (const end of definition.steps.filter((entry) => entry.kind === "endEvent")) expect(definition.flows.some((flow) => flow.from === end.id)).toBe(false);
    });
});

it("separa fondos propios de la gestión bancaria y permite destinos de entrega sin inventar visitas", () => {
    expect(FORMALIZATION_PROCESS.flows.filter((flow) => flow.from === "funds").map((flow) => [flow.label, flow.to])).toEqual([
        ["Financiamiento", "bank_management"],
        ["Fondos propios", "pending_balance"],
    ]);
    expect(FORMALIZATION_PROCESS.flows.filter((flow) => flow.from === "completion").map((flow) => flow.to)).toEqual(["pending_transfer", "transfer_signed", "closed"]);
    expect(FORMALIZATION_PROCESS.flows.some((flow) => flow.from === "pending_transfer" && flow.to === "pending_balance")).toBe(false);
});
it.each(ORDER_STAGES)("localiza la etapa canónica $code sin inferir pasos completados", ({ code }) => {
    expect(formalizationCurrentStep({ state: { code } } as FollowUpItem)).toBe(code);
});
it("no convierte una posición desconocida en una etapa real", () => {
    expect(formalizationCurrentStep(undefined)).toBeUndefined();
    expect(formalizationCurrentStep({ state: { code: "unknown" } } as FollowUpItem)).toBeUndefined();
});
it("escapa los caracteres XML en nombres y documentación", () => {
    const model = { ...FORMALIZATION_PROCESS, title: 'Firma <Cliente> & "Banco"' };
    const document = new DOMParser().parseFromString(processBpmnXml(model), "application/xml");
    expect(document.querySelector("parsererror")).toBeNull();
    expect(document.getElementsByTagNameNS("http://www.omg.org/spec/BPMN/20100524/MODEL", "process")[0]?.getAttribute("name")).toBe(model.title);
});
