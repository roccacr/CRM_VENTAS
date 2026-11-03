import { expect, it, vi } from "vitest";

import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { ContractTransitionRepository } from "../../src/modules/crm/sales/sales-orders/contract-transition.repository.js";
import { ContractTransitionService } from "../../src/modules/crm/sales/sales-orders/contract-transition.service.js";
const input = { source: "legacy", id: "legacy:7", status: "pending_send", expectedVersion: 0, operationId: "550e8400-e29b-41d4-a716-446655440000" };
function setup(edit = true, deny = false, read = true) {
    const permissions = [...(read ? [{ code: "formalizacion.orders.read", effect: "allow", scope: "all_areas" }] : []), ...(edit ? [{ code: "formalizacion.orders.stage.update", effect: "allow", scope: "all_areas" }] : []), ...(deny ? [{ code: "formalizacion.orders.stage.update", effect: "deny", scope: "all_areas" }] : [])];
    const identity = { getCurrentUser: vi.fn().mockResolvedValue({ user: { publicId: "actor" }, roles: [{ code: "formalizacion", status: "active" }], permissions }) };
    const finiquito = vi.fn().mockResolvedValue({ eligible: true, status: null, version: 0, originStage: null });
    return { service: new ContractTransitionService(identity as unknown as IdentityService, { finiquito } as unknown as ContractTransitionRepository), finiquito };
}
it("valida y deriva el actor sin aceptar checks del cliente", async () => {
    const f = setup();
    await f.service.finiquito("session", input, true);
    expect(f.finiquito).toHaveBeenCalledWith(expect.objectContaining({ source: "legacy", id: "7", actorPublicId: "actor" }), { status: "pending_send", expectedVersion: 0, operationId: input.operationId });
});
it.each([{ saleLost: true }, { actorPublicId: "forged" }, { status: "other" }, { expectedVersion: -1 }, { operationId: "invalid" }, { id: "7 OR 1=1" }])("rechaza payload inválido %j", async (change) => {
    const f = setup();
    await expect(f.service.finiquito("session", { ...input, ...change }, true)).rejects.toMatchObject({ status: 400 });
    expect(f.finiquito).not.toHaveBeenCalled();
});
it.each([
    [false, false, true],
    [true, true, true],
    [true, false, false],
])("sin lectura/escritura o con deny no persiste", async (edit, deny, read) => {
    const f = setup(edit, deny, read);
    await expect(f.service.finiquito("session", input, true)).rejects.toMatchObject({ status: 403 });
    expect(f.finiquito).not.toHaveBeenCalled();
});
it("solo lectura devuelve canUpdate=false", async () => {
    const f = setup(false);
    expect(await f.service.finiquito("session", { source: "legacy", id: "7" })).toMatchObject({ canUpdate: false });
});
