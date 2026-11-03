import { describe, expect, it, vi } from "vitest";

import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { ContractTransitionRepository } from "../../src/modules/crm/sales/sales-orders/contract-transition.repository.js";
import { ContractTransitionService } from "../../src/modules/crm/sales/sales-orders/contract-transition.service.js";

const destinations = ["pending_transfer", "transfer_signed", "closed"] as const;
const command = { source: "native" as const, id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", expectedSequence: 0, operationId: "550e8400-e29b-41d4-a716-446655440000" };
const grant = (code: string, scope = "all_areas", effect = "allow") => ({ code, scope, effect });

function fixture(role = "formalizacion", status = "active", scope = "all_areas") {
    const profile = { user: { publicId: "authenticated-actor" }, roles: role ? [{ code: role, status }] : [], permissions: [grant("formalizacion.orders.stage.update", scope), ...destinations.map((target) => grant(`formalizacion.orders.stage.${target}`, scope))] };
    const getCurrentUser = vi.fn().mockImplementation(() => Promise.resolve(profile));
    const transition = vi.fn().mockResolvedValue({ sequence: 1 });
    const service = new ContractTransitionService({ getCurrentUser } as unknown as IdentityService, { transition } as unknown as ContractTransitionRepository);
    return { profile, getCurrentUser, transition, service };
}

describe.each(destinations)("completion destination %s authorization", (targetState) => {
    it.each(["formalizacion", "jefe_formalizaciones"])("accepts active operational role %s with both grants", async (role) => {
        const f = fixture(role);
        await expect(f.service.transition("session", "set", { ...command, targetState })).resolves.toEqual({ sequence: 1 });
        expect(f.transition).toHaveBeenCalledWith(expect.objectContaining({ targetState, actorPublicId: "authenticated-actor", canSkipStages: false, ownOnly: false }));
    });
    it.each(["owner", "jefe_general", "ventas", "mercadeo", ""])("rejects %s alone even with both grants", async (role) => {
        const f = fixture(role);
        await expect(f.service.transition("session", "set", { ...command, targetState })).rejects.toMatchObject({ status: 403 });
        expect(f.transition).not.toHaveBeenCalled();
    });
    it.each(["inactive", "revoked"])("rejects %s operational membership", async (status) => {
        const f = fixture("formalizacion", status);
        await expect(f.service.transition("session", "set", { ...command, targetState })).rejects.toMatchObject({ status: 403 });
        expect(f.transition).not.toHaveBeenCalled();
    });
    it.each(["formalizacion.orders.stage.update", `formalizacion.orders.stage.${targetState}`])("requires effective permission %s and denies override grants", async (code) => {
        const f = fixture();
        f.profile.permissions = f.profile.permissions.filter((entry) => entry.code !== code);
        await expect(f.service.transition("session", "set", { ...command, targetState })).rejects.toMatchObject({ status: 403 });
        f.profile.permissions.push(grant(code), grant(code, "all_areas", "deny"));
        await expect(f.service.transition("session", "set", { ...command, targetState })).rejects.toMatchObject({ status: 403 });
        expect(f.transition).not.toHaveBeenCalled();
    });
    it.each(["self", "assigned", "own_area", "own_area_and_children", "all_areas"])("honors module-wide management for valid %s scope", async (scope) => {
        const f = fixture("formalizacion", "active", scope);
        await f.service.transition("session", "set", { ...command, targetState });
        expect(f.transition).toHaveBeenCalledWith(expect.objectContaining({ ownOnly: false }));
    });
    it("revalidates role and grants on idempotency-key retry", async () => {
        const f = fixture();
        await f.service.transition("session", "set", { ...command, targetState });
        f.profile.roles = [];
        await expect(f.service.transition("session", "set", { ...command, targetState })).rejects.toMatchObject({ status: 403 });
        f.profile.roles = [{ code: "formalizacion", status: "active" }];
        f.profile.permissions.push(grant(`formalizacion.orders.stage.${targetState}`, "all_areas", "deny"));
        await expect(f.service.transition("session", "set", { ...command, targetState })).rejects.toMatchObject({ status: 403 });
        expect(f.getCurrentUser).toHaveBeenCalledTimes(3);
        expect(f.transition).toHaveBeenCalledTimes(1);
    });
});

describe("completion command trust boundary", () => {
    it.each(["owner", "jefe_general"])("accepts %s only when the live effective profile also contains Formalizacion", async (role) => {
        const f = fixture(role);
        f.profile.roles.push({ code: "formalizacion", status: "active" });
        await f.service.transition("session", "set", { ...command, targetState: "closed" });
        expect(f.transition).toHaveBeenCalledTimes(1);
        f.profile.permissions.push(grant("formalizacion.orders.stage.closed", "all_areas", "deny"));
        await expect(f.service.transition("session", "set", { ...command, targetState: "closed" })).rejects.toMatchObject({ status: 403 });
        expect(f.transition).toHaveBeenCalledTimes(1);
    });
    it.each([{ canSkipStages: true }, { actorPublicId: "forged" }, { ownOnly: false }, { source: "crm" }, { source: "legacy" }])("rejects untrusted command fields or source alias %j", async (change) => {
        const f = fixture();
        await expect(f.service.transition("session", "set", { ...command, targetState: "closed", ...change } as never)).rejects.toMatchObject({ status: 400 });
        expect(f.transition).not.toHaveBeenCalled();
    });
    it("derives skip from effective live grant without bypassing destination deny", async () => {
        const f = fixture();
        f.profile.permissions.push(grant("formalizacion.orders.stage.skip"));
        await f.service.transition("session", "set", { ...command, targetState: "closed", reason: "Authorized exceptional closure" });
        expect(f.transition).toHaveBeenLastCalledWith(expect.objectContaining({ canSkipStages: true }));
        f.profile.permissions.push(grant("formalizacion.orders.stage.skip", "all_areas", "deny"));
        await f.service.transition("session", "set", { ...command, targetState: "closed" });
        expect(f.transition).toHaveBeenLastCalledWith(expect.objectContaining({ canSkipStages: false }));
        f.profile.permissions.push(grant("formalizacion.orders.stage.closed", "all_areas", "deny"));
        await expect(f.service.transition("session", "set", { ...command, targetState: "closed" })).rejects.toMatchObject({ status: 403 });
        expect(f.transition).toHaveBeenCalledTimes(2);
    });
    it("propagates session rejection before the persistence boundary", async () => {
        const f = fixture();
        f.getCurrentUser.mockRejectedValueOnce(Object.assign(new Error("session expired"), { status: 401 }));
        await expect(f.service.transition(undefined, "set", { ...command, targetState: "closed" })).rejects.toMatchObject({ status: 401 });
        expect(f.transition).not.toHaveBeenCalled();
    });
});
