import { expect, it } from "vitest";

import { canReadFormalizationOrder, formalizationReadQueues } from "../../src/modules/home/formalization-read-policy";
const roles = [{ code: "formalizacion", name: "Formalización", status: "active" as const }];
const allow = (category: string) => ({ code: `formalizacion.home.${category}.read`, effect: "allow" });
it("contracts maps to both contract queues, deny wins and legacy cannot expand granular grants", () => {
    expect(formalizationReadQueues(roles, [allow("contracts"), allow("stages")])).toEqual(["all", "contracts", "send", "signature"]);
    expect(formalizationReadQueues(roles, [allow("contracts"), { ...allow("contracts"), effect: "deny" }, allow("stages")])).toEqual([]);
});
it("requires active effective role and rejects unknown category grants", () => {
    expect(formalizationReadQueues(undefined, [allow("contracts")])).toEqual([]);
    expect(formalizationReadQueues([{ code: "formalizacion", name: "Formalización", status: "inactive" }], [allow("contracts")])).toEqual([]);
    expect(formalizationReadQueues(roles, [allow("unknown")])).toEqual([]);
});
it("approvals is independently readable and each stage maps to its own queue", () => {
    expect(formalizationReadQueues(roles, [allow("approvals")])).toEqual(["all", "approvals"]);
    for (const [category, queue] of [
        ["banking", "bank"],
        ["balance", "balance"],
        ["transfer_pending", "transfer"],
        ["transfer_signed", "signed"],
        ["closed", "closed"],
    ] as const) {
        expect(formalizationReadQueues(roles, [allow(category)])).toEqual(["all", queue]);
    }
});
it("legacy profiles require umbrella allow without deny and no granular entries", () => {
    expect(formalizationReadQueues(roles, [allow("stages")])).toContain("bank");
    expect(formalizationReadQueues(roles, [allow("stages"), { ...allow("stages"), effect: "deny" }])).toEqual([]);
});

it("requires an independent order grant with active role and deny precedence", () => {
    const grant = { code: "formalizacion.orders.read", effect: "allow" };
    expect(canReadFormalizationOrder(roles, [grant])).toBe(true);
    expect(canReadFormalizationOrder(roles, [allow("contracts")])).toBe(false);
    expect(canReadFormalizationOrder(undefined, [grant])).toBe(false);
    expect(canReadFormalizationOrder(roles, [grant, { ...grant, effect: "deny" }])).toBe(false);
    expect(formalizationReadQueues(roles, [grant])).toEqual([]);
});

it("accepts an active chief alone with independent grants and preserves denies", () => {
    const chief = [{ code: "jefe_formalizaciones", name: "Jefe", status: "active" as const }];
    const grant = { code: "formalizacion.orders.read", effect: "allow" };
    expect(canReadFormalizationOrder(chief, [grant])).toBe(true);
    expect(formalizationReadQueues(chief, [allow("contracts")])).toEqual(["all", "contracts", "send", "signature"]);
    expect(canReadFormalizationOrder(chief, [grant, { ...grant, effect: "deny" }])).toBe(false);
    expect(canReadFormalizationOrder([{ code: "jefe_formalizaciones", name: "Jefe", status: "inactive" }], [grant])).toBe(false);
});
