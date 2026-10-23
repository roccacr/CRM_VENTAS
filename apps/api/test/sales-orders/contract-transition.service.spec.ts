import { SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants.js";
import { describe, expect, it, vi } from "vitest";

import { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import { ContractTransitionRepository } from "../../src/modules/crm/sales/sales-orders/contract-transition.repository.js";
import { ContractTransitionService } from "../../src/modules/crm/sales/sales-orders/contract-transition.service.js";

const input = { source: "native" as const, id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", expectedSequence: 0, operationId: "550e8400-e29b-41d4-a716-446655440000" };
function setup(roles = [{ code: "formalizacion", status: "active" }], permissions = [{ code: "formalizacion.contracts.send", effect: "allow" }]) {
    const getCurrentUser = vi.fn().mockResolvedValue({ user: { publicId: "actor" }, roles, permissions });
    const transition = vi.fn().mockResolvedValue({ sequence: 1 });
    return { service: new ContractTransitionService({ getCurrentUser } as unknown as IdentityService, { transition } as unknown as ContractTransitionRepository), transition };
}

describe("contract transition authorization and internal input", () => {
    it("declares explicit injection tokens for internal use without reflected parameter metadata", () => {
        expect(Reflect.getMetadata(SELF_DECLARED_DEPS_METADATA, ContractTransitionService)).toEqual(
            expect.arrayContaining([
                { index: 0, param: IdentityService },
                { index: 1, param: ContractTransitionRepository },
            ]),
        );
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
    it.each([{ roles: [] }, { roles: [{ code: "formalizacion", status: "inactive" }] }, { roles: [{ code: "owner", status: "active" }] }])("requires active base role before any order lookup (%j)", async ({ roles }) => {
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
        const f = setup(undefined, [{ code: "formalizacion.contracts.revert", effect: "allow" }]);
        await expect(f.service.transition("session", "revert", { ...input, ...(reason === undefined ? {} : { reason }) })).rejects.toThrow();
        expect(f.transition).not.toHaveBeenCalled();
    });
});
