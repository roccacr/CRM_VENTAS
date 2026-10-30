import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants.js";
import { describe, expect, it, vi } from "vitest";

import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { ContractTransitionRepository } from "../../src/modules/crm/sales/sales-orders/contract-transition.repository.js";
import { ContractTransitionService } from "../../src/modules/crm/sales/sales-orders/contract-transition.service.js";

const input = { source: "native" as const, id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", expectedSequence: 0, operationId: "550e8400-e29b-41d4-a716-446655440000" };
function setup(roles = [{ code: "formalizacion", status: "active" }], permissions: { code: string; effect: string; scope?: string }[] = [{ code: "formalizacion.contracts.send", effect: "allow", scope: "all_areas" }]) {
    const getCurrentUser = vi.fn().mockResolvedValue({ user: { publicId: "actor" }, roles, permissions });
    const transition = vi.fn().mockResolvedValue({ sequence: 1 });
    return { service: new ContractTransitionService({ getCurrentUser } as unknown as IdentityService, { transition } as unknown as ContractTransitionRepository), transition };
}

describe("contract transition authorization and internal input", () => {
    it.each([
        ["contract_pending_signature", "formalizacion.contracts.send"],
        ["contract_pending_send", "formalizacion.contracts.revert"],
    ])("preserves an individual deny for selected destination %s", async (targetState, code) => {
        const f = setup(undefined, [
            { code: "formalizacion.orders.stage.update", effect: "allow", scope: "all_areas" },
            { code, effect: "deny", scope: "all_areas" },
        ]);
        await expect(f.service.transition("session", "set", { ...input, targetState } as never)).rejects.toMatchObject({ status: 403 });
        expect(f.transition).not.toHaveBeenCalled();
    });
    it.each(["contract_pending_signature", "contract_pending_send"])("does not require a legacy allow for the independent selected target %s", async (targetState) => {
        const f = setup(undefined, [
            { code: "formalizacion.orders.stage.update", effect: "allow", scope: "all_areas" },
            { code: `formalizacion.orders.stage.${targetState}`, effect: "allow", scope: "all_areas" },
        ]);
        await expect(f.service.transition("session", "set", { ...input, targetState } as never)).resolves.toEqual({ sequence: 1 });
    });
    it("keeps unrelated destinations available despite old contract denies", async () => {
        const f = setup(undefined, [
            { code: "formalizacion.orders.stage.closed", effect: "allow", scope: "all_areas" },
            { code: "formalizacion.orders.stage.update", effect: "allow", scope: "all_areas" },
            { code: "formalizacion.contracts.send", effect: "deny", scope: "all_areas" },
            { code: "formalizacion.contracts.revert", effect: "deny", scope: "all_areas" },
        ]);
        await expect(f.service.transition("session", "set", { ...input, targetState: "closed" } as never)).resolves.toEqual({ sequence: 1 });
    });
    it("requires the independent stage permission for a selected stage", async () => {
        const f = setup(undefined, [
            { code: "formalizacion.orders.stage.update", effect: "allow", scope: "all_areas" },
            { code: "formalizacion.orders.stage.bank_management", effect: "allow", scope: "all_areas" },
        ]);
        await expect(f.service.transition("session", "set", { ...input, targetState: "bank_management" } as never)).resolves.toEqual({ sequence: 1 });
        expect(f.transition).toHaveBeenCalledWith(expect.objectContaining({ action: "set", targetState: "bank_management", actorPublicId: "actor" }));
    });
    it.each([undefined, "pending_approval", "unclassified", "made_up"])("rejects a missing or nonoperational selected target %s", async (targetState) => {
        const f = setup(undefined, [{ code: "formalizacion.orders.stage.update", effect: "allow", scope: "all_areas" }]);
        await expect(f.service.transition("session", "set", { ...input, targetState } as never)).rejects.toThrow();
        expect(f.transition).not.toHaveBeenCalled();
    });
    it("denies selected changes even when send is granted", async () => {
        const f = setup(undefined, [
            { code: "formalizacion.contracts.send", effect: "allow", scope: "all_areas" },
            { code: "formalizacion.orders.stage.update", effect: "deny", scope: "all_areas" },
        ]);
        await expect(f.service.transition("session", "set", { ...input, targetState: "closed" } as never)).rejects.toThrow();
        expect(f.transition).not.toHaveBeenCalled();
    });
    it("declares explicit injection tokens for internal use without reflected parameter metadata", () => {
        expect(Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, ContractTransitionService)).toEqual(
            expect.arrayContaining([
                { index: 0, param: IdentityService },
                { index: 1, param: ContractTransitionRepository },
            ]),
        );
    });
    it.each([
        ["self", false],
        ["assigned", false],
        ["own_area", false],
        ["own_area_and_children", false],
        ["all_areas", false],
    ] as const)("derives %s scope from live permission", async (scope, ownOnly) => {
        const f = setup(undefined, [{ code: "formalizacion.contracts.send", effect: "allow", scope }]);
        await f.service.transition("session", "send", input, { ownOnly: false } as { ipAddress?: string });
        expect(f.transition).toHaveBeenCalledWith(expect.objectContaining({ ownOnly }));
    });
    it.each([undefined, "unknown"])("rejects unrecognized or missing grant scope %s", async (scope) => {
        const f = setup(undefined, [{ code: "formalizacion.contracts.send", effect: "allow", ...(scope ? { scope } : {}) }]);
        await expect(f.service.transition("session", "send", input)).rejects.toThrow();
        expect(f.transition).not.toHaveBeenCalled();
    });
    it("uses the authenticated actor and delegates a valid send", async () => {
        const f = setup();
        await expect(f.service.transition("session", "send", input)).resolves.toEqual({ sequence: 1 });
        expect(f.transition).toHaveBeenCalledWith(expect.objectContaining({ actorPublicId: "actor", action: "send", reason: "", ...input }));
    });
    it("does not allow internal request metadata to override the session actor or validated command", async () => {
        const f = setup();
        const context = { actorPublicId: "forged", action: "revert", source: "legacy", id: "901", ipAddress: "127.0.0.1" };
        await f.service.transition("session", "send", input, context);
        expect(f.transition).toHaveBeenCalledWith(expect.objectContaining({ actorPublicId: "actor", action: "send", source: "native", id: input.id, ipAddress: "127.0.0.1" }));
    });
    it.each([{ roles: [] }, { roles: [{ code: "formalizacion", status: "inactive" }] }, { roles: [{ code: "jefe_formalizaciones", status: "inactive" }] }, { roles: [{ code: "owner", status: "active" }] }])("requires active base role before any order lookup (%j)", async ({ roles }) => {
        const f = setup(roles);
        await expect(f.service.transition("session", "send", input)).rejects.toThrow("Formalizacion");
        expect(f.transition).not.toHaveBeenCalled();
    });
    it("deny wins over allow", async () => {
        const f = setup(undefined, [
            { code: "formalizacion.contracts.send", effect: "allow" },
            { code: "formalizacion.contracts.send", effect: "deny" },
        ]);
        await expect(f.service.transition("session", "send", input)).rejects.toThrow();
        expect(f.transition).not.toHaveBeenCalled();
    });
    it("send permission does not grant revert", async () => {
        const f = setup();
        await expect(f.service.transition("session", "revert", { ...input, reason: "Correction" })).rejects.toThrow();
        expect(f.transition).not.toHaveBeenCalled();
    });
    it.each([{ id: "1" }, { source: "legacy", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" }, { expectedSequence: -1 }, { expectedSequence: 0.1 }, { operationId: "arbitrary" }, { operationId: "x".repeat(101) }, { source: "unknown" }, { id: "0" }, { source: "legacy", id: "2147483648" }])("rejects invalid internal input %j without lookup", async (change) => {
        const f = setup();
        await expect(f.service.transition("session", "send", { ...input, ...change } as typeof input)).rejects.toThrow();
        expect(f.transition).not.toHaveBeenCalled();
    });
    it.each([undefined, "", "  ", "x".repeat(501)])("requires a bounded revert reason", async (reason) => {
        const f = setup(undefined, [{ code: "formalizacion.contracts.revert", effect: "allow", scope: "all_areas" }]);
        await expect(f.service.transition("session", "revert", { ...input, ...(reason === undefined ? {} : { reason }) })).rejects.toThrow();
        expect(f.transition).not.toHaveBeenCalled();
    });
});

it.each(["contract_pending_send", "contract_pending_signature", "bank_management", "pending_balance", "pending_transfer", "transfer_signed", "closed"] as const)("requires the destination permission for %s, preserving individual denies", async (targetState) => {
    const general = { code: "formalizacion.orders.stage.update", effect: "allow", scope: "all_areas" };
    const target = { code: `formalizacion.orders.stage.${targetState}`, effect: "allow", scope: "all_areas" };
    const dto = { ...input, targetState, reason: "Corrección autorizada" };
    const missing = setup(undefined, [general]);
    await expect(missing.service.transition("session", "set", dto)).rejects.toThrow();
    expect(missing.transition).not.toHaveBeenCalled();
    const allowed = setup(undefined, [general, target]);
    await expect(allowed.service.transition("session", "set", dto)).resolves.toEqual({ sequence: 1 });
    const denied = setup(undefined, [general, target, { ...target, effect: "deny" }]);
    await expect(denied.service.transition("session", "set", dto)).rejects.toThrow();
    expect(denied.transition).not.toHaveBeenCalled();
});

it("derives skip capability from the live profile and never accepts a request capability", async () => {
    const base = [
        { code: "formalizacion.orders.stage.update", effect: "allow", scope: "all_areas" },
        { code: "formalizacion.orders.stage.transfer_signed", effect: "allow", scope: "all_areas" },
    ];
    const cmd = { ...input, targetState: "transfer_signed" as const, reason: "Excepción autorizada" };
    const granted = setup(undefined, [...base, { code: "formalizacion.orders.stage.skip", effect: "allow", scope: "all_areas" }]);
    await granted.service.transition("session", "set", cmd);
    expect(granted.transition).toHaveBeenCalledWith(expect.objectContaining({ canSkipStages: true }));
    const denied = setup(undefined, [...base, { code: "formalizacion.orders.stage.skip", effect: "allow", scope: "all_areas" }, { code: "formalizacion.orders.stage.skip", effect: "deny", scope: "all_areas" }]);
    await denied.service.transition("session", "set", cmd);
    expect(denied.transition).toHaveBeenCalledWith(expect.objectContaining({ canSkipStages: false }));
    const forged = setup(undefined, base);
    await expect(forged.service.transition("session", "set", { ...cmd, canSkipStages: true } as never)).rejects.toThrow();
    expect(forged.transition).not.toHaveBeenCalled();
});

describe.each(["formalizacion", "jefe_formalizaciones"])("module-wide writes for %s", (role) => {
    it.each(["self", "assigned"])("sends another seller order with %s and optional self skip", async (scope) => {
        const f = setup(
            [{ code: role, status: "active" }],
            [
                { code: "formalizacion.contracts.send", effect: "allow", scope },
                { code: "formalizacion.orders.stage.skip", effect: "allow", scope: "self" },
            ],
        );
        await f.service.transition("session", "send", input);
        expect(f.transition).toHaveBeenCalledWith(expect.objectContaining({ ownOnly: false, canSkipStages: true }));
    });
    it.each(["self", "assigned"])("selects another seller destination with %s while preserving denies", async (scope) => {
        const grants = [
            { code: "formalizacion.orders.stage.update", effect: "allow", scope },
            { code: "formalizacion.orders.stage.bank_management", effect: "allow", scope },
        ];
        const f = setup([{ code: role, status: "active" }], grants);
        await f.service.transition("session", "set", { ...input, targetState: "bank_management" });
        expect(f.transition).toHaveBeenCalledWith(expect.objectContaining({ ownOnly: false }));
        const denied = setup([{ code: role, status: "active" }], [...grants, { code: "formalizacion.orders.stage.bank_management", effect: "deny", scope }]);
        await expect(denied.service.transition("session", "set", { ...input, targetState: "bank_management" })).rejects.toMatchObject({ status: 403 });
        expect(denied.transition).not.toHaveBeenCalled();
    });
});
