import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DEMO_EFFECTIVE_NAVIGATION_PERMISSIONS, type EffectiveNavigationPermission, getVisibleNavigationWorkspaces, type GlobalMenuItem, type WorkspaceProfile } from "../../src/modules/home/GlobalHomeShell";

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

describe("navigation permissions", () => {
    it("mantiene el catalogo visual alineado con el seed de permisos del API", () => {
        const seedPath = resolve(process.cwd(), "../api/Arquitectura/SQL/002_identity_seed_p0_s1.sql");
        const catalogsMigrationPath = resolve(process.cwd(), "../api/migrations/schema-only/202610030007_crm_catalogs.ts");
        const seedSql = readFileSync(seedPath, "utf8");
        const catalogsMigrationSource = readFileSync(catalogsMigrationPath, "utf8");
        const seedPermissionCodes = new Set([
            ...Array.from(seedSql.matchAll(/\('([a-z][a-z0-9_.]*)',\s*'[a-z][a-z0-9_]*'/giu), (match) => match[1]),
            ...Array.from(catalogsMigrationSource.matchAll(/"([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)"/giu), (match) => match[1]),
            ...CATALOG_CONTEXT_CODES.flatMap((contextCode) => CATALOG_MODULE_CODES.map((moduleCode) => `${contextCode}.${moduleCode}.read`)),
        ]);
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
