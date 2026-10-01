import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { DEMO_EFFECTIVE_NAVIGATION_PERMISSIONS, type EffectiveNavigationPermission, getVisibleNavigationWorkspaces, type GlobalMenuItem, type WorkspaceProfile } from "../../src/modules/home/GlobalHomeShell";

const allow = (code: string): EffectiveNavigationPermission => ({ code, effect: "allow" });
const deny = (code: string): EffectiveNavigationPermission => ({ code, effect: "deny" });

const getWorkspace = (workspaces: readonly WorkspaceProfile[], code: string): WorkspaceProfile => {
    const workspace = workspaces.find((item) => item.code === code);

    expect(workspace).toBeDefined();

    return workspace as WorkspaceProfile;
};

const getMenuLabels = (items: readonly GlobalMenuItem[]): readonly string[] => items.map((item) => item.label);

describe("navigation permissions", () => {
    it("mantiene el catalogo visual alineado con el seed de permisos del API", () => {
        const seedPath = resolve(process.cwd(), "../api/Arquitectura/SQL/002_identity_seed_p0_s1.sql");
        const seedSql = readFileSync(seedPath, "utf8");
        const seedPermissionCodes = new Set(Array.from(seedSql.matchAll(/\('([a-z][a-z0-9_.]*)',\s*'[a-z][a-z0-9_]*'/giu), (match) => match[1]));
        const visualPermissionCodes = DEMO_EFFECTIVE_NAVIGATION_PERMISSIONS.map((permission) => permission.code);

        expect(visualPermissionCodes.filter((permissionCode) => !seedPermissionCodes.has(permissionCode))).toEqual([]);
    });

    it("muestra solo usuarios de Administracion cuando existe permiso de lista de usuarios", () => {
        const visibleWorkspaces = getVisibleNavigationWorkspaces([allow("user.view_list")]);
        const administrationWorkspace = getWorkspace(visibleWorkspaces, "administration");

        expect(visibleWorkspaces.map((workspace) => workspace.code)).toEqual(["administration"]);
        expect(getMenuLabels(administrationWorkspace.menuItems)).toEqual(["Usuarios"]);
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
