import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BROKERS_CATALOG } from "../../src/modules/administration/brokers/brokers-definition";
import { getCatalogPermissions } from "../../src/modules/administration/catalogs/catalog-permissions";
import { CatalogItemsPage } from "../../src/modules/administration/catalogs/CatalogItemsPage";
import { getIdentityProfile } from "../../src/services/auth/auth-service";
import type { IdentityProfile } from "../../src/services/auth/identity-contracts";
import type * as CatalogServiceModule from "../../src/services/catalogs/catalog-service";
import { createCatalogItem, listCatalogItems } from "../../src/services/catalogs/catalog-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/auth/auth-service", () => ({ getIdentityProfile: vi.fn() }));
vi.mock("../../src/services/catalogs/catalog-service", async (original) => ({ ...(await original<typeof CatalogServiceModule>()), createCatalogItem: vi.fn(), listCatalogItems: vi.fn(), updateCatalogItem: vi.fn(), updateCatalogItemStatus: vi.fn() }));

const read = "formalizacion.catalog_broker.read";
const create = "formalizacion.catalog_broker.create";
const profile = (codes: readonly string[]): IdentityProfile => ({
    user: { publicId: "formalization-user", displayName: "Formalization user", email: "fixture@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 },
    session: { publicId: "session", status: "active", expiresAt: "2026-10-14T00:00:00Z", expiresInSeconds: 3600, permissionVersion: 1 },
    auth: { primaryProvider: "microsoft", availableProviders: ["local"], currentProvider: "local", localStatus: "active", microsoft: null },
    roles: [{ code: "formalizacion", name: "Formalizacion", status: "active" }],
    orgUnits: [{ publicId: "formalization-module", code: "formalizacion", name: "Formalizacion", membership: "member", scope: "self", status: "active" }],
    permissions: codes.map((code) => ({ code, effect: "allow", scope: "self", source: "role" })),
});

beforeEach(() => {
    installBrowserApiDoubles();
    window.localStorage.clear();
    expect(getCatalogPermissions(profile([read, create]), BROKERS_CATALOG, "formalizacion").create).toBe(true);
    vi.mocked(getIdentityProfile).mockResolvedValue(profile([read, create]));
    vi.mocked(listCatalogItems).mockResolvedValue({ catalog: { code: "brokers", label: "Corredores", moduleCode: "catalog_broker" }, items: [], total: 0 });
});
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe("Formalization catalog action authorization", () => {
    it.each([{ codes: [read] }, { codes: [read, "administration.catalog_broker.create"] }, { codes: [read, "formalizacion.catalog_project.create"] }])("hides create without the exact broker grant: $codes", async ({ codes }) => {
        vi.mocked(getIdentityProfile).mockResolvedValue(profile(codes));
        render(<CatalogItemsPage catalog={BROKERS_CATALOG} contextModuleCode="formalizacion" />);
        await screen.findByRole("button", { name: "Actualizar corredores" });
        expect(screen.queryByRole("button", { name: /Nuevo corredor/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(createCatalogItem).not.toHaveBeenCalled();
    });
    it("lets an explicit deny override the create grant", async () => {
        const allowed = profile([read, create]);
        const denied: IdentityProfile = { ...allowed, permissions: [...allowed.permissions, { code: create, effect: "deny", scope: null, source: "override" }] };
        vi.mocked(getIdentityProfile).mockResolvedValue(denied);
        render(<CatalogItemsPage catalog={BROKERS_CATALOG} contextModuleCode="formalizacion" />);
        await screen.findByRole("button", { name: "Actualizar corredores" });
        expect(screen.queryByRole("button", { name: /Nuevo corredor/ })).not.toBeInTheDocument();
    });
    it("rechecks revoked permission before opening a form", async () => {
        render(<CatalogItemsPage catalog={BROKERS_CATALOG} contextModuleCode="formalizacion" />);
        const button = await screen.findByRole("button", { name: /Nuevo corredor/ });
        vi.mocked(getIdentityProfile).mockResolvedValue(profile([read]));
        fireEvent.click(button);
        await waitFor(() => {
            expect(screen.queryByRole("button", { name: /Nuevo corredor/ })).not.toBeInTheDocument();
        });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(createCatalogItem).not.toHaveBeenCalled();
    });
    it("refuses submission after creation permission was revoked", async () => {
        render(<CatalogItemsPage catalog={BROKERS_CATALOG} contextModuleCode="formalizacion" />);
        fireEvent.click(await screen.findByRole("button", { name: /Nuevo corredor/ }));
        fireEvent.change(await screen.findByRole("textbox", { name: "Nombre" }), { target: { value: "Corredor de prueba" } });
        fireEvent.change(screen.getByRole("textbox", { name: "Motivo de auditoría" }), { target: { value: "Alta autorizada" } });
        vi.mocked(getIdentityProfile).mockResolvedValue(profile([read]));
        fireEvent.click(screen.getByRole("button", { name: /Crear corredor/ }));
        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
        expect(createCatalogItem).not.toHaveBeenCalled();
    });
    it("closes an open form when focus revalidation detects revocation", async () => {
        render(<CatalogItemsPage catalog={BROKERS_CATALOG} contextModuleCode="formalizacion" />);
        fireEvent.click(await screen.findByRole("button", { name: /Nuevo corredor/ }));
        await screen.findByRole("dialog");
        vi.mocked(getIdentityProfile).mockResolvedValue(profile([read]));
        fireEvent(window, new Event("focus"));
        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
        expect(createCatalogItem).not.toHaveBeenCalled();
    });
});
