import "@testing-library/jest-dom/vitest";

import { cleanup, configure, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BanksPage } from "../../src/modules/administration/banks/BanksPage";
import { ApiClientError } from "../../src/services/api/api-client";
import { getIdentityProfile } from "../../src/services/auth/auth-service";
import type { IdentityProfile } from "../../src/services/auth/identity-contracts";
import * as service from "../../src/services/catalogs/banks-service";
import { installBrowserApiDoubles } from "../support/browser";
// Nested Ant Design drawers need enough time to settle on shared CI workers.
configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 10000 });
vi.mock("../../src/services/auth/auth-service", () => ({ getIdentityProfile: vi.fn() }));
vi.mock("../../src/services/catalogs/banks-service", () => ({ listBanks: vi.fn(), getBank: vi.fn(), listBankAdvisors: vi.fn(), createBank: vi.fn(), updateBank: vi.fn(), updateBankStatus: vi.fn(), createBankAdvisor: vi.fn(), updateBankAdvisor: vi.fn(), updateBankAdvisorStatus: vi.fn() }));
const bank = { publicId: "bank", name: "Banco Centro", status: "active" as const, version: 1, createdAt: "2026-11-03T10:00:00Z", updatedAt: "2026-11-03T10:00:00Z", advisorCount: 1 };
const advisor = { ...bank, publicId: "advisor", bankPublicId: "bank", name: "Ana Ejecutiva", email: "ana@example.com", phone: "22223333", area: "Crédito" };
const profile = (role = "owner", actions = ["read", "create", "update", "inactivate"]) => ({ user: { publicId: "user", status: "active" }, session: { publicId: "session", status: "active" }, roles: [{ code: role, status: "active" }], orgUnits: [], permissions: actions.map((action) => ({ code: `administration.catalog_bank.${action}`, effect: "allow" })) }) as unknown as IdentityProfile;
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(getIdentityProfile).mockResolvedValue(profile());
    vi.mocked(service.listBanks).mockResolvedValue({ items: [bank], total: 501 });
    vi.mocked(service.getBank).mockResolvedValue(bank);
    vi.mocked(service.listBankAdvisors).mockResolvedValue({ items: [advisor], total: 1 });
});
afterEach(() => {
    cleanup();
    vi.resetAllMocks();
});
describe("BanksPage", () => {
    it("distinguishes a failed permission lookup from denial and allows a safe retry", async () => {
        vi.mocked(getIdentityProfile).mockRejectedValueOnce(new TypeError("Failed to fetch"));
        render(<BanksPage />);
        expect(await screen.findByText("No fue posible verificar el acceso a Bancos")).toBeInTheDocument();
        expect(screen.queryByText("Sin acceso a Bancos")).not.toBeInTheDocument();
        expect(service.listBanks).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Reintentar verificación" }));
        expect(await screen.findByRole("button", { name: "Banco Centro" })).toBeInTheDocument();
    });
    it("denies direct mounting for other roles without fetching records", async () => {
        vi.mocked(getIdentityProfile).mockResolvedValue(profile("ventas"));
        render(<BanksPage />);
        expect(await screen.findByText("Sin acceso a Bancos")).toBeInTheDocument();
        expect(service.listBanks).not.toHaveBeenCalled();
    });
    it("loads paginated banks and opens only their executives", async () => {
        render(<BanksPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Banco Centro" }));
        expect(await screen.findByText("Ana Ejecutiva")).toBeInTheDocument();
        expect(service.listBankAdvisors).toHaveBeenCalledWith("bank", expect.objectContaining({ limit: 25, offset: 0, moduleCode: "administration" }));
        expect(screen.getByText("ana@example.com")).toBeInTheDocument();
    });
    it("keeps read-only users free of mutation actions", async () => {
        vi.mocked(getIdentityProfile).mockResolvedValue(profile("owner", ["read"]));
        render(<BanksPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Banco Centro" }));
        await screen.findByText("Ana Ejecutiva");
        expect(screen.queryByRole("button", { name: "Nuevo banco" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Nuevo ejecutivo" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Editar/ })).not.toBeInTheDocument();
    });
    it("blocks new executives for inactive banks and explains why", async () => {
        vi.mocked(service.getBank).mockResolvedValue({ ...bank, status: "inactive" });
        render(<BanksPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Banco Centro" }));
        await screen.findByText("Ana Ejecutiva");
        expect(screen.getByRole("button", { name: "Nuevo ejecutivo" })).toBeDisabled();
        expect(screen.getByText(/Un banco inactivo no admite nuevos ejecutivos/)).toBeInTheDocument();
    });
    it("validates a required reason before creation", async () => {
        render(<BanksPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Nuevo banco" }));
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        expect(await screen.findByText("El motivo es obligatorio.")).toBeInTheDocument();
        expect(service.createBank).not.toHaveBeenCalled();
    });
    it("navigates complete server pages", async () => {
        render(<BanksPage />);
        await screen.findByRole("button", { name: "Banco Centro" });
        fireEvent.click(screen.getByTitle("2"));
        await waitFor(() => {
            expect(service.listBanks).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 500, limit: 500 }));
        });
    });
    it("retains uncertain creation draft without replay", async () => {
        vi.mocked(service.createBank).mockRejectedValue(new TypeError("network lost"));
        render(<BanksPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Nuevo banco" }));
        fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Banco Borrador" } });
        fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), { target: { value: "Alta autorizada" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        expect(await screen.findByText(/No pudimos confirmar el resultado/)).toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Banco Borrador");
        expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
        expect(service.createBank).toHaveBeenCalledTimes(1);
    });
    it("refreshes a version conflict and preserves draft for consultation", async () => {
        vi.mocked(service.updateBank).mockRejectedValue(new ApiClientError("Conflict", 409, { message: "El registro cambió." }));
        render(<BanksPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
        fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Banco Actualizado" } });
        fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), { target: { value: "Cambio autorizado" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        expect(await screen.findByText(/Actualiza los datos y vuelve a abrir/)).toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Banco Actualizado");
        expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
        expect(service.updateBank).toHaveBeenCalledWith("bank", expect.objectContaining({ expectedVersion: 1 }), expect.any(AbortSignal));
        await waitFor(() => {
            expect(service.listBanks).toHaveBeenCalledTimes(2);
        });
    });
    it("cancels a pending authorization without a future mutation", async () => {
        render(<BanksPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Nuevo banco" }));
        let resolve!: (p: IdentityProfile) => void;
        vi.mocked(getIdentityProfile).mockImplementationOnce(
            () =>
                new Promise((done) => {
                    resolve = done;
                }),
        );
        fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Banco Cancelado" } });
        fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), { target: { value: "Alta autorizada" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        await waitFor(() => {
            expect(getIdentityProfile).toHaveBeenCalledTimes(2);
        });
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        resolve(profile());
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(service.createBank).not.toHaveBeenCalled();
    });
    it("lets the user correct a duplicate advisor email without losing contacts", async () => {
        vi.mocked(service.createBankAdvisor).mockRejectedValue(new ApiClientError("Duplicate", 409, { code: "BANK_DUPLICATE", message: "El correo ya existe en este banco." }));
        render(<BanksPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Banco Centro" }));
        await screen.findByText("Ana Ejecutiva");
        fireEvent.click(screen.getByRole("button", { name: "Nuevo ejecutivo" }));
        for (const [name, value] of [
            ["Nombre", "Nuevo Ejecutivo"],
            ["Correo electrónico", "ana@example.com"],
            ["Teléfono", "22223333"],
            ["Área", "Crédito"],
            ["Motivo", "Alta autorizada"],
        ] as const)
            fireEvent.change(screen.getByRole("textbox", { name }), { target: { value } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        expect(await screen.findByText("El correo ya existe en este banco.")).toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: "Correo electrónico" })).toHaveValue("ana@example.com");
        expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled();
    });
    it("validates email and required advisor fields without dispatch", async () => {
        render(<BanksPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Banco Centro" }));
        await screen.findByText("Ana Ejecutiva");
        fireEvent.click(screen.getByRole("button", { name: "Nuevo ejecutivo" }));
        fireEvent.change(screen.getByRole("textbox", { name: "Correo electrónico" }), { target: { value: "invalid-email" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        expect(await screen.findByText("Agrega un correo válido.")).toBeInTheDocument();
        expect(screen.getByText("El teléfono es obligatorio.")).toBeInTheDocument();
        expect(screen.getByText("El área es obligatoria.")).toBeInTheDocument();
        expect(service.createBankAdvisor).not.toHaveBeenCalled();
    });
    it("denies a revoked grant at submit and clears displayed data", async () => {
        render(<BanksPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Nuevo banco" }));
        vi.mocked(getIdentityProfile).mockResolvedValue(profile("ventas"));
        fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Banco Cancelado" } });
        fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), { target: { value: "Alta autorizada" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        expect(await screen.findByText("Sin acceso a Bancos")).toBeInTheDocument();
        expect(screen.queryByText("Banco Centro")).not.toBeInTheDocument();
        expect(service.createBank).not.toHaveBeenCalled();
    });
    it("ignores a stale bank response after changing module context", async () => {
        let resolve!: (value: service.BankPage<service.Bank>) => void;
        vi.mocked(service.listBanks).mockImplementationOnce(
            () =>
                new Promise((done) => {
                    resolve = done;
                }),
        );
        const view = render(<BanksPage />);
        await waitFor(() => {
            expect(service.listBanks).toHaveBeenCalledTimes(1);
        });
        vi.mocked(getIdentityProfile).mockResolvedValue(profile("ventas"));
        view.rerender(<BanksPage contextModuleCode="ventas" />);
        expect(await screen.findByText("Sin acceso a Bancos")).toBeInTheDocument();
        resolve({ items: [bank], total: 1 });
        await waitFor(() => expect(screen.queryByRole("button", { name: "Banco Centro" })).not.toBeInTheDocument());
    });
    it("rejects an account replacement even if the new account has write grants", async () => {
        render(<BanksPage />);
        fireEvent.click(await screen.findByRole("button", { name: "Nuevo banco" }));
        const changed = profile();
        vi.mocked(getIdentityProfile).mockResolvedValue({ ...changed, user: { ...changed.user, publicId: "different-user" } });
        fireEvent.change(screen.getByRole("textbox", { name: "Nombre" }), { target: { value: "Banco Cancelado" } });
        fireEvent.change(screen.getByRole("textbox", { name: "Motivo" }), { target: { value: "Alta autorizada" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
        await waitFor(() => {
            expect(getIdentityProfile).toHaveBeenCalledTimes(2);
        });
        expect(service.createBank).not.toHaveBeenCalled();
        expect(await screen.findByText("Sin acceso a Bancos")).toBeInTheDocument();
    });
});
