import { describe, expect, it } from "vitest";

import { createMarketingWindow, type LegacyMarketingData, type NativeMarketingData } from "../../src/modules/crm/marketing/marketing-home.contract.js";
import { buildMarketingHome } from "../../src/modules/crm/marketing/marketing-home.model.js";
import { includeDescendants } from "../../src/modules/crm/marketing/marketing-home.repository.js";
const now = new Date("2026-10-24T02:00:00Z");
const window = createMarketingWindow("month", now);
const native: NativeMarketingData = { rows: [{ date: "2026-10-23", sellerId: "user-one", projectId: "project-one", leads: 2 }], users: [{ id: "user-one", name: "Vendedor", email: "seller@example.test" }], projects: [{ id: "project-one", name: "Proyecto" }], userAliases: [], projectAliases: [{ id: "project-one", system: "netsuite", externalId: "8" }] };
const legacy: LegacyMarketingData = { provider: "netsuite", owners: [{ reference: "50", name: "Nombre viejo", email: "seller@example.test" }], rows: [{ date: "2026-10-23", sellerReference: "50", projectReference: "8", projectName: "Nombre anterior", leads: 3, duplicates: 1, ambiguous: 0 }] };
describe("canonical marketing read model", () => {
    it("merges native-first stable identities without exposing source emails or provider references", () => {
        const result = buildMarketingHome(native, legacy, window, { observedAt: now, legacyEnabled: true });
        expect(result.counts.leads).toBe(5);
        expect(result.rows).toEqual([{ date: "2026-10-23", sellerId: "user-one", projectId: "project-one", leads: 5 }]);
        expect(result.sellers).toEqual([{ id: "user-one", publicId: "user-one", name: "Vendedor" }]);
        expect(result.sources).toMatchObject({ native: 2, legacy: 3, duplicatesExcluded: 1 });
        expect(JSON.stringify(result)).not.toContain("seller@example.test");
        expect(result.appointments).toEqual({ available: false });
    });
    it("uses provider-scoped aliases ahead of email and does not match a different provider", () => {
        const other = { ...native, users: [...native.users, { id: "user-two", name: "Otro", email: "other@example.test" }], userAliases: [{ id: "user-two", system: "odoo", externalId: "50" }] };
        expect(buildMarketingHome(other, legacy, window, { observedAt: now, legacyEnabled: true }).sellers[0]?.id).toBe("user-one");
        other.userAliases[0] = { id: "user-two", system: "netsuite", externalId: "50" };
        expect(buildMarketingHome(other, legacy, window, { observedAt: now, legacyEnabled: true }).sellers).toHaveLength(2);
    });
    it("retains unresolved sellers and ambiguous overlaps instead of discarding their leads", () => {
        const unresolved = { ...legacy, owners: [{ reference: "50", name: null, email: null }], rows: [{ ...(legacy.rows[0] as LegacyMarketingData["rows"][number]), ambiguous: 2 }] };
        const result = buildMarketingHome(native, unresolved, window, { observedAt: now, legacyEnabled: true });
        expect(result.counts.leads).toBe(5);
        expect(result.sellers.some((seller) => seller.publicId === null)).toBe(true);
        expect(result.sources.ambiguousOverlaps).toBe(2);
    });
    it("works with the legacy source disabled without fabricated appointment data", () => {
        const result = buildMarketingHome(native, { provider: "netsuite", rows: [], owners: [] }, window, { observedAt: now, legacyEnabled: false });
        expect(result.counts.leads).toBe(2);
        expect(result.sources.legacyEnabled).toBe(false);
    });
});

it("filters both sources and their directories and counters to authorized sellers", () => {
    const result = buildMarketingHome(native, legacy, window, { observedAt: now, legacyEnabled: true, sellerScope: new Set(["somebody-else"]) });
    expect(result.rows).toEqual([]);
    expect(result.sellers).toEqual([]);
    expect(result.projects).toEqual([]);
    expect(result.counts.leads).toBe(0);
    expect(result.sources).toMatchObject({ native: 0, legacy: 0, duplicatesExcluded: 0 });
});

it("limits organizational closure to the assigned subtree and terminates cycles", () => {
    const permitted = new Set([1]);
    includeDescendants(
        [
            { id_org_unit: 3, parent_org_unit_id_org_unit: 2 },
            { id_org_unit: 2, parent_org_unit_id_org_unit: 1 },
            { id_org_unit: 1, parent_org_unit_id_org_unit: 3 },
            { id_org_unit: 4, parent_org_unit_id_org_unit: null },
        ],
        permitted,
    );
    expect([...permitted].sort()).toEqual([1, 2, 3]);
});
