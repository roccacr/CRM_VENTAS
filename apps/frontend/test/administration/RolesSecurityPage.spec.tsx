import "@testing-library/jest-dom/vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RolePermissionSection } from "../../src/modules/administration/pages/RolePermissionSection";
import { buildDisplayModules } from "../../src/modules/administration/pages/roles-security-sections";
import { RolesSecurityPage } from "../../src/modules/administration/pages/RolesSecurityPage";
import { getIdentityProfile, getIdentitySecurityCatalog, getIdentityUserAccess, getSystemUsers, replaceIdentityRolePermissions, replaceIdentityUserAccess, updateIdentityRole } from "../../src/services/auth/auth-service";
import type { IdentityProfile, IdentitySecurityCatalog, SystemUserDirectoryItem } from "../../src/services/auth/identity-contracts";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/auth/auth-service", () => ({
    getIdentityProfile: vi.fn(),
    getIdentitySecurityCatalog: vi.fn(),
    getIdentityUserAccess: vi.fn(),
    getSystemUsers: vi.fn(),
    replaceIdentityRolePermissions: vi.fn(),
    replaceIdentityUserAccess: vi.fn(),
    updateIdentityRole: vi.fn(),
}));

const mockGetIdentitySecurityCatalog = vi.mocked(getIdentitySecurityCatalog);
const mockGetSystemUsers = vi.mocked(getSystemUsers);
const allowedProfile = {
    permissions: [
        { code: "role.assign", effect: "allow" },
        { code: "user.view_list", effect: "allow" },
    ],
} as unknown as IdentityProfile;

it("uses scoped enterprise tokens, compact hierarchy and accessible focus", () => {
    const css = readFileSync(resolve(process.cwd(), "src/modules/administration/pages/RolesSecurityPage.css"), "utf8");
    expect(css).toContain("--color-neutral-50: #f5f7fa");
    expect(css).toContain("--color-neutral-950: #0e1116");
    expect(css).toContain("font-size: 22px");
    expect(css).toContain("outline: 2px solid var(--color-neutral-600)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    const pageLayout = css.match(/\.roles-security-page\s*\{([^}]+)\}/)?.[1];
    expect(pageLayout).toContain("width: 100%");
    expect(pageLayout).not.toContain("max-width:");
});

it("marks state with Bunker switches and warning pills instead of black bars", () => {
    const css = readFileSync(resolve(process.cwd(), "src/modules/administration/pages/RolesSecurityPage.css"), "utf8");
    const checkedSwitch = css.match(/\.roles-security-page \.ant-switch\.ant-switch-checked\s*\{([^}]+)\}/)?.[1];
    const sensitiveLevel = css.match(/\.roles-security-level--sensitive\s*\{([^}]+)\}/)?.[1];

    expect(checkedSwitch).toContain("background: var(--color-primary)");
    expect(sensitiveLevel).toContain("background: var(--color-warning-light)");
    expect(css).not.toContain("inset 3px 0 0");
    expect(css).not.toContain("border-left: 3px");
});

const mockSecurityCatalog = {
    auditEvents: [],
    modules: [
        {
            code: "ventas",
            name: "Ventas",
            views: [
                {
                    code: "lead",
                    name: "Leads",
                    permissions: [
                        { code: "lead.read", description: "Permite ver leads.", name: "Ver leads", sensitive: false },
                        { code: "lead.create", description: "Permite crear leads.", name: "Crear lead", sensitive: false },
                        { code: "lead.delete", description: "Permite eliminar leads.", name: "Eliminar lead", sensitive: true },
                    ],
                },
                {
                    code: "catalog_project",
                    name: "Proyectos",
                    permissions: [
                        { code: "ventas.catalog_project.read", description: "Ver proyectos.", name: "Ver proyectos", sensitive: false },
                        { code: "ventas.catalog_project.create", description: "Crear proyecto.", name: "Crear proyecto", sensitive: false },
                    ],
                },
            ],
        },
    ],
    rolePermissions: {
        owner: ["lead.read", "lead.create", "lead.delete", "ventas.catalog_project.read", "ventas.catalog_project.create"],
        ventas: ["lead.read", "ventas.catalog_project.read"],
    },
    roles: [
        { code: "owner", description: null, locked: true, name: "Owner", status: "active", users: 1 },
        { code: "ventas", description: null, locked: false, name: "Ventas", status: "active", users: 1 },
    ],
} as const;

const getPermissionSwitch = (name: string) => screen.getByRole("switch", { name });

const marketingModule = {
    code: "mercadeo",
    name: "Mercadeo",
    views: [
        ...[
            { code: "home", name: "Inicio" },
            { code: "leads", name: "Captación de leads" },
            { code: "calendar", name: "Calendario" },
        ].map(({ code, name }) => ({ code, name, permissions: [{ code: `mercadeo.${code}.read`, name: `Ver ${name}`, description: name, sensitive: false }] })),
        { code: "campaign", name: "Campanas", permissions: [{ code: "campaign.read", name: "Ver campanas", description: "Historico", sensitive: false }] },
        { code: "source", name: "Fuentes", permissions: [{ code: "source.update", name: "Editar fuentes", description: "Historico", sensitive: false }] },
        ...[
            { code: "project", name: "Proyectos" },
            { code: "campaign", name: "Campañas" },
            { code: "class", name: "Clases" },
            { code: "broker", name: "Corredores" },
            { code: "file", name: "Expedientes" },
            { code: "subsidiary", name: "Subsidiarias" },
            { code: "location", name: "Ubicaciones" },
        ].map(({ code, name }) => ({ code: `catalog_${code}`, name, permissions: [{ code: `mercadeo.catalog_${code}.read`, name: `Ver ${name}`, description: name, sensitive: false }] })),
    ],
};
const marketingCatalog: IdentitySecurityCatalog = {
    ...mockSecurityCatalog,
    modules: [...mockSecurityCatalog.modules, marketingModule],
    roles: [...mockSecurityCatalog.roles, { code: "mercadeo", name: "Mercadeo", description: null, locked: false, status: "active", users: 0 }, { code: "jefe_mercadeo", name: "Jefe de Mercadeo", description: null, locked: false, status: "active", users: 0 }],
    rolePermissions: { ...mockSecurityCatalog.rolePermissions, mercadeo: marketingModule.views.flatMap((view) => view.permissions.map(({ code }) => code)), jefe_mercadeo: marketingModule.views.flatMap((view) => view.permissions.map(({ code }) => code)) },
};

const chooseOption = async (combobox: string, option: string, selector: string) => {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: combobox }));
    fireEvent.click(await screen.findByText(option, { selector }));
};

describe("RolesSecurityPage", () => {
    it("preserves another role's unsaved draft and persisted employee preview when saving General", async () => {
        vi.mocked(getIdentityProfile).mockResolvedValue({ ...allowedProfile, roles: [{ code: "owner", name: "Owner", status: "active" }] });
        const general = { code: "jefe_general", name: "Jefe General", description: null, status: "active", locked: false, users: 1, moduleCodes: ["ventas"], moduleScoped: true, permissionInheritance: "selected_modules" as const };
        mockGetIdentitySecurityCatalog.mockResolvedValue({ ...mockSecurityCatalog, roles: [...mockSecurityCatalog.roles, general], rolePermissions: { ...mockSecurityCatalog.rolePermissions, jefe_general: ["lead.read"] } });
        vi.mocked(replaceIdentityRolePermissions).mockResolvedValue({ role: general, permissionCodes: ["lead.read", "lead.create"] });
        const employee = { publicId: "sales", name: "Sales employee", email: "sales@example.invalid", status: "active", roles: [{ code: "ventas", name: "Ventas" }] } as unknown as SystemUserDirectoryItem;
        mockGetSystemUsers.mockResolvedValue({ items: [employee], page: { limit: 100, nextCursor: null, total: 1 }, summary: { active: 1, all: 1, blocked: 0, inactive: 0, pending: 0 } });
        vi.mocked(getIdentityUserAccess).mockResolvedValue({ user: { publicId: employee.publicId, name: employee.name, email: employee.email, status: "active" }, roles: [{ code: "ventas", name: "Ventas", status: "active" }], orgUnits: [{ code: "ventas", name: "Ventas", publicId: "ventas" }], permissionOverrides: [] });
        render(<RolesSecurityPage />);
        await screen.findByText("3 roles");
        await chooseOption("Rol", "Ventas (1 usuario)", ".ant-select-item-option-content");
        fireEvent.click(getPermissionSwitch("Crear lead"));
        await chooseOption("Rol", "Jefe General (1 usuario)", ".ant-select-item-option-content");
        fireEvent.click(getPermissionSwitch("Crear lead"));
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios 1" }));
        fireEvent.change(screen.getByLabelText("Motivo de auditoría *"), { target: { value: "Cambio autorizado" } });
        fireEvent.click(screen.getByRole("button", { name: /Guardar permisos$/ }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Guardar cambios 0" })).toBeDisabled());
        fireEvent.click(screen.getByText("Por empleado"));
        await waitFor(() => expect(screen.getByRole("combobox", { name: "Empleado" })).toBeEnabled());
        await chooseOption("Empleado", "Sales employee (Ventas)", ".ant-select-item-option-content");
        await waitFor(() => expect(getPermissionSwitch("Crear lead")).toBeEnabled());
        expect(getPermissionSwitch("Crear lead")).not.toBeChecked();
        fireEvent.click(screen.getByText("Por rol", { selector: ".ant-segmented-item-label" }));
        await chooseOption("Rol", "Ventas (1 usuario)", ".ant-select-item-option-content");
        expect(getPermissionSwitch("Crear lead")).toBeChecked();
        expect(screen.getByRole("button", { name: "Guardar cambios 1" })).toBeEnabled();
    });
    it("uses persisted General modules and grants when switching to employee preview with an unsaved draft", async () => {
        vi.mocked(getIdentityProfile).mockResolvedValue({ ...allowedProfile, roles: [{ code: "owner", name: "Owner", status: "active" }] });
        const general = { code: "jefe_general", name: "Jefe General", description: null, status: "active", locked: false, users: 1, moduleCodes: ["ventas"], moduleScoped: true, permissionInheritance: "selected_modules" as const };
        mockGetIdentitySecurityCatalog.mockResolvedValue({ ...mockSecurityCatalog, roles: [...mockSecurityCatalog.roles, general], rolePermissions: { ...mockSecurityCatalog.rolePermissions, jefe_general: ["lead.read"] } });
        const employee = { publicId: "general", name: "Jefe real", email: "chief@example.invalid", status: "active", roles: [{ code: general.code, name: general.name }] } as unknown as SystemUserDirectoryItem;
        mockGetSystemUsers.mockResolvedValue({ items: [employee], page: { limit: 100, nextCursor: null, total: 1 }, summary: { active: 1, all: 1, blocked: 0, inactive: 0, pending: 0 } });
        vi.mocked(getIdentityUserAccess).mockResolvedValue({ user: { publicId: employee.publicId, name: employee.name, email: employee.email, status: "active" }, roles: [{ code: general.code, name: general.name, status: "active" }], orgUnits: [{ code: "ventas", name: "Ventas", publicId: "ventas" }], permissionOverrides: [] });
        render(<RolesSecurityPage />);
        await screen.findByText("3 roles");
        await chooseOption("Rol", "Jefe General (1 usuario)", ".ant-select-item-option-content");
        fireEvent.click(getPermissionSwitch("Crear lead"));
        fireEvent.click(screen.getByRole("switch", { name: "Módulo Ventas habilitado en plantilla" }));
        fireEvent.click(screen.getByText("Por empleado"));
        await waitFor(() => {
            expect(getSystemUsers).toHaveBeenCalled();
        });
        await waitFor(() => {
            expect(screen.getByRole("combobox", { name: "Empleado" })).toBeEnabled();
        });
        await chooseOption("Empleado", "Jefe real (Jefe General)", ".ant-select-item-option-content");
        await waitFor(() => {
            expect(getPermissionSwitch("Ver leads")).toBeEnabled();
        });
        expect(getPermissionSwitch("Ver leads")).toBeChecked();
        expect(getPermissionSwitch("Crear lead")).not.toBeChecked();
        expect(replaceIdentityRolePermissions).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText("Por rol", { selector: ".ant-segmented-item-label" }));
        expect(screen.getByRole("switch", { name: "Módulo Ventas habilitado en plantilla" })).not.toBeChecked();
        fireEvent.click(screen.getByRole("switch", { name: "Módulo Ventas habilitado en plantilla" }));
        expect(getPermissionSwitch("Crear lead")).toBeChecked();
    });
    it("lets only active Owner edit General's operational template and saves modules and grants atomically", async () => {
        vi.mocked(getIdentityProfile).mockResolvedValue({ ...allowedProfile, roles: [{ code: "owner", name: "Owner", status: "active" }] });
        const general = { code: "jefe_general", name: "Jefe General", description: null, status: "active", locked: true, users: 1, moduleCodes: ["ventas"], moduleScoped: true, permissionInheritance: "selected_modules" as const };
        mockGetIdentitySecurityCatalog.mockResolvedValue({ ...mockSecurityCatalog, roles: [...mockSecurityCatalog.roles, general], rolePermissions: { ...mockSecurityCatalog.rolePermissions, jefe_general: ["lead.read"] } });
        vi.mocked(replaceIdentityRolePermissions).mockResolvedValue({ role: { ...general, moduleCodes: [] }, permissionCodes: [] });
        render(<RolesSecurityPage />);
        await screen.findByText("3 roles");
        await chooseOption("Rol", "Jefe General (1 usuario)", ".ant-select-item-option-content");
        expect(getPermissionSwitch("Crear lead")).toBeEnabled();
        expect(getPermissionSwitch("Ver leads")).toBeChecked();
        const moduleControl = screen.getByRole("switch", { name: "Módulo Ventas habilitado en plantilla" });
        fireEvent.click(moduleControl);
        expect(getPermissionSwitch("Ver leads")).not.toBeChecked();
        expect(getPermissionSwitch("Ver leads")).toBeDisabled();
        fireEvent.click(moduleControl);
        expect(getPermissionSwitch("Ver leads")).toBeChecked();
        fireEvent.click(moduleControl);
        fireEvent.click(screen.getByRole("button", { name: /Guardar cambios [1-9]/ }));
        fireEvent.change(screen.getByLabelText("Motivo de auditoría *"), { target: { value: "Cambio autorizado" } });
        fireEvent.click(screen.getByRole("button", { name: /Guardar permisos$/ }));
        await waitFor(() => {
            expect(replaceIdentityRolePermissions).toHaveBeenCalledExactlyOnceWith("jefe_general", { moduleCodes: [], permissionCodes: [], reason: "Cambio autorizado" });
        });
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "Guardar cambios 0" })).toBeDisabled();
        });
        fireEvent.click(screen.getByRole("switch", { name: "Módulo Ventas habilitado en plantilla" }));
        expect(getPermissionSwitch("Ver leads")).not.toBeChecked();
        expect(replaceIdentityUserAccess).not.toHaveBeenCalled();
    });

    it.each([{ actorRoles: [] }, { actorRoles: [{ code: "owner", name: "Owner", status: "inactive" }] }])("keeps General read-only without active Owner: %j", async ({ actorRoles }) => {
        vi.mocked(getIdentityProfile).mockResolvedValue({ ...allowedProfile, roles: actorRoles });
        const general = { code: "jefe_general", name: "Jefe General", description: null, status: "active", locked: false, users: 1, moduleCodes: ["ventas"], permissionInheritance: "selected_modules" as const };
        mockGetIdentitySecurityCatalog.mockResolvedValue({ ...mockSecurityCatalog, roles: [...mockSecurityCatalog.roles, general], rolePermissions: { ...mockSecurityCatalog.rolePermissions, jefe_general: ["lead.read"] } });
        render(<RolesSecurityPage />);
        await screen.findByText("3 roles");
        await chooseOption("Rol", "Jefe General (1 usuario)", ".ant-select-item-option-content");
        expect(getPermissionSwitch("Crear lead")).toBeDisabled();
        expect(replaceIdentityRolePermissions).not.toHaveBeenCalled();
    });

    it("revalidates active Owner before saving the General template", async () => {
        vi.mocked(getIdentityProfile).mockResolvedValue({ ...allowedProfile, roles: [{ code: "owner", name: "Owner", status: "active" }] });
        const general = { code: "jefe_general", name: "Jefe General", description: null, status: "active", locked: false, users: 1, moduleCodes: ["ventas"], permissionInheritance: "selected_modules" as const };
        mockGetIdentitySecurityCatalog.mockResolvedValue({ ...mockSecurityCatalog, roles: [...mockSecurityCatalog.roles, general], rolePermissions: { ...mockSecurityCatalog.rolePermissions, jefe_general: ["lead.read"] } });
        render(<RolesSecurityPage />);
        await screen.findByText("3 roles");
        await chooseOption("Rol", "Jefe General (1 usuario)", ".ant-select-item-option-content");
        fireEvent.click(getPermissionSwitch("Crear lead"));
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios 1" }));
        fireEvent.change(screen.getByLabelText("Motivo de auditoría *"), { target: { value: "Cambio autorizado" } });
        vi.mocked(getIdentityProfile).mockResolvedValue({ ...allowedProfile, roles: [] });
        fireEvent.click(screen.getByRole("button", { name: /Guardar permisos$/ }));
        await waitFor(() => {
            expect(getPermissionSwitch("Crear lead")).toBeDisabled();
        });
        expect(replaceIdentityRolePermissions).not.toHaveBeenCalled();
    });
    it("does not borrow General's module ceiling for a different role's grant", async () => {
        const general = { code: "jefe_general", name: "Jefe General", description: null, status: "active", locked: true, users: 1, moduleCodes: ["ventas", "mercadeo"], permissionInheritance: "selected_modules" as const };
        const marketing = { code: "jefe_mercadeo", name: "Jefe Mercadeo", description: null, status: "active", locked: false, users: 1, moduleCodes: ["mercadeo"], permissionInheritance: "assigned" as const };
        mockGetIdentitySecurityCatalog.mockResolvedValue({ ...mockSecurityCatalog, roles: [...mockSecurityCatalog.roles, general, marketing], rolePermissions: { ...mockSecurityCatalog.rolePermissions, jefe_general: [], jefe_mercadeo: ["lead.create"] } });
        const employee = {
            publicId: "chief",
            name: "Jefe real",
            email: "chief@example.invalid",
            status: "active",
            roles: [
                { code: general.code, name: general.name },
                { code: marketing.code, name: marketing.name },
            ],
        } as unknown as SystemUserDirectoryItem;
        mockGetSystemUsers.mockResolvedValue({ items: [employee], page: { limit: 100, nextCursor: null, total: 1 }, summary: { active: 1, all: 1, blocked: 0, inactive: 0, pending: 0 } });
        vi.mocked(getIdentityUserAccess).mockResolvedValue({ user: { publicId: employee.publicId, name: employee.name, email: employee.email, status: "active" }, roles: employee.roles.map((role) => ({ ...role, status: "active" })), orgUnits: [{ code: "ventas", name: "Ventas", publicId: "ventas" }], permissionOverrides: [] });
        render(<RolesSecurityPage />);
        await screen.findByText("4 roles");
        fireEvent.click(screen.getByText("Por empleado"));
        await chooseOption("Empleado", "Jefe real (Jefe General, Jefe Mercadeo)", ".ant-select-item-option-content");
        await waitFor(() => {
            expect(getPermissionSwitch("Crear lead")).toBeEnabled();
        });
        expect(getPermissionSwitch("Crear lead")).not.toBeChecked();
    });
    it.each(["jefe_mercadeo", "jefe_formalizaciones"])("does not preview an out-of-module direct allow for %s", async (code) => {
        const moduleCode = code === "jefe_mercadeo" ? "mercadeo" : "formalizacion";
        const chief = { code, name: code, description: null, status: "active", locked: false, users: 1, moduleCodes: [moduleCode], permissionInheritance: "assigned" as const };
        mockGetIdentitySecurityCatalog.mockResolvedValue({ ...mockSecurityCatalog, roles: [...mockSecurityCatalog.roles, chief], rolePermissions: { ...mockSecurityCatalog.rolePermissions, [code]: ["lead.read"] } });
        const employee = { publicId: "chief", name: "Jefe real", email: "chief@example.invalid", status: "active", roles: [{ code, name: code }] } as unknown as SystemUserDirectoryItem;
        mockGetSystemUsers.mockResolvedValue({ items: [employee], page: { limit: 100, nextCursor: null, total: 1 }, summary: { active: 1, all: 1, blocked: 0, inactive: 0, pending: 0 } });
        vi.mocked(getIdentityUserAccess).mockResolvedValue({ user: { publicId: employee.publicId, name: employee.name, email: employee.email, status: "active" }, roles: [{ code, name: code, status: "active" }], orgUnits: [{ code: "ventas", name: "Ventas", publicId: "ventas" }], permissionOverrides: [{ code: "lead.create", effect: "allow" }] });
        render(<RolesSecurityPage />);
        await screen.findByText("3 roles");
        fireEvent.click(screen.getByText("Por empleado"));
        await chooseOption("Empleado", `Jefe real (${code})`, ".ant-select-item-option-content");
        await screen.findAllByText("Módulo no asignado");
        expect(getPermissionSwitch("Crear lead")).not.toBeChecked();
        expect(getPermissionSwitch("Crear lead")).toBeDisabled();
        expect(getPermissionSwitch("Ver leads")).not.toBeChecked();
    });
    it("muestra solo las cuatro secciones aprobadas de Mercadeo y conserva el catalogo original", () => {
        const sections = buildDisplayModules([marketingModule])[0]?.sections ?? [];
        expect(sections.map(({ name }) => name)).toEqual(["Inicio", "Captación de leads", "Calendario", "Catálogos"]);
        expect(sections[3]?.views.map(({ name }) => name)).toEqual(["Proyectos", "Campañas", "Clases", "Corredores", "Expedientes", "Subsidiarias", "Ubicaciones"]);
        expect(marketingModule.views.some(({ code }) => code === "campaign")).toBe(true);
        expect(marketingModule.views.some(({ code }) => code === "source")).toBe(true);
    });

    it.each(["Mercadeo", "Jefe de Mercadeo"])("abre Mercadeo/Inicio al seleccionar %s y conserva el guardado de permisos historicos", async (roleName) => {
        mockGetIdentitySecurityCatalog.mockResolvedValue(marketingCatalog);
        const roleCode = roleName === "Mercadeo" ? "mercadeo" : "jefe_mercadeo";
        vi.mocked(replaceIdentityRolePermissions).mockResolvedValue({ role: { code: roleCode, name: roleName, description: null, status: "active" }, permissionCodes: marketingCatalog.rolePermissions[roleCode]?.filter((code) => code !== "mercadeo.home.read") ?? [] });
        render(<RolesSecurityPage />);
        await screen.findByText("4 roles");
        expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Ventas/Leads");
        await chooseOption("Rol", `${roleName} (0 usuarios)`, ".ant-select-item-option-content");
        expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Mercadeo/Inicio");
        await chooseOption("Sección", "Catálogos", ".roles-security-option > span");
        expect(screen.getByText("Campañas", { selector: ".roles-security-catalog-tab span" })).toBeInTheDocument();
        await chooseOption("Sección", "Inicio", ".roles-security-option > span");
        fireEvent.click(getPermissionSwitch("Ver Inicio"));
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios 1" }));
        fireEvent.change(screen.getByLabelText("Motivo de auditoría *"), { target: { value: "Ajuste de prueba" } });
        fireEvent.click(screen.getByRole("button", { name: /Guardar permisos$/ }));
        await waitFor(() => {
            expect(replaceIdentityRolePermissions).toHaveBeenCalled();
        });
        const submitted = vi.mocked(replaceIdentityRolePermissions).mock.calls[0]?.[1].permissionCodes ?? [];
        expect(submitted).toContain("campaign.read");
        expect(submitted).toContain("source.update");
        expect(submitted).not.toContain("mercadeo.home.read");
        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });

    it("restricts general-chief preview to selected modules and preserves explicit denies on module changes", async () => {
        const general = { code: "jefe_general", name: "Jefe General", description: null, status: "active", locked: true, users: 1, moduleCodes: ["ventas", "mercadeo"], permissionInheritance: "selected_modules" as const };
        const marketing = { code: "mercadeo", name: "Mercadeo", views: [{ code: "home", name: "Inicio", permissions: [{ code: "mercadeo.home.read", name: "Ver Inicio Mercadeo", description: "Lectura", sensitive: false }] }] };
        mockGetIdentitySecurityCatalog.mockResolvedValue({ ...mockSecurityCatalog, roles: [...mockSecurityCatalog.roles, general], modules: [...mockSecurityCatalog.modules, marketing], rolePermissions: { ...mockSecurityCatalog.rolePermissions, jefe_general: ["lead.read", "lead.create", "mercadeo.home.read"] } });
        const employee = { publicId: "general", name: "Jefe real", email: "chief@example.invalid", status: "active", roles: [{ code: general.code, name: general.name }] } as unknown as SystemUserDirectoryItem;
        mockGetSystemUsers.mockResolvedValue({ items: [employee], page: { limit: 100, nextCursor: null, total: 1 }, summary: { active: 1, all: 1, blocked: 0, inactive: 0, pending: 0 } });
        vi.mocked(getIdentityUserAccess).mockResolvedValue({
            user: { publicId: employee.publicId, name: employee.name, email: employee.email, status: "active" },
            roles: [{ code: general.code, name: general.name, status: "active" }],
            orgUnits: [],
            permissionOverrides: [
                { code: "lead.create", effect: "allow" },
                { code: "lead.read", effect: "deny" },
            ],
        });
        render(<RolesSecurityPage />);
        await screen.findByText("3 roles");
        fireEvent.click(screen.getByText("Por empleado"));
        await chooseOption("Empleado", "Jefe real (Jefe General)", ".ant-select-item-option-content");
        await waitFor(() => {
            expect(getPermissionSwitch("Crear lead")).not.toBeChecked();
        });
        expect(getPermissionSwitch("Crear lead")).toBeDisabled();
        fireEvent.click(screen.getByRole("switch", { name: "Módulo Ventas asignado" }));
        expect(getPermissionSwitch("Crear lead")).toBeChecked();
        expect(getPermissionSwitch("Ver leads")).not.toBeChecked();
        expect(getPermissionSwitch("Crear lead")).toBeEnabled();
        fireEvent.click(screen.getByRole("switch", { name: "Módulo Ventas asignado" }));
        expect(getPermissionSwitch("Crear lead")).not.toBeChecked();
        fireEvent.click(screen.getByRole("switch", { name: "Módulo Ventas asignado" }));
        expect(getPermissionSwitch("Ver leads")).not.toBeChecked();
        await chooseOption("Módulo", "Mercadeo", ".roles-security-option > span");
        expect(getPermissionSwitch("Ver Inicio Mercadeo")).not.toBeChecked();
        fireEvent.click(screen.getByRole("switch", { name: "Módulo Mercadeo asignado" }));
        expect(getPermissionSwitch("Ver Inicio Mercadeo")).toBeChecked();
        expect(screen.getByRole("combobox", { name: "Roles asignados" }).closest(".ant-select")).toHaveTextContent("Jefe General");
        expect(replaceIdentityUserAccess).not.toHaveBeenCalled();
    });
    it("labels Home controls as banner visibility instead of denying access to the page", () => {
        installBrowserApiDoubles();
        const view = { key: "formalizacion:home", moduleCode: "formalizacion", code: "home", name: "Pantalla de inicio", permissions: [{ code: "formalizacion.home.approvals.read", name: "Ver pendientes de aprobacion de Formalizacion", description: "Solo visibilidad del banner" }] };
        render(<RolePermissionSection activeView={view} section={{ key: view.key, moduleCode: "formalizacion", name: view.name, isCatalog: false, views: [view] }} moduleName="Formalizacion" getGrantedCodes={() => new Set()} isBusy={false} isLocked={false} onSelectView={vi.fn()} onSetViewPermissions={vi.fn()} />);
        expect(screen.getByRole("switch", { name: "Visibilidad de banners" })).not.toBeChecked();
        expect(screen.queryByText("Sin acceso")).not.toBeInTheDocument();
        expect(screen.getByText("Banners ocultos")).toBeInTheDocument();
    });

    it.each([false, true])("renders Owner's API-wide base and editable stage exceptions; direct deny=%s", async (denied) => {
        const code = "formalizacion.home.stages.read";
        const name = "Ver resumen de etapas de Formalización";
        const permission = { code, name, description: "Visibilidad de los seis banners de etapas", sensitive: false };
        const modules = [...mockSecurityCatalog.modules, { code: "formalizacion", name: "Formalizacion", views: [{ code: "home", name: "Pantalla de inicio", permissions: [permission] }] }];
        const ownerCodes = modules.flatMap((module) => module.views.flatMap((view) => view.permissions.map((item) => item.code)));
        mockGetIdentitySecurityCatalog.mockResolvedValue({ ...mockSecurityCatalog, modules, rolePermissions: { ...mockSecurityCatalog.rolePermissions, owner: ownerCodes } });
        const employee = { publicId: "owner-employee", name: "Owner real", email: "owner@example.invalid", status: "active", roles: [{ code: "owner", name: "Owner" }] } as unknown as SystemUserDirectoryItem;
        mockGetSystemUsers.mockResolvedValue({ items: [employee], page: { limit: 100, nextCursor: null, total: 1 }, summary: { active: 1, all: 1, blocked: 0, inactive: 0, pending: 0 } });
        vi.mocked(getIdentityUserAccess).mockResolvedValue({ user: { publicId: employee.publicId, name: employee.name, email: employee.email, status: "active" }, roles: [{ code: "owner", name: "Owner", status: "active" }], orgUnits: [], permissionOverrides: denied ? [{ code, effect: "deny" }] : [] });
        render(<RolesSecurityPage />);
        await screen.findByText("2 roles");
        await chooseOption("Rol", "Owner (1 usuario)", ".ant-select-item-option-content");
        await chooseOption("Módulo", "Formalización", ".roles-security-option > span");
        expect(getPermissionSwitch(name)).toBeChecked();
        expect(getPermissionSwitch(name)).toBeDisabled();
        fireEvent.click(screen.getByText("Por empleado"));
        await chooseOption("Empleado", "Owner real (Owner)", ".ant-select-item-option-content");
        await waitFor(() => {
            expect(getPermissionSwitch(name)).toBeEnabled();
        });
        expect(getPermissionSwitch(name)).toHaveAttribute("aria-checked", String(!denied));
        const row = getPermissionSwitch(name).closest("tr");
        if (!row) throw new Error("Missing stage permission row");
        expect(within(row).getByText(denied ? "Excepción: denegado" : "Por rol")).toBeInTheDocument();
        expect(within(row).getByText("Lectura")).toBeInTheDocument();
        fireEvent.click(getPermissionSwitch(name));
        expect(getPermissionSwitch(name)).toHaveAttribute("aria-checked", String(denied));
        expect(within(row).getByText(denied ? "Por rol" : "Excepción: denegado")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Guardar cambios 1" })).toBeEnabled();
    });
    beforeEach(() => {
        installBrowserApiDoubles();
        vi.mocked(getIdentityProfile).mockResolvedValue(allowedProfile);
        mockGetIdentitySecurityCatalog.mockResolvedValue(mockSecurityCatalog);
        mockGetSystemUsers.mockResolvedValue({
            items: [],
            page: { limit: 100, nextCursor: null, total: 0 },
            summary: { active: 0, all: 0, blocked: 0, inactive: 0, pending: 0 },
        });
    });

    afterEach(() => {
        cleanup();
        vi.resetAllMocks();
    });

    it("explains a lost connection without claiming that a save definitely failed", async () => {
        mockGetIdentitySecurityCatalog.mockRejectedValueOnce(new TypeError("Failed to fetch"));
        render(<RolesSecurityPage />);
        expect(await screen.findByText("No pudimos conectar con el servidor. Si estabas guardando, el resultado no está confirmado; verifica los permisos antes de volver a intentar.")).toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "Rol" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Renombrar rol" })).not.toBeInTheDocument();
    });

    it("shows no demo roles or editing controls while the profile is unresolved", () => {
        vi.mocked(getIdentityProfile).mockReturnValueOnce(new Promise(() => {}));
        render(<RolesSecurityPage />);
        expect(screen.getByRole("status")).toHaveTextContent("Cargando");
        expect(screen.queryByRole("combobox", { name: "Rol" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Renombrar rol" })).not.toBeInTheDocument();
        expect(mockGetIdentitySecurityCatalog).not.toHaveBeenCalled();
    });

    it.each([false, true])("does not expose or fetch employees without a list grant (deny=%s)", async (deny) => {
        vi.mocked(getIdentityProfile).mockResolvedValueOnce({
            permissions: [
                { code: "role.assign", effect: "allow" },
                ...(deny
                    ? [
                          { code: "user.view_list", effect: "allow" },
                          { code: "user.view_list", effect: "deny" },
                      ]
                    : []),
            ],
        } as unknown as IdentityProfile);
        render(<RolesSecurityPage />);
        await screen.findByText("2 roles");
        expect(screen.queryByText("Por empleado")).not.toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "Empleado" })).not.toBeInTheDocument();
        expect(mockGetSystemUsers).not.toHaveBeenCalled();
    });

    it("does not fetch the employee directory in role mode and revalidates a revoked grant on focus", async () => {
        render(<RolesSecurityPage />);
        await screen.findByText("2 roles");
        expect(mockGetSystemUsers).not.toHaveBeenCalled();
        vi.mocked(getIdentityProfile).mockResolvedValueOnce({ permissions: [] } as unknown as IdentityProfile);
        fireEvent.focus(window);
        expect(await screen.findByRole("alert")).toHaveTextContent("Permiso insuficiente");
        expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    });

    it.each([
        { permissions: [], roles: [{ code: "owner", status: "active" }] },
        {
            permissions: [
                { code: "role.assign", effect: "allow" },
                { code: "role.assign", effect: "deny" },
            ],
        },
    ])("fails closed without an effective role.assign grant, including conflicting deny", async (profile) => {
        vi.mocked(getIdentityProfile).mockResolvedValueOnce(profile as unknown as IdentityProfile);
        render(<RolesSecurityPage />);
        expect(await screen.findByRole("alert")).toHaveTextContent("Permiso insuficiente");
        expect(screen.queryByRole("switch")).not.toBeInTheDocument();
        expect(mockGetIdentitySecurityCatalog).not.toHaveBeenCalled();
        expect(updateIdentityRole).not.toHaveBeenCalled();
    });

    it.each(["profile", "catalog"])("fails closed when %s loading fails", async (failure) => {
        if (failure === "profile") vi.mocked(getIdentityProfile).mockRejectedValueOnce(new Error("Profile unavailable"));
        else mockGetIdentitySecurityCatalog.mockRejectedValueOnce(new Error("Catalog unavailable"));
        render(<RolesSecurityPage />);
        expect(await screen.findByRole("alert")).toBeInTheDocument();
        expect(screen.queryByRole("switch")).not.toBeInTheDocument();
        expect(screen.queryByText("Jefe general")).not.toBeInTheDocument();
    });

    it.each(["roles", "modules"])("does not populate demo data when %s are empty", async (empty) => {
        mockGetIdentitySecurityCatalog.mockResolvedValueOnce({ ...mockSecurityCatalog, [empty]: [] });
        render(<RolesSecurityPage />);
        expect(await screen.findByText("Sin catálogo de roles y permisos disponible.")).toBeInTheDocument();
        expect(screen.queryByRole("switch")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Renombrar rol" })).not.toBeInTheDocument();
    });

    it.each([
        ["rename", "revoked"],
        ["save", "revoked"],
        ["rename", "deny"],
        ["save", "deny"],
        ["rename", "unavailable"],
        ["save", "unavailable"],
    ])("rechecks role.assign before %s and blocks a %s grant", async (action, failure) => {
        render(<RolesSecurityPage />);
        await screen.findByText("2 roles");
        if (action === "rename") {
            fireEvent.click(screen.getByRole("button", { name: "Renombrar rol" }));
            fireEvent.change(screen.getByLabelText("Nombre visible *"), { target: { value: "Ventas actualizado" } });
        } else {
            fireEvent.click(getPermissionSwitch("Crear lead"));
            fireEvent.click(screen.getByRole("button", { name: "Guardar cambios 1" }));
        }
        fireEvent.change(screen.getByLabelText("Motivo de auditoría *"), { target: { value: "Cambio autorizado" } });
        if (failure === "unavailable") vi.mocked(getIdentityProfile).mockRejectedValueOnce(new Error("Revalidación no disponible"));
        else
            vi.mocked(getIdentityProfile).mockResolvedValueOnce({
                permissions:
                    failure === "deny"
                        ? [
                              { code: "role.assign", effect: "allow" },
                              { code: "role.assign", effect: "deny" },
                          ]
                        : [],
            } as unknown as IdentityProfile);
        fireEvent.click(screen.getByRole("button", { name: action === "rename" ? /Guardar nombre$/ : /Guardar permisos$/ }));
        expect(await screen.findByRole("alert")).toHaveTextContent(failure === "unavailable" ? "Revalidación no disponible" : "Permiso insuficiente");
        expect(getIdentityProfile).toHaveBeenCalledTimes(2);
        expect(updateIdentityRole).not.toHaveBeenCalled();
        expect(replaceIdentityRolePermissions).not.toHaveBeenCalled();
        expect(replaceIdentityUserAccess).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it.each(["rename", "save"])("preserves authorized %s after a fresh effective grant", async (action) => {
        vi.mocked(updateIdentityRole).mockResolvedValue({ ...mockSecurityCatalog.roles[1], name: "Ventas actualizado" });
        vi.mocked(replaceIdentityRolePermissions).mockResolvedValue({ role: mockSecurityCatalog.roles[1], permissionCodes: ["lead.read", "lead.create"] });
        render(<RolesSecurityPage />);
        await screen.findByText("2 roles");
        if (action === "rename") {
            fireEvent.click(screen.getByRole("button", { name: "Renombrar rol" }));
            fireEvent.change(screen.getByLabelText("Nombre visible *"), { target: { value: "Ventas actualizado" } });
        } else {
            fireEvent.click(getPermissionSwitch("Crear lead"));
            fireEvent.click(screen.getByRole("button", { name: "Guardar cambios 1" }));
        }
        fireEvent.change(screen.getByLabelText("Motivo de auditoría *"), { target: { value: "Cambio autorizado" } });
        fireEvent.click(screen.getByRole("button", { name: action === "rename" ? /Guardar nombre$/ : /Guardar permisos$/ }));
        await waitFor(() => {
            expect(action === "rename" ? updateIdentityRole : replaceIdentityRolePermissions).toHaveBeenCalledTimes(1);
        });
        expect(getIdentityProfile).toHaveBeenCalledTimes(2);
        expect(replaceIdentityUserAccess).not.toHaveBeenCalled();
    });

    it("blocks employee access replacement after role.assign is revoked", async () => {
        const employee = { publicId: "employee", name: "Empleado real", email: "employee@example.invalid", status: "active", roles: [{ code: "ventas", name: "Ventas" }] } as unknown as SystemUserDirectoryItem;
        mockGetSystemUsers.mockResolvedValue({ items: [employee], page: { limit: 100, nextCursor: null, total: 1 }, summary: { active: 1, all: 1, blocked: 0, inactive: 0, pending: 0 } });
        vi.mocked(getIdentityUserAccess).mockResolvedValue({ user: { publicId: employee.publicId, name: employee.name, email: employee.email, status: "active" }, roles: [{ code: "ventas", name: "Ventas", status: "active" }], orgUnits: [{ publicId: "area", code: "ventas", name: "Ventas" }], permissionOverrides: [] });
        render(<RolesSecurityPage />);
        await screen.findByText("2 roles");
        fireEvent.click(screen.getByText("Por empleado"));
        await waitFor(() => {
            expect(mockGetSystemUsers).toHaveBeenCalled();
        });
        await chooseOption("Empleado", "Empleado real (Ventas)", ".ant-select-item-option-content");
        await waitFor(() => {
            expect(getPermissionSwitch("Crear lead")).toBeEnabled();
        });
        fireEvent.click(getPermissionSwitch("Crear lead"));
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios 1" }));
        fireEvent.change(screen.getByLabelText("Motivo de auditoría *"), { target: { value: "Cambio autorizado" } });
        vi.mocked(getIdentityProfile).mockResolvedValueOnce({ permissions: [] } as unknown as IdentityProfile);
        fireEvent.click(screen.getByRole("button", { name: /Guardar permisos$/ }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Permiso insuficiente");
        expect(replaceIdentityUserAccess).not.toHaveBeenCalled();
    });

    it("keeps a failed employee access load closed until a new selection successfully loads", async () => {
        const employee = { publicId: "employee", name: "Empleado real", email: "employee@example.invalid", status: "active", roles: [{ code: "ventas", name: "Ventas" }] } as unknown as SystemUserDirectoryItem;
        mockGetSystemUsers.mockResolvedValue({ items: [employee], page: { limit: 100, nextCursor: null, total: 1 }, summary: { active: 1, all: 1, blocked: 0, inactive: 0, pending: 0 } });
        vi.mocked(getIdentityUserAccess).mockRejectedValueOnce(new Error("Acceso no disponible"));
        render(<RolesSecurityPage />);
        await screen.findByText("2 roles");
        fireEvent.click(screen.getByText("Por empleado"));
        await chooseOption("Empleado", "Empleado real (Ventas)", ".ant-select-item-option-content");
        expect(await screen.findByRole("alert")).toHaveTextContent("Acceso no disponible");
        expect(screen.queryByRole("switch", { name: "Crear lead" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Guardar cambios 0" })).toBeDisabled();
        expect(screen.getByRole("combobox", { name: "Roles asignados" })).toBeDisabled();
        expect(replaceIdentityUserAccess).not.toHaveBeenCalled();
        vi.mocked(getIdentityUserAccess).mockResolvedValueOnce({ user: { publicId: employee.publicId, name: employee.name, email: employee.email, status: "active" }, roles: [{ code: "ventas", name: "Ventas", status: "active" }], orgUnits: [{ publicId: "area", code: "ventas", name: "Ventas" }], permissionOverrides: [] });
        const clear = screen.getByRole("combobox", { name: "Empleado" }).closest(".ant-select")?.querySelector(".ant-select-clear");
        if (!clear) throw new Error("Missing employee clear action");
        fireEvent.click(clear);
        await screen.findByText("Selecciona un empleado");
        await chooseOption("Empleado", "Empleado real (Ventas)", ".ant-select-item-option-content");
        await waitFor(() => {
            expect(getPermissionSwitch("Crear lead")).toBeEnabled();
        });
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("muestra la ruta, el total de roles y el rol activo con sus usuarios en singular", async () => {
        render(<RolesSecurityPage />);

        expect(await screen.findByText("2 roles")).toHaveClass("roles-security-total");
        expect(screen.getByRole("navigation", { name: "Ruta" })).toHaveTextContent("Administración/Roles y seguridad");
        expect(screen.getByText("Ventas (1 usuario)")).toBeInTheDocument();
        expect(screen.queryByRole("note")).not.toBeInTheDocument();
    });

    it("edita una sola sección con nivel, interruptor maestro y marcar todos", async () => {
        render(<RolesSecurityPage />);
        await screen.findByText("2 roles");

        expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Ventas/Leads");
        const table = screen.getByRole("table", { name: "Permisos de Leads" });
        expect(within(table).getByText("Lectura")).toBeInTheDocument();
        expect(within(table).getByText("Estándar")).toBeInTheDocument();
        expect(within(table).getByText("Sensible")).toBeInTheDocument();
        expect(getPermissionSwitch("Ver leads")).toBeChecked();
        expect(getPermissionSwitch("Crear lead")).not.toBeChecked();
        expect(screen.getByText("Acceso permitido")).toBeInTheDocument();
        expect(screen.getByText("1 / 3")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Marcar todos" }));
        expect(getPermissionSwitch("Crear lead")).toBeChecked();
        expect(getPermissionSwitch("Eliminar lead")).toBeChecked();
        expect(screen.getByRole("button", { name: "Marcar todos" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Guardar cambios 1" })).toBeEnabled();

        fireEvent.click(getPermissionSwitch("Acceso a la sección"));
        expect(screen.getByText("Sin acceso")).toBeInTheDocument();
        expect(getPermissionSwitch("Ver leads")).not.toBeChecked();

        fireEvent.click(getPermissionSwitch("Acceso a la sección"));
        expect(getPermissionSwitch("Ver leads")).toBeChecked();
        expect(getPermissionSwitch("Crear lead")).not.toBeChecked();
        expect(screen.getByRole("button", { name: "Guardar cambios 0" })).toBeDisabled();
    });

    it("agrupa los catálogos del módulo en una sección con una pestaña por catálogo", async () => {
        render(<RolesSecurityPage />);
        await screen.findByText("2 roles");

        await chooseOption("Sección", "Catálogos", ".roles-security-option > span");

        expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Ventas/Catálogos");
        expect(screen.getByText("Proyectos", { selector: ".roles-security-catalog-tab span" })).toBeInTheDocument();
        expect(screen.getByRole("table", { name: "Permisos de Proyectos" })).toBeInTheDocument();
        expect(getPermissionSwitch("Ver proyectos")).toBeChecked();
        expect(screen.queryByRole("table", { name: "Permisos de Leads" })).not.toBeInTheDocument();
    });

    it("muestra el rol protegido como solo lectura con todo concedido", async () => {
        render(<RolesSecurityPage />);
        await screen.findByText("2 roles");

        await chooseOption("Rol", "Owner (1 usuario)", ".ant-select-item-option-content");

        expect(screen.getByRole("note")).toHaveTextContent("Rol protegidoControl máximo del CRM. Uso limitado a muy pocas personas.");
        expect(getPermissionSwitch("Crear lead")).toBeChecked();
        expect(getPermissionSwitch("Crear lead")).toBeDisabled();
        expect(getPermissionSwitch("Acceso a la sección")).toBeDisabled();
        expect(screen.getByRole("button", { name: "Marcar todos" })).toBeDisabled();
    });

    it("pide elegir un empleado antes de mostrar secciones en modo empleado", async () => {
        render(<RolesSecurityPage />);
        await screen.findByText("2 roles");
        await chooseOption("Rol", "Owner (1 usuario)", ".ant-select-item-option-content");

        fireEvent.click(screen.getByText("Por empleado"));

        expect(await screen.findByRole("combobox", { name: "Empleado" })).toBeInTheDocument();
        expect(screen.getByText("Selecciona un empleado")).toBeInTheDocument();
        expect(screen.queryByRole("note")).not.toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "Sección" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Renombrar rol" })).not.toBeInTheDocument();
    });
});
