import { describe, expect, it } from "vitest";

import { buildCreateUserPayload, createInitialUserFormValues, getRoleModules } from "../../src/modules/administration/create-system-user.model";
import { getVisibleNavigationWorkspaces } from "../../src/modules/home/GlobalHomeShell";
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
    it("shows Inicio and the visual management option and selects a valid login destination", () => {
        const workspaces = getVisibleNavigationWorkspaces(homeOnly.permissions, homeOnly.orgUnits);
        expect(workspaces.map(({ code }) => code)).toEqual(["formalization"]);
        expect(workspaces[0]?.menuItems.map(({ label }) => label)).toEqual(["Inicio", "Gestión de formalizaciones", "Calendario", "Resumen"]);
        expect(getDefaultAuthenticatedPath(homeOnly)).toBe("/home/formalization");
        expect(resolveRouteState(homeOnly, "/home/formalization").status).toBe("authenticated");
        expect(resolveRouteState(homeOnly, "/home/formalization/orders").status).toBe("authenticated");
        expect(resolveRouteState(homeOnly, "/home/formalization/calendar").status).toBe("authenticated");
        expect(resolveRouteState(profile([]), "/home/formalization/calendar").status).toBe("authenticated");
        expect(resolveRouteState(profile([]), "/home/formalization/orders").status).toBe("authenticated");
    });
    it.each(["projects", "campaigns", "classes", "locations", "subsidiaries", "brokers", "files"])("denies the %s catalog URL", (catalog) => {
        expect(resolveRouteState(homeOnly, `/home/formalization/catalogs/${catalog}`).status).toBe("forbidden");
    });
    it("opens the existing preview through module membership without a Home permission", () => {
        const legacy = profile(["file.read"]);
        expect(getDefaultAuthenticatedPath(legacy)).toBe("/home/formalization");
        expect(getDefaultAuthenticatedPath(legacy, "formalization")).toBe("/home/formalization");
        expect(resolveRouteState(legacy, "/home/formalization/summary").status).toBe("authenticated");
        expect(resolveRouteState(homeOnly, "/home/formalization/summary").status).toBe("authenticated");
        expect(resolveRouteState(profile([]), "/home/formalization/summary").status).toBe("authenticated");
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
