import { describe, expect, it } from "vitest";

import { ADMINISTRATION_CATALOGS } from "../../src/modules/administration/catalogs/catalog-definitions";
import { getCatalogPermissions } from "../../src/modules/administration/catalogs/catalog-permissions";
import type { IdentityProfile } from "../../src/services/auth/identity-contracts";
const bank = () => {
    const value = ADMINISTRATION_CATALOGS.find((item) => item.code === "banks");
    if (!value) throw new Error("Banks missing");
    return value;
};
const profile = (role: string, effect = "allow", membership = true) => ({ roles: [{ code: role, status: "active" }], orgUnits: membership ? [{ code: "ventas", status: "active" }] : [], permissions: ["read", "create", "update", "inactivate"].map((action) => ({ code: `ventas.catalog_bank.${action}`, effect })) }) as unknown as IdentityProfile;
describe("bank catalog policy", () => {
    it("registers banks without external reference catalog UI", () => {
        expect(bank()).toMatchObject({ moduleCode: "catalog_bank", label: "Bancos" });
    });
    it.each(["ventas", "formalizacion", "jefe_ventas", "jefe_global"])("allows an effective direct grant with role %s", (role) => {
        expect(getCatalogPermissions(profile(role), bank(), "ventas").read).toBe(true);
    });
    it.each(["owner", "jefe_general"])("allows exact active role %s", (role) => {
        expect(getCatalogPermissions(profile(role), bank(), "ventas").create).toBe(true);
    });
    it("requires membership for jefe general", () => {
        expect(getCatalogPermissions(profile("jefe_general", "allow", false), bank(), "ventas").read).toBe(false);
    });
    it("owner bypasses only membership", () => {
        expect(getCatalogPermissions(profile("owner", "deny", false), bank(), "ventas").read).toBe(false);
    });
    it("requires read before allowing any mutation", () => {
        const p = profile("owner");
        expect(getCatalogPermissions({ ...p, permissions: p.permissions.filter((item) => !item.code.endsWith(".read")) }, bank(), "ventas").create).toBe(false);
    });
});

it.each(ADMINISTRATION_CATALOGS)("honors personal read and deny for $code without management roles", (catalog) => {
    const p = { ...profile("formalizacion"), permissions: [{ code: `ventas.${catalog.moduleCode}.read`, effect: "allow" as const, scope: null, source: "override" as const }] };
    expect(getCatalogPermissions(p, catalog, "ventas").read).toBe(true);
    expect(getCatalogPermissions({ ...p, permissions: [...p.permissions, ...p.permissions.map((permission) => ({ ...permission, effect: "deny" as const }))] }, catalog, "ventas").read).toBe(false);
});
