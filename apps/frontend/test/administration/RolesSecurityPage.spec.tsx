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
    roles: [{ code: "ventas", description: null, locked: false, name: "Ventas", status: "active", users: 1 }],
} as const;

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

    it("muestra catalogos como vistas compartidas dentro del modulo, no como modulo principal", async () => {
        render(<RolesSecurityPage />);

        const modulesRegion = await screen.findByLabelText("Módulos del sistema");
        expect(within(modulesRegion).getByRole("button", { name: /Ventas/i })).toBeInTheDocument();
        expect(within(modulesRegion).queryByRole("button", { name: /Proyectos/i })).not.toBeInTheDocument();

        const sharedCatalogs = await screen.findByRole("button", { name: /Catálogos compartidos/i });
        expect(sharedCatalogs).toHaveAttribute("aria-expanded", "false");

        fireEvent.click(sharedCatalogs);

        expect(sharedCatalogs).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByRole("button", { name: /Proyectos/i })).toBeInTheDocument();
    });
});
