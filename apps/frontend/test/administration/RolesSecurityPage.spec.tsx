import "@testing-library/jest-dom/vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RolesSecurityPage } from "../../src/modules/administration/pages/RolesSecurityPage";
import { getIdentitySecurityCatalog, getSystemUsers } from "../../src/services/auth/auth-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/auth/auth-service", () => ({
    getIdentitySecurityCatalog: vi.fn(),
    getIdentityUserAccess: vi.fn(),
    getSystemUsers: vi.fn(),
    replaceIdentityRolePermissions: vi.fn(),
    replaceIdentityUserAccess: vi.fn(),
    updateIdentityRole: vi.fn(),
}));

const mockGetIdentitySecurityCatalog = vi.mocked(getIdentitySecurityCatalog);
const mockGetSystemUsers = vi.mocked(getSystemUsers);

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
        mockGetIdentitySecurityCatalog.mockResolvedValue(mockSecurityCatalog);
        mockGetSystemUsers.mockResolvedValue({
            items: [],
            page: { limit: 100, nextCursor: null, total: 0 },
            summary: { active: 0, all: 0, blocked: 0, inactive: 0, pending: 0 },
        });
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it("explains a lost connection without claiming that a save definitely failed", async () => {
        mockGetIdentitySecurityCatalog.mockRejectedValueOnce(new TypeError("Failed to fetch"));
        render(<RolesSecurityPage />);
        expect(await screen.findByText("No pudimos conectar con el servidor. Si estabas guardando, el resultado no está confirmado; verifica los permisos antes de volver a intentar.")).toBeInTheDocument();
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
