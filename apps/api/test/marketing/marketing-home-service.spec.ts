import type { Transaction } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import type { MarketingHomeSummary } from "../../src/modules/crm/marketing/marketing-home.contract.js";
import { MarketingHomeService } from "../../src/modules/crm/marketing/marketing-home.service.js";
const empty = { rows: [], users: [], projects: [], userAliases: [], projectAliases: [] };
function fixture(deny = false, enabled = true) {
    const order: string[] = [];
    const identity = { getCurrentUser: vi.fn().mockResolvedValue({ user: { publicId: "me" }, permissions: [{ code: "mercadeo.home.read", effect: deny ? "deny" : "allow", scope: "all_areas" }] }) };
    const repository = {
        readSnapshot: vi.fn().mockImplementation((read: (tx: Transaction<CrmDatabase>) => Promise<MarketingHomeSummary>) => read({} as Transaction<CrmDatabase>)),
        readNative: vi.fn().mockImplementation(() => {
            order.push("native");
            return Promise.resolve(empty);
        }),
    };
    const legacy = {
        enabled: () => enabled,
        read: vi.fn().mockImplementation(() => {
            order.push("legacy");
            return Promise.resolve({ provider: "netsuite", rows: [], owners: [] });
        }),
    };
    return { identity, repository, legacy, order, service: new MarketingHomeService(identity as never, repository as never, legacy) };
}
describe("marketing home read authorization and order", () => {
    it("reads native before legacy and produces one JSON", async () => {
        const f = fixture();
        const result = await f.service.summary("session", { period: "month" });
        expect(f.order).toEqual(["native", "legacy"]);
        expect(result.counts.leads).toBe(0);
        expect(result.appointments.available).toBe(false);
    });
    it("checks deny before touching either database", async () => {
        const f = fixture(true);
        await expect(f.service.summary("session", {})).rejects.toThrow("Permiso insuficiente");
        expect(f.repository.readSnapshot).not.toHaveBeenCalled();
        expect(f.legacy.read).not.toHaveBeenCalled();
    });
    it("never calls disabled legacy", async () => {
        const f = fixture(false, false);
        expect((await f.service.summary("session", {})).sources.legacyEnabled).toBe(false);
        expect(f.order).toEqual(["native"]);
    });
    it("does not turn a failed enabled source into a zero or partial report", async () => {
        const f = fixture();
        f.legacy.read.mockRejectedValue(new Error("Database unavailable"));
        await expect(f.service.summary("session", {})).rejects.toThrow("No fue posible consultar");
    });
    it("rejects invalid query before the report transaction", async () => {
        const f = fixture();
        await expect(f.service.summary("session", { period: "all" })).rejects.toThrow("Periodo");
        expect(f.repository.readSnapshot).not.toHaveBeenCalled();
    });
});

it("resolves area access instead of treating it as global", async () => {
    const f = fixture();
    f.identity.getCurrentUser.mockResolvedValue({ user: { publicId: "me" }, permissions: [{ code: "mercadeo.home.read", effect: "allow", scope: "own_area_and_children" }] });
    const visibleSellers = vi.fn().mockResolvedValue(new Set(["me"]));
    Object.assign(f.repository, { visibleSellers });
    await f.service.summary("session", {});
    expect(visibleSellers).toHaveBeenCalledWith(expect.anything(), expect.anything(), ["own_area_and_children"]);
});
