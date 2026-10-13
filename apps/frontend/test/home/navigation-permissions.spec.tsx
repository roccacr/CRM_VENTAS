import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DEMO_EFFECTIVE_NAVIGATION_PERMISSIONS, type EffectiveNavigationPermission, getVisibleNavigationWorkspaces, type GlobalMenuItem, type WorkspaceProfile } from "../../src/modules/home/GlobalHomeShell";
import { AUTH_LOGIN_PATH } from "../../src/routes/app-routes";
import { getDefaultAuthenticatedPath, getRedirectPath, resolveRouteState } from "../../src/routes/auth-state";
import type { IdentityProfile } from "../../src/services/auth/identity-contracts";

const allow = (code: string): EffectiveNavigationPermission => ({ code, effect: "allow" });
const deny = (code: string): EffectiveNavigationPermission => ({ code, effect: "deny" });
const orgUnits = (...codes: string[]) => codes.map((code) => ({ code, membership: "member", name: code, publicId: `${code}-public-id`, scope: "self", status: "active" }));
const CATALOG_CONTEXT_CODES = ["ventas", "mercadeo", "formalizacion", "contabilidad", "administration"] as const;
const CATALOG_MODULE_CODES = ["catalog_project", "catalog_campaign", "catalog_class", "catalog_broker", "catalog_file", "catalog_subsidiary", "catalog_location"] as const;

const getWorkspace = (workspaces: readonly WorkspaceProfile[], code: string): WorkspaceProfile => {
    const workspace = workspaces.find((item) => item.code === code);

    expect(workspace).toBeDefined();

    return workspace as WorkspaceProfile;
};

const getMenuLabels = (items: readonly GlobalMenuItem[]): readonly string[] => items.map((item) => item.label);

const routeProfile = (permissions: readonly EffectiveNavigationPermission[], ...codes: string[]): IdentityProfile => ({
    auth: { availableProviders: ["local"], currentProvider: "local", localStatus: "active", microsoft: null, primaryProvider: "microsoft" },
    orgUnits: orgUnits(...codes),
    permissions: permissions.map((permission) => ({ ...permission, scope: null, source: "role" })),
    roles: [],
    session: { expiresAt: "2099-01-01T00:00:00Z", expiresInSeconds: 60, permissionVersion: 1, publicId: "session", status: "active" },
    user: { displayName: "Navigation user", email: "navigation@example.test", permissionVersion: 1, profileImageUrl: null, publicId: "user", status: "active" },
});

describe("exact registered route access", () => {
    const contexts = [
        { module: "administration", workspace: "administration" },
        { module: "ventas", workspace: "sales" },
        { module: "mercadeo", workspace: "marketing" },
        { module: "formalizacion", workspace: "formalization" },
        { module: "contabilidad", workspace: "accounting" },
    ];
    it.each(contexts)("permits only visible catalog children in $workspace", ({ module, workspace }) => {
        const profile = routeProfile([allow(`${module}.catalog_project.read`)], module);
        expect(resolveRouteState(profile, `/home/${workspace}/catalogs/projects`).status).toBe("authenticated");
        expect(resolveRouteState(profile, `/home/${workspace}/catalogs/campaigns`).status).toBe("forbidden");
        const denied = routeProfile([allow(`${module}.catalog_project.read`), deny(`${module}.catalog_project.read`), allow(`${module}.catalog_campaign.read`)], module);
        expect(resolveRouteState(denied, `/home/${workspace}/catalogs/projects`).status).toBe("forbidden");
    });
    it.each(contexts)("chooses an authorized default route in $workspace when only a catalog is visible", ({ module, workspace }) => {
        const profile = routeProfile([allow(`${module}.catalog_project.read`)], module);
        const expected = workspace === "administration" ? "/home/administration" : `/home/${workspace}/catalogs/projects`;
        expect(getDefaultAuthenticatedPath(profile, workspace)).toBe(expected);
        expect(getDefaultAuthenticatedPath(profile)).toBe(expected);
        expect(resolveRouteState(profile, expected).status).toBe("authenticated");
        expect(resolveRouteState(profile, `/home/${workspace}`).status).toBe(workspace === "administration" ? "authenticated" : "forbidden");
    });
    it("keeps the administration landing page and visible catalog parent without granting hidden views", () => {
        const profile = routeProfile([allow("user.view_list")]);
        expect(resolveRouteState(profile, "/home/administration").status).toBe("authenticated");
        expect(resolveRouteState(profile, "/home/administration/users").status).toBe("authenticated");
        expect(resolveRouteState(profile, "/home/administration/roles-security").status).toBe("forbidden");
        expect(resolveRouteState(profile, "/home/administration/integrations").status).toBe("forbidden");
        expect(resolveRouteState(profile, "/home/administration/catalogs").status).toBe("forbidden");
        expect(resolveRouteState(routeProfile([allow("administration.catalog_project.read")], "administration"), "/home/administration/catalogs").status).toBe("authenticated");
    });
    it.each([
        { permission: "estimate.read", workspace: "sales" },
        { permission: "opportunity.read", workspace: "sales" },
        { permission: "invoice.read", workspace: "accounting" },
    ])("preserves the shared $workspace home URL for $permission", ({ permission, workspace }) => {
        const profile = routeProfile([allow(permission)]);
        expect(resolveRouteState(profile, `/home/${workspace}`).status).toBe("authenticated");
        expect(getDefaultAuthenticatedPath(profile, workspace)).toBe(`/home/${workspace}`);
        expect(resolveRouteState(profile, `/home/${workspace}/catalogs/projects`).status).toBe("forbidden");
    });
    it("does not allow formalization Inicio to mount business views", () => {
        const profile = routeProfile([allow("formalizacion.home.read")], "formalizacion");
        expect(resolveRouteState(profile, "/home/formalization").status).toBe("authenticated");
        expect(resolveRouteState(profile, "/home/formalization/files").status).toBe("forbidden");
        expect(getDefaultAuthenticatedPath(profile)).toBe("/home/formalization");
    });
    it("returns no default for inaccessible workspaces and retains anonymous login redirects", () => {
        const profile = routeProfile([allow("user.view_list")]);
        expect(getDefaultAuthenticatedPath(profile, "sales")).toBeNull();
        expect(getDefaultAuthenticatedPath(routeProfile([]))).toBeNull();
        expect(getRedirectPath({ status: "anonymous" }, "/home/administration/users")).toBe(AUTH_LOGIN_PATH);
        expect(getRedirectPath(resolveRouteState(profile, "/home/administration/roles-security"), "/home/administration/roles-security")).toBeNull();
    });
});

describe("navigation permissions", () => {
    it("mantiene el catalogo visual alineado con el seed de permisos del API", () => {
        const seedPath = resolve(process.cwd(), "../api/Arquitectura/SQL/002_identity_seed_p0_s1.sql");
        const catalogsMigrationPath = resolve(process.cwd(), "../api/migrations/schema-only/202610030007_crm_catalogs.ts");
        const seedSql = readFileSync(seedPath, "utf8");
        const catalogsMigrationSource = readFileSync(catalogsMigrationPath, "utf8");
        const homeMigrationSource = readFileSync(resolve(process.cwd(), "../api/migrations/schema-only/202610130017_formalization_home_role.ts"), "utf8");
        const seedPermissionCodes = new Set([...Array.from(seedSql.matchAll(/\('([a-z][a-z0-9_.]*)',\s*'[a-z][a-z0-9_]*'/giu), (match) => match[1]), ...Array.from(catalogsMigrationSource.matchAll(/"([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)"/giu), (match) => match[1]), ...Array.from(homeMigrationSource.matchAll(/"(formalizacion\.home\.read)"/gu), (match) => match[1]), ...CATALOG_CONTEXT_CODES.flatMap((contextCode) => CATALOG_MODULE_CODES.map((moduleCode) => `${contextCode}.${moduleCode}.read`))]);
        const visualPermissionCodes = DEMO_EFFECTIVE_NAVIGATION_PERMISSIONS.map((permission) => permission.code);

        expect(visualPermissionCodes.filter((permissionCode) => !seedPermissionCodes.has(permissionCode))).toEqual([]);
    });

    it("muestra usuarios de Administracion cuando existe permiso de lista de usuarios", () => {
        const visibleWorkspaces = getVisibleNavigationWorkspaces([allow("user.view_list")]);
        const administrationWorkspace = getWorkspace(visibleWorkspaces, "administration");

        expect(visibleWorkspaces.map((workspace) => workspace.code)).toEqual(["administration"]);
        expect(getMenuLabels(administrationWorkspace.menuItems)).toEqual(["Usuarios"]);
    });

    it("muestra catalogos de Administracion solo con modulo administration y permisos scoped", () => {
        const visibleWorkspaces = getVisibleNavigationWorkspaces([allow("administration.catalog_project.read"), allow("administration.catalog_campaign.read"), allow("administration.catalog_class.read"), allow("administration.catalog_broker.read"), allow("administration.catalog_file.read"), allow("administration.catalog_subsidiary.read"), allow("administration.catalog_location.read")], orgUnits("administration"));
        const administrationWorkspace = getWorkspace(visibleWorkspaces, "administration");
        const catalogsMenu = administrationWorkspace.menuItems.find((item) => item.code === "catalogs");

        expect(visibleWorkspaces.map((workspace) => workspace.code)).toEqual(["administration"]);
        expect(getMenuLabels(administrationWorkspace.menuItems)).toEqual(["Catálogos"]);
        expect(catalogsMenu?.children?.map((option) => option.label)).toEqual(["Proyectos", "Campañas", "Clases", "Corredores", "Expedientes", "Subsidiarias", "Ubicaciones"]);
    });

    it("oculta catalogos administrativos cuando falta el modulo administration aunque exista permiso operativo", () => {
        const visibleWorkspaces = getVisibleNavigationWorkspaces([allow("mercadeo.catalog_project.read")], orgUnits("mercadeo"));
        const marketingWorkspace = getWorkspace(visibleWorkspaces, "marketing");

        expect(visibleWorkspaces.map((workspace) => workspace.code)).toEqual(["marketing"]);
        expect(visibleWorkspaces.some((workspace) => workspace.code === "administration")).toBe(false);
        expect(getMenuLabels(marketingWorkspace.menuItems)).toEqual(["Catálogos"]);
    });

    it("aplica deny directo solo al contexto scoped indicado", () => {
        const visibleWorkspaces = getVisibleNavigationWorkspaces([allow("mercadeo.catalog_project.read"), allow("formalizacion.catalog_project.read"), deny("formalizacion.catalog_project.read")], orgUnits("mercadeo", "formalizacion"));

        expect(visibleWorkspaces.map((workspace) => workspace.code)).toEqual(["marketing"]);
    });

    it("muestra roles y auditoria de Administracion cuando existe permiso de seguridad", () => {
        const visibleWorkspaces = getVisibleNavigationWorkspaces([allow("role.assign")]);
        const administrationWorkspace = getWorkspace(visibleWorkspaces, "administration");

        expect(visibleWorkspaces.map((workspace) => workspace.code)).toEqual(["administration"]);
        expect(getMenuLabels(administrationWorkspace.menuItems)).toEqual(["Roles y seguridad", "Auditoría"]);
    });

    it("muestra solo los modulos operativos con permisos accionables efectivos", () => {
        const visibleWorkspaces = getVisibleNavigationWorkspaces([allow("lead.read"), allow("campaign.read")]);
        const salesWorkspace = getWorkspace(visibleWorkspaces, "sales");
        const marketingWorkspace = getWorkspace(visibleWorkspaces, "marketing");

        expect(visibleWorkspaces.map((workspace) => workspace.code)).toEqual(["all", "sales", "marketing"]);
        expect(getMenuLabels(salesWorkspace.menuItems)).toEqual(["Resumen", "Leads"]);
        expect(getMenuLabels(marketingWorkspace.menuItems)).toEqual(["Resumen", "Campañas"]);
    });

    it("aplica deny por encima de allow en permisos directos y de rol", () => {
        const visibleWorkspaces = getVisibleNavigationWorkspaces([allow("user.view_list"), deny("user.view_list")]);

        expect(visibleWorkspaces).toEqual([]);
    });

    it("oculta Administracion cuando faltan permisos de usuario", () => {
        const visibleWorkspaces = getVisibleNavigationWorkspaces([allow("user.create")]);

        expect(visibleWorkspaces).toEqual([]);
    });

    it("no expone perfiles cuando no hay permisos efectivos", () => {
        expect(getVisibleNavigationWorkspaces([])).toEqual([]);
    });
});
