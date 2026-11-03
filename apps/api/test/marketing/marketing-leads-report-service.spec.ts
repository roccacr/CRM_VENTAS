import "reflect-metadata";

import type { Transaction } from "kysely";
import { describe, expect, it, vi } from "vitest";

import type { CrmDatabase } from "../../src/database/database.types.js";
import { MarketingLeadsReportService } from "../../src/modules/crm/marketing/marketing-leads-report.service.js";

const empty = { leads: [], events: [], users: [], projects: [], campaigns: [], userAliases: [], projectAliases: [], campaignAliases: [], leadAliases: [] };
function fixture(scopes = ["all_areas"], deny = false, enabled = true) {
    const order: string[] = [];
    const identity = { getCurrentUser: vi.fn().mockResolvedValue({ user: { publicId: "me" }, permissions: scopes.map((scope) => ({ code: "mercadeo.leads.read", effect: deny ? "deny" : "allow", scope })) }) };
    const snapshot = { readSnapshot: vi.fn().mockImplementation((read: (tx: Transaction<CrmDatabase>) => Promise<unknown>) => read({} as Transaction<CrmDatabase>)), visibleSellers: vi.fn().mockResolvedValue(new Set(["me"])) };
    const repository = {
        readNative: vi.fn().mockImplementation(() => {
            order.push("native");
            return Promise.resolve(empty);
        }),
    };
    const legacy = {
        enabled: () => enabled,
        read: vi.fn().mockImplementation(() => {
            order.push("legacy");
            return Promise.resolve(empty);
        }),
    };
    return { identity, snapshot, repository, legacy, order, service: new MarketingLeadsReportService(identity as never, snapshot as never, repository as never, legacy) };
}
describe("capture report authorization and source behavior", () => {
    it.each(["allow", "deny"])("honors an explicit global read and its deny: %s", async (effect) => {
        const f = fixture(["self"]);
        f.identity.getCurrentUser.mockResolvedValue({
            user: { publicId: "me" },
            permissions: [
                { code: "mercadeo.leads.read", effect: "allow", scope: "self" },
                { code: "mercadeo.reports.read_all", effect, scope: "self" },
            ],
        });
        await f.service.report("session", {});
        expect(f.snapshot.visibleSellers).toHaveBeenCalledTimes(effect === "allow" ? 0 : 1);
    });

    it("requires ordinary report access even with global read", async () => {
        const f = fixture();
        f.identity.getCurrentUser.mockResolvedValue({ user: { publicId: "me" }, permissions: [{ code: "mercadeo.reports.read_all", effect: "allow", scope: "self" }] });
        await expect(f.service.report("session", {})).rejects.toMatchObject({ status: 403 });
        expect(f.snapshot.readSnapshot).not.toHaveBeenCalled();
    });
    it("checks permission and deny before database access", async () => {
        const f = fixture(["all_areas"], true);
        await expect(f.service.report("session", {})).rejects.toThrow("Permiso insuficiente");
        expect(f.snapshot.readSnapshot).not.toHaveBeenCalled();
    });
    it("rejects unknown scope and invalid query before database reads", async () => {
        const scoped = fixture(["unknown"]);
        await expect(scoped.service.report("session", {})).rejects.toThrow("Alcance");
        const f = fixture();
        await expect(f.service.report("session", { period: "year" })).rejects.toThrow("Periodo");
        expect(f.snapshot.readSnapshot).not.toHaveBeenCalled();
    });
    it("reads native then enabled legacy in one snapshot", async () => {
        const f = fixture();
        const response = await f.service.report("session", {});
        expect(f.order).toEqual(["native", "legacy"]);
        expect(f.snapshot.readSnapshot).toHaveBeenCalledOnce();
        expect(response.period).toBe("month");
        expect(Object.keys(response)).toEqual(["schemaVersion", "observedAt", "today", "timeZone", "period", "qualification", "range", "coverage", "rows", "sellers", "projects", "campaigns", "ads", "sources", "quality"]);
    });
    it("resolves area scope and never reads disabled legacy", async () => {
        const f = fixture(["own_area_and_children"], false, false);
        await f.service.report("session", { period: "all" });
        expect(f.snapshot.visibleSellers).toHaveBeenCalledWith(expect.anything(), expect.anything(), ["own_area_and_children"]);
        expect(f.order).toEqual(["native"]);
    });
    it("fails enabled source with 503 instead of a partial or zero report", async () => {
        const f = fixture();
        f.legacy.read.mockRejectedValue(new Error("driver"));
        await expect(f.service.report("session", {})).rejects.toMatchObject({ status: 503 });
    });
    it("does not read legacy when the native source fails", async () => {
        const f = fixture();
        f.repository.readNative.mockRejectedValue(new Error("driver"));
        await expect(f.service.report("session", {})).rejects.toMatchObject({ status: 503 });
        expect(f.legacy.read).not.toHaveBeenCalled();
    });
    it("requires the Leads permission even if Home is allowed", async () => {
        const f = fixture();
        f.identity.getCurrentUser.mockResolvedValue({ user: { publicId: "me" }, permissions: [{ code: "mercadeo.home.read", effect: "allow", scope: "all_areas" }] });
        await expect(f.service.report("session", {})).rejects.toMatchObject({ status: 403 });
        expect(f.snapshot.readSnapshot).not.toHaveBeenCalled();
    });
});
