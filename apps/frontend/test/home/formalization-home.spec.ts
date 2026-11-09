import { describe, expect, it } from "vitest";

import { buildCreateUserPayload, createInitialUserFormValues, getRoleModules } from "../../src/modules/administration/create-system-user.model";
import { getVisibleNavigationWorkspaces } from "../../src/modules/home/GlobalHomeShell";
import { getAppRoute, isKnownPath } from "../../src/routes/app-routes";
import { getDefaultAuthenticatedPath, resolveRouteState } from "../../src/routes/auth-state";
import type { IdentityProfile } from "../../src/services/auth/identity-contracts";

const profile = (codes: readonly string[]): IdentityProfile => ({
    user: { publicId: "user", displayName: "Formalization user", email: "user@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 },
    session: { publicId: "session", status: "active", expiresAt: "2026-10-14T00:00:00Z", expiresInSeconds: 3600, permissionVersion: 1 },
    auth: { primaryProvider: "microsoft", availableProviders: ["local"], currentProvider: "local", localStatus: "active", microsoft: null },
    roles: [{ code: "formalizacion", name: "Formalización", status: "active" }],
    permissions: codes.map((code) => ({ code, effect: "allow", scope: "self", source: "role" })),
    orgUnits: [{ publicId: "unit", code: "formalizacion", name: "Formalización", membership: "member", scope: "self", status: "active" }],
});

describe("Formalization Home-only access", () => {
    const homeOnly = profile([]);
    it("shows Inicio with the management menu intentionally hidden and selects a valid login destination", () => {
        const workspaces = getVisibleNavigationWorkspaces(homeOnly.permissions, homeOnly.orgUnits);
        expect(workspaces.map(({ code }) => code)).toEqual(["formalization"]);
        expect(workspaces[0]?.menuItems.map(({ label }) => label)).toEqual(["Inicio"]);
        expect(getDefaultAuthenticatedPath(homeOnly)).toBe("/home/formalization");
        expect(resolveRouteState(homeOnly, "/home/formalization").status).toBe("authenticated");
        expect(resolveRouteState(homeOnly, "/home/formalization/orders").status).toBe("forbidden");
        expect(resolveRouteState(homeOnly, "/home/formalization/calendar").status).toBe("forbidden");
        expect(resolveRouteState(profile([]), "/home/formalization/calendar").status).toBe("forbidden");
        expect(resolveRouteState(profile([]), "/home/formalization/orders").status).toBe("forbidden");
        expect(resolveRouteState(profile(["formalizacion.orders.read", "formalizacion.home.contracts.read"]), "/home/formalization/orders").status).toBe("authenticated");
    });
    it.each(["projects", "campaigns", "classes", "locations", "subsidiaries", "brokers", "files"])("denies the %s catalog URL", (catalog) => {
        expect(resolveRouteState(homeOnly, `/home/formalization/catalogs/${catalog}`).status).toBe("forbidden");
    });
    it("keeps Home accessible but retires the summary URL", () => {
        expect(getAppRoute("/home/formalization/summary")).toBeUndefined();
        expect(isKnownPath("/home/formalization/summary")).toBe(false);
        const legacy = profile(["file.read"]);
        expect(getDefaultAuthenticatedPath(legacy)).toBe("/home/formalization");
        expect(getDefaultAuthenticatedPath(legacy, "formalization")).toBe("/home/formalization");
    });
    it("does not admit users without active module membership even with the banner permission", () => {
        const outsider = { ...profile(["formalizacion.home.approvals.read"]), orgUnits: [] };
        expect(resolveRouteState(outsider, "/home/formalization").status).toBe("forbidden");
        const deniedBanner = { ...profile([]), permissions: [{ code: "formalizacion.home.approvals.read", effect: "deny" as const, scope: "self", source: "override" as const }] };
        expect(resolveRouteState(deniedBanner, "/home/formalization").status).toBe("authenticated");
    });
    it.each([
        ["file.read", "files"],
        ["contract.review", "contracts"],
    ])("does not expose the removed %s business entry or grant Inicio", (permission, section) => {
        const legacy = profile([permission]);
        const workspace = getVisibleNavigationWorkspaces(legacy.permissions, legacy.orgUnits)[0];
        const item = workspace?.menuItems.find(({ code }) => code === `formalization-${section}`);
        expect(item).toBeUndefined();
        expect(resolveRouteState(legacy, `/home/formalization/${section}`).status).toBe("forbidden");
        expect(resolveRouteState(homeOnly, `/home/formalization/${section}`).status).toBe("forbidden");
    });
    it("derives Formalization membership from its role without requiring any banner grants", () => {
        const modules = [{ code: "formalizacion", name: "Formalización", views: [{ code: "home", name: "Inicio", permissions: [{ code: "formalizacion.home.read", name: "Ver inicio", sensitive: false }] }] }];
        const selected = getRoleModules(["formalizacion"], { formalizacion: [] }, modules);
        expect(selected.map(({ code }) => code)).toEqual(["formalizacion"]);
        expect(buildCreateUserPayload({ ...createInitialUserFormValues(), roleCodes: ["formalizacion"] }, selected)).toMatchObject({ roleCode: "formalizacion", roleCodes: ["formalizacion"], orgUnitCodes: ["formalizacion"] });
    });
});
it("keeps query-based calendar origin navigation permission-bound", () => {
    const path = "/home/formalization/calendar?date=2026-10-28&event=event-1";
    expect(resolveRouteState(profile(["formalizacion.calendar.read"]), path).status).toBe("authenticated");
    expect(resolveRouteState(profile([]), path).status).toBe("forbidden");
});

it.each(["formalizacion", "jefe_formalizaciones"])("keeps the hidden order route available to authorized %s", (role) => {
    const current = profile(["formalizacion.orders.read", "formalizacion.home.contracts.read"]);
    const authorized: IdentityProfile = { ...current, roles: [{ code: role, name: role, status: "active" }] };
    expect(resolveRouteState(authorized, "/home/formalization/orders").status).toBe("authenticated");
    expect(getVisibleNavigationWorkspaces(authorized.permissions, authorized.orgUnits)[0]?.menuItems.some((item) => item.code === "formalization-management")).toBe(false);
    expect(resolveRouteState(authorized, "/home/marketing/leads").status).toBe("forbidden");
});
it.each(["denied", "no_membership"])("keeps the hidden order route protected when %s", (state) => {
    const current = profile(["formalizacion.orders.read"]);
    const restricted: IdentityProfile = state === "denied" ? { ...current, permissions: [...current.permissions, { code: "formalizacion.orders.read", effect: "deny", scope: null, source: "override" }] } : { ...current, orgUnits: [] };
    expect(resolveRouteState(restricted, "/home/formalization/orders").status).toBe("forbidden");
});
