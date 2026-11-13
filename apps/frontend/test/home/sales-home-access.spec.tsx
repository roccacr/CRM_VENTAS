import { describe, expect, it } from "vitest";

import { ASSIGNED_WORKSPACES, getVisibleNavigationWorkspaces } from "../../src/modules/home/GlobalHomeShell";
import { getAppRoute } from "../../src/routes/app-routes";
import { getDefaultAuthenticatedPath, resolveRouteState } from "../../src/routes/auth-state";
import type { IdentityProfile } from "../../src/services/auth/identity-contracts";

const fixture = (role: string): IdentityProfile => ({
    auth: { availableProviders: ["local"], currentProvider: "local", localStatus: "active", microsoft: null, primaryProvider: "microsoft" },
    roles: [{ code: role, name: role, status: "active" }],
    orgUnits: [{ code: "ventas", name: "Ventas", publicId: "sales", membership: "member", scope: "all_areas", status: "active" }],
    permissions: [{ code: "ventas.home.read", effect: "allow", scope: "self", source: "role" }],
    user: { displayName: "Synthetic actor", email: "actor@example.test", publicId: "actor", status: "active", permissionVersion: 1, profileImageUrl: null },
    session: { publicId: "session", status: "active", expiresAt: "2099-01-01T00:00:00Z", expiresInSeconds: 60, permissionVersion: 1 },
});
const visible = (profile: IdentityProfile) => getVisibleNavigationWorkspaces(profile.permissions, profile.orgUnits, ASSIGNED_WORKSPACES, profile.roles);

describe("Sales only Inicio", () => {
    it.each(["owner", "jefe_general", "jefe_ventas", "ventas"])("allows %s with membership and effective grant", (role) => {
        const actor = fixture(role);
        expect(visible(actor).map((workspace) => workspace.code)).toEqual(["sales"]);
        expect(visible(actor)[0]?.menuItems.map((item) => item.label)).toEqual(["Inicio"]);
        expect(resolveRouteState(actor, "/home/sales").status).toBe("authenticated");
        expect(getDefaultAuthenticatedPath(actor)).toBe("/home/sales");
        const denied: IdentityProfile = { ...actor, permissions: [...actor.permissions, { code: "ventas.home.read", effect: "deny", scope: null, source: "override" }] };
        expect(visible(denied)).toEqual([]);
        expect(resolveRouteState(denied, "/home/sales").status).toBe("forbidden");
    });
    it.each(["mercadeo", "formalizacion", "jefe_mercadeo", "jefe_formalizaciones", "", "OWNER"])("hides Sales and blocks its URL for %j even with a personal grant", (role) => {
        const actor = fixture(role);
        expect(visible(actor)).toEqual([]);
        expect(resolveRouteState(actor, "/home/sales").status).toBe("forbidden");
        expect(getDefaultAuthenticatedPath(actor)).toBeNull();
    });
    it("requires an active membership and role", () => {
        const actor = fixture("owner");
        expect(visible({ ...actor, orgUnits: [] })).toEqual([]);
        expect(visible({ ...actor, roles: actor.roles.map((role) => ({ ...role, status: "inactive" })) })).toEqual([]);
        expect(visible({ ...actor, permissions: [{ code: "lead.read", effect: "allow", scope: "all_areas", source: "role" }] })).toEqual([]);
    });
    it.each(["/home/accounting", "/home/accounting/calendar", "/home/accounting/catalogs/projects"])("does not register retired Accounting URL %s", (path) => {
        expect(getAppRoute(path)).toBeUndefined();
        expect(ASSIGNED_WORKSPACES.some((workspace) => workspace.code === "accounting")).toBe(false);
    });
    it.each(["/home/sales/calendar", "/home/sales/catalogs/projects", "/home/sales/catalogs/banks", "/home/sales/leads", "/home/sales/opportunities", "/home/sales/estimates"])("does not register retired URL %s", (path) => {
        expect(getAppRoute(path)).toBeUndefined();
    });
    it("retains Marketing and its catalog routes", () => {
        const actor: IdentityProfile = { ...fixture("mercadeo"), orgUnits: [{ code: "mercadeo", name: "Mercadeo", publicId: "marketing", membership: "member", scope: "self", status: "active" }], permissions: [{ code: "mercadeo.catalog_project.read", effect: "allow", scope: "self", source: "role" }] };
        expect(resolveRouteState(actor, "/home/marketing/catalogs/projects").status).toBe("authenticated");
    });
});
