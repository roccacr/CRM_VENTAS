import "@testing-library/jest-dom/vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RolesSecurityPage } from "../../src/modules/administration/pages/RolesSecurityPage";
import { getIdentityProfile, getIdentitySecurityCatalog, getIdentityUserAccess, getSystemUsers, replaceIdentityRolePermissions, replaceIdentityUserAccess, updateIdentityRole } from "../../src/services/auth/auth-service";
import type { IdentityProfile, SystemUserDirectoryItem } from "../../src/services/auth/identity-contracts";
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
        ventas: ["lead.read", "ventas.catalog_project.read"],
    },
    roles: [
        { code: "owner", description: null, locked: true, name: "Owner", status: "active", users: 1 },
        { code: "ventas", description: null, locked: false, name: "Ventas", status: "active", users: 1 },
    ],
} as const;

const getPermissionSwitch = (name: string) => screen.getByRole("switch", { name });

const chooseOption = async (combobox: string, option: string, selector: string) => {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: combobox }));
    fireEvent.click(await screen.findByText(option, { selector }));
};

describe("RolesSecurityPage", () => {
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
