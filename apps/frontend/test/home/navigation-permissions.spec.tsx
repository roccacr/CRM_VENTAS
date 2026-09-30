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

const getChildLabels = (workspace: WorkspaceProfile, label: string): readonly string[] => {
    const item = workspace.menuItems.find((menuItem) => menuItem.label === label);

    expect(item).toBeDefined();

    return item?.children?.map((child) => child.label) ?? [];
};

describe("navigation permissions", () => {
    it("mantiene el catalogo visual alineado con el seed de permisos del API", () => {
        const seedPath = resolve(process.cwd(), "../api/Arquitectura/SQL/002_identity_seed_p0_s1.sql");
        const seedSql = readFileSync(seedPath, "utf8");
        const seedPermissionCodes = new Set(Array.from(seedSql.matchAll(/'([a-z][a-z0-9_.]*\.read)'/giu), (match) => match[1]));
        const visualPermissionCodes = DEMO_EFFECTIVE_NAVIGATION_PERMISSIONS.map((permission) => permission.code);

        expect(visualPermissionCodes.filter((permissionCode) => !seedPermissionCodes.has(permissionCode))).toEqual([]);
    });

    it("mantiene el modulo Mercadeo pero oculta Origenes de Leads cuando falta ese permiso", () => {
        const visibleWorkspaces = getVisibleNavigationWorkspaces([allow("marketing.dashboard.read"), allow("marketing.campaigns.read"), allow("marketing.incoming_leads.read"), allow("marketing.content.read"), allow("marketing.metrics.read")]);
        const marketingWorkspace = getWorkspace(visibleWorkspaces, "marketing");
        const allWorkspace = getWorkspace(visibleWorkspaces, "all");

        expect(getMenuLabels(marketingWorkspace.menuItems)).toContain("Campañas");
        expect(getMenuLabels(marketingWorkspace.menuItems)).not.toContain("Orígenes de Leads");
        expect(getChildLabels(allWorkspace, "Mercadeo")).toContain("Campañas");
        expect(getChildLabels(allWorkspace, "Mercadeo")).not.toContain("Orígenes de Leads");
    });

    it("aplica deny por encima de allow en permisos directos y de rol", () => {
        const visibleWorkspaces = getVisibleNavigationWorkspaces([allow("marketing.dashboard.read"), allow("marketing.campaigns.read"), allow("marketing.sources.read"), deny("marketing.sources.read")]);
        const marketingWorkspace = getWorkspace(visibleWorkspaces, "marketing");

        expect(getMenuLabels(marketingWorkspace.menuItems)).toContain("Campañas");
        expect(getMenuLabels(marketingWorkspace.menuItems)).not.toContain("Orígenes de Leads");
    });

    it("muestra Todos y el unico perfil permitido cuando solo existe un frente asignado", () => {
        const visibleWorkspaces = getVisibleNavigationWorkspaces([allow("finance.collections.read")]);
        const financeWorkspace = getWorkspace(visibleWorkspaces, "finance");

        expect(visibleWorkspaces.map((workspace) => workspace.code)).toEqual(["all", "finance"]);
        expect(getChildLabels(getWorkspace(visibleWorkspaces, "all"), "Finanzas")).toEqual(["Cobros Pendientes"]);
        expect(getMenuLabels(financeWorkspace.menuItems)).toEqual(["Cobros Pendientes"]);
    });

    it("no expone perfiles cuando no hay permisos efectivos", () => {
        expect(getVisibleNavigationWorkspaces([])).toEqual([]);
    });
});
