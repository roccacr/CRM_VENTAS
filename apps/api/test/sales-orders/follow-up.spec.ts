import { describe, expect, it, vi } from "vitest";

import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";
import type { IdentityProfile } from "../../src/modules/crm/identity/identity.types.js";
import { followUpQuery, followUpRow, presentFollowUpRow } from "../../src/modules/crm/sales/sales-orders/follow-up.contract.js";
import { FollowUpService } from "../../src/modules/crm/sales/sales-orders/follow-up.service.js";
import type { HomeSummaryRepository } from "../../src/modules/crm/sales/sales-orders/home-summary.repository.js";

const counts = { all: 0, approvals: 0, contracts: 0, send: 0, signature: 0, bank: 0, balance: 0, transfer: 0, signed: 0, closed: 0, addendum: 0 };
const empty = () => ({ total: 0, counts: { ...counts }, projects: [], items: [], sourceTotals: { native: 0, legacy: 0 } });
function setup(codes = ["formalizacion.home.stages.read", "formalizacion.home.approvals.read"], roles = [{ code: "formalizacion", status: "active" }]) {
    const profile = { roles, user: { publicId: "actor" }, permissions: codes.map((code) => ({ code, effect: "allow", scope: "own_area", source: "role" })) } as IdentityProfile;
    const identity = { getCurrentUser: vi.fn().mockResolvedValue(profile) } as unknown as IdentityService;
    const native = { readSnapshot: vi.fn(async (read: (tx: object) => Promise<unknown>) => read({})), readCombined: vi.fn().mockResolvedValue(empty()) };
    const legacy = { enabled: () => true, projection: vi.fn().mockReturnValue("legacy-projection") };
    const service = new FollowUpService(identity, native as never, legacy as never, native as unknown as HomeSummaryRepository);
    return { profile, native, legacy, service };
}

describe("Formalization follow-up", () => {
    it.each([true, false].flatMap((native) => [true, false, null].map((paid) => ({ native, paid }))))("retains explicit paid evidence and the authoritative transfer stage ($native $paid)", ({ native, paid }) => {
        const parsed = followUpRow.parse({ id: "order", source: native ? "native" : "legacy", number: "OV-1", nativeCode: null, client: null, project: null, unit: null, responsible: null, stateCode: "pending_transfer", stateSince: null, completedThisYear: false, unitTransferred: false, unitDelivered: false, keysDelivered: false, installmentsFullyPaid: paid });
        const presented = presentFollowUpRow(parsed, new Date());
        expect(presented).toMatchObject({ installmentsFullyPaid: paid, state: { code: "pending_transfer" } });
        if (paid !== true) expect(presented.nextStep).toContain("Avance bloqueado");
        expect(presentFollowUpRow({ ...parsed, stateCode: "pending_balance" }, new Date()).nextStep).toContain(paid === true ? "Cuotas pagadas" : "Cuotas pendientes");
    });
    it.each([true, false, null])("retains closure with delivered unit independent of paid evidence %s", (paid) => {
        const row = followUpRow.parse({ id: "order", source: "legacy", number: "OV-1", nativeCode: null, client: null, project: null, unit: null, responsible: null, stateCode: "closed", stateSince: null, completedThisYear: true, installmentsFullyPaid: paid, unitDelivered: 1, unitTransferred: null, keysDelivered: null });
        expect(presentFollowUpRow(row, new Date())).toMatchObject({ unitDelivered: true, unitTransferred: null, keysDelivered: null, nextStep: "Proceso finalizado", state: { code: "closed", since: null } });
    });
    it.each([
        ["pending_transfer", false, true, "Traspaso firmado"],
        ["pending_transfer", true, false, "Formalización cerrada"],
        ["transfer_signed", true, false, "Formalización cerrada"],
    ] as const)("guides explicit higher completion from %s", (stateCode, unitDelivered, unitTransferred, destination) => {
        const row = followUpRow.parse({ id: "order", source: "native", number: "OV-1", nativeCode: null, client: null, project: null, unit: null, responsible: null, stateCode, stateSince: null, completedThisYear: false, installmentsFullyPaid: true, unitDelivered, unitTransferred, keysDelivered: false });
        const presented = presentFollowUpRow(row, new Date());
        expect(presented.state).toMatchObject({ code: stateCode, since: null });
        expect(presented.nextStep).toContain(destination);
        expect(presented.nextStep).not.toContain("Avance bloqueado");
    });
    it("defaults to a bounded all queue and rejects malformed or oversized filters", () => {
        expect(followUpQuery.parse({})).toMatchObject({ queue: "all", page: 1, pageSize: 25, search: "", projectId: "" });
        for (const value of [{ pageSize: "101" }, { page: "-1" }, { page: "1e2" }, { queue: "unknown" }, { search: "x".repeat(121) }, { projectId: "1 OR 1=1" }, { extra: "ignored" }]) expect(followUpQuery.safeParse(value).success).toBe(false);
    });
    it("authorizes before either source and never grants an Owner label a bypass", async () => {
        const { service, native, legacy } = setup([], [{ code: "owner", status: "active" }]);
        await expect(service.list("session", {})).rejects.toMatchObject({ status: 403 });
        expect(native.readSnapshot).not.toHaveBeenCalled();
        expect(legacy.projection).not.toHaveBeenCalled();
    });
    it("rejects a direct stage deny before SQL", async () => {
        const { service, profile, native } = setup(["formalizacion.home.stages.read"]);
        profile.permissions.push({ code: "formalizacion.home.stages.read", effect: "deny", scope: null, source: "override" });
        await expect(service.list("session", {})).rejects.toMatchObject({ status: 403 });
        expect(native.readCombined).not.toHaveBeenCalled();
    });
    it("rejects an approvals queue without its separate grant before SQL", async () => {
        const { service, native } = setup(["formalizacion.home.stages.read"]);
        await expect(service.list("session", { queue: "approvals" })).rejects.toMatchObject({ status: 403 });
        expect(native.readCombined).not.toHaveBeenCalled();
    });
    it("selects a global page from both sources and retains source totals", async () => {
        const { service, native, legacy } = setup();
        native.readCombined.mockResolvedValue({ ...empty(), total: 42, counts: { ...counts, all: 42 }, sourceTotals: { native: 12, legacy: 30 } });
        const result = await service.list("session", { page: "2", pageSize: "10" });
        expect(native.readCombined).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ offset: 10, limit: 10 }), expect.anything(), expect.objectContaining({ legacy: "legacy-projection" }));
        expect(legacy.projection).toHaveBeenCalledOnce();
        expect(result.page).toEqual({ number: 2, size: 10, total: 42, totalPages: 5 });
        expect(result.counts.all).toBe(42);
        expect(result.sources).toEqual({ native: { total: 12 }, legacy: { total: 30, enabled: true } });
    });
    it("does not return a partial native response if legacy fails", async () => {
        const { service, legacy } = setup();
        legacy.projection.mockImplementation(() => {
            throw new Error("source unavailable");
        });
        await expect(service.list("session", {})).rejects.toMatchObject({ status: 503 });
    });
    it("propagates approval restrictions to both sources and reads again without a cache", async () => {
        const { service, native, legacy } = setup(["formalizacion.home.stages.read"]);
        await service.list("session", {});
        await service.list("session", {});
        expect(native.readCombined).toHaveBeenCalledTimes(2);
        expect(legacy.projection).toHaveBeenCalledTimes(2);
        expect(native.readCombined.mock.calls[0]?.[3]).toMatchObject({ access: { approvals: false }, legacy: "legacy-projection" });
        expect(legacy.projection).toHaveBeenCalledTimes(2);
    });
    it("does not invent stage age for missing evidence and supplies a read-only next step", () => {
        const row = {
            salesManagementApproved: null,
            developerApproved: null,
            formalizationApproved: null,
            commercialClosureSigned: null,
            contractSignedCheck: null,
            saleLostCheck: null,
            installmentsFullyPaid: null,
            unitTransferred: null,
            keysDelivered: null,
            unitDelivered: null,
            id: "legacy:1",
            source: "legacy" as const,
            number: "OV-1",
            nativeCode: null,
            client: null,
            clientEmail: null,
            project: null,
            unit: null,
            responsible: null,
            stateCode: "contract_pending_send" as const,
            stateSince: null,
            completedThisYear: false,
        };
        const presented = presentFollowUpRow(row, new Date("2026-10-26T12:00:00Z"));
        expect(presented.state).toMatchObject({ code: "contract_pending_send", label: "Por enviar", since: null, days: null });
        expect(presented.nextStep).toBe("Registrar el envío del contrato");
        expect(presented).not.toHaveProperty("stateCode");
    });
});

it("passes module-wide contracts-only union access to both sources and rejects forged banking queue", async () => {
    const f = setup(["formalizacion.home.contracts.read"]);
    for (const grant of f.profile.permissions) grant.scope = "self";
    await f.service.list("session", {});
    expect(f.native.readCombined).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.objectContaining({ access: { ownOnly: false, approvalOwnOnly: false, approvals: false, actorId: "actor", finiquito: false, queues: { approvals: false, contracts: true, bank: false, balance: false, transfer: false, signed: false, closed: false, addendum: false } }, legacy: "legacy-projection" }));
    f.native.readCombined.mockClear();
    await expect(f.service.list("session", { queue: "bank" })).rejects.toMatchObject({ status: 403 });
    expect(f.native.readCombined).not.toHaveBeenCalled();
});
it("does not grant the addendum queue from the historical stage permission or a banner-only grant", async () => {
    for (const codes of [["formalizacion.home.stages.read"], ["formalizacion.home.addendum.read"], ["formalizacion.orders.addendum.read"]]) {
        const f = setup(codes);
        await expect(f.service.list("session", { queue: "addendum" })).rejects.toMatchObject({ status: 403 });
        expect(f.native.readCombined).not.toHaveBeenCalled();
    }
    const f = setup(["formalizacion.orders.read", "formalizacion.orders.addendum.read"]);
    expect(await f.service.list("session", { queue: "addendum" })).toMatchObject({ counts: { addendum: 0 } });
    f.profile.permissions.push({ code: "formalizacion.orders.addendum.read", effect: "deny", scope: null, source: "override" });
    await expect(f.service.list("session", { queue: "addendum" })).rejects.toMatchObject({ status: 403 });
});
it("keeps the ordinary order readable but omits its marker without the addendum read grant", async () => {
    const f = setup(["formalizacion.orders.read"]);
    const row = followUpRow.parse({ id: "order", source: "native", number: "OV-1", nativeCode: null, client: null, project: null, unit: null, responsible: null, stateCode: "contract_pending_send", stateSince: null, completedThisYear: false, addendumStatus: "pending" });
    Object.assign(f.native, { findRecordAuthority: vi.fn().mockResolvedValue({ publicId: "order", active: true }), readRecord: vi.fn().mockResolvedValue(row) });
    const target = { source: "native", id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" };
    const withoutMarker = await f.service.record("session", target);
    expect(withoutMarker).toMatchObject({ id: "order", number: "OV-1" });
    expect(withoutMarker).not.toHaveProperty("addendumStatus");
    f.profile.permissions.push({ code: "formalizacion.orders.addendum.read", effect: "allow", scope: "own_area", source: "override" });
    expect(await f.service.record("session", target)).toMatchObject({ addendumStatus: "pending" });
});

it("rejects a forbidden queue mixed with an allowed queue before reading either source", async () => {
    const { service, native, legacy } = setup(["formalizacion.home.contracts.read"]);
    await expect(service.list("session", { queues: "send,approvals" })).rejects.toMatchObject({ status: 403 });
    expect(native.readCombined).not.toHaveBeenCalled();
    expect(legacy.projection).not.toHaveBeenCalled();
});
it("validates bounded arrays and passes the same selections to both source readers", async () => {
    const { service, native, legacy } = setup();
    const result = await service.list("session", { projectIds: "legacy-project:7,legacy-project:8", queues: "send,bank", bankStages: "bank_management_in_progress" });
    expect(result.filters.projectIds).toEqual(["legacy-project:7", "legacy-project:8"]);
    expect(native.readCombined).toHaveBeenCalledTimes(1);
    expect(legacy.projection).toHaveBeenCalledTimes(1);
    await expect(service.list("session", { projectIds: Array(51).fill("legacy-project:7") })).rejects.toMatchObject({ status: 400 });
});
it("omits the disabled legacy projection while preserving the bounded native global read", async () => {
    const f = setup();
    f.legacy.enabled = () => false;
    const result = await f.service.list("session", {});
    expect(f.legacy.projection).not.toHaveBeenCalled();
    expect(f.native.readCombined.mock.calls[0]?.[3]).not.toHaveProperty("legacy");
    expect(result.sources).toEqual({ native: { total: 0 }, legacy: { total: 0, enabled: false } });
});
