import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormAssignBank } from "../../src/modules/home/FormAssignBank";
import { getIdentityProfile } from "../../src/services/auth/auth-service";
import type { IdentityProfile } from "../../src/services/auth/identity-contracts";
import * as service from "../../src/services/catalogs/banks-service";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import * as assignment from "../../src/services/formalization/order-bank-assignment-service";
import { installBrowserApiDoubles } from "../support/browser";
vi.mock("../../src/services/auth/auth-service", () => ({ getIdentityProfile: vi.fn() }));
vi.mock("../../src/services/catalogs/banks-service", () => ({ listBanks: vi.fn(), listBankAdvisors: vi.fn(), createBankAdvisor: vi.fn() }));
vi.mock("../../src/services/formalization/order-bank-assignment-service", () => ({ getOrderBankAssignment: vi.fn(), saveOrderBankAssignment: vi.fn() }));
const bank = { publicId: "bank", name: "Banco Centro", status: "active" as const, version: 1, createdAt: "2026-11-03T10:00:00Z", updatedAt: "2026-11-03T10:00:00Z", advisorCount: 1 };
const advisor = { ...bank, publicId: "advisor", bankPublicId: "bank", name: "Ana", email: "ana@example.com", phone: "22223333", area: "Crédito" };
const profile = (actions = ["read", "update", "create"], role = "owner") =>
    ({
        user: { publicId: "user" },
        session: { publicId: "session" },
        roles: [
            { code: role, status: "active" },
            { code: "formalizacion", status: "active" },
        ],
        orgUnits: [],
        permissions: [{ code: "formalizacion.orders.read", effect: "allow" }, ...actions.map((action) => ({ code: `formalizacion.catalog_bank.${action}`, effect: "allow" }))],
    }) as unknown as IdentityProfile;
const item = { source: "legacy", id: "78", number: "OV78" } as FollowUpItem;
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(getIdentityProfile).mockResolvedValue(profile());
    vi.mocked(service.listBanks).mockResolvedValue({ items: [bank], total: 51 });
    vi.mocked(service.listBankAdvisors).mockResolvedValue({ items: [advisor], total: 1 });
    vi.mocked(assignment.getOrderBankAssignment).mockResolvedValue({ source: "legacy", id: "78", version: 2, bank, advisor, changedAt: "2026-11-03T10:00:00Z" });
});
afterEach(() => {
    cleanup();
    vi.resetAllMocks();
});
it("hides assignment without update or management role", async () => {
    vi.mocked(getIdentityProfile).mockResolvedValue(profile(["read"]));
    render(<FormAssignBank item={item} />);
    await waitFor(() => {
        expect(getIdentityProfile).toHaveBeenCalled();
    });
    expect(screen.queryByText("Asignar banco")).not.toBeInTheDocument();
});
it("reopens saved assignment and preserves URL and pagination", async () => {
    const url = location.href;
    render(<FormAssignBank item={item} />);
    fireEvent.click(await screen.findByRole("button", { name: "Asignar banco" }));
    expect(await screen.findByText(/ana@example.com/)).toBeInTheDocument();
    expect(location.href).toBe(url);
    fireEvent.click(screen.getByTitle("2"));
    await waitFor(() => {
        expect(service.listBanks).toHaveBeenLastCalledWith(expect.objectContaining({ offset: 25, status: "active" }));
    });
    expect(assignment.saveOrderBankAssignment).not.toHaveBeenCalled();
});
it("revalidates session identity before saving", async () => {
    render(<FormAssignBank item={item} />);
    fireEvent.click(await screen.findByRole("button", { name: "Asignar banco" }));
    await screen.findByText(/ana@example.com/);
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo de la asignación" }), { target: { value: "Actualizar contacto" } });
    vi.mocked(getIdentityProfile).mockResolvedValue({ ...profile(), session: { publicId: "other" } } as IdentityProfile);
    fireEvent.click(screen.getByRole("button", { name: "Guardar asignación" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Guardar asignación" })).not.toBeInTheDocument());
    expect(assignment.saveOrderBankAssignment).not.toHaveBeenCalled();
});

it("clears the executive when another bank is selected", async () => {
    const other = { ...bank, publicId: "bank-b", name: "Banco Pacífico" };
    vi.mocked(service.listBanks).mockResolvedValue({ items: [bank, other], total: 2 });
    render(<FormAssignBank item={item} />);
    fireEvent.click(await screen.findByRole("button", { name: "Asignar banco" }));
    await screen.findByText(/ana@example.com/);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Banco" }));
    fireEvent.click(await screen.findByText("Banco Pacífico"));
    await waitFor(() => {
        expect(service.listBankAdvisors).toHaveBeenLastCalledWith("bank-b", expect.objectContaining({ status: "active" }));
    });
    expect(screen.queryByText(/ana@example.com/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar asignación" })).toBeDisabled();
});
it("creates the contact in the selected bank and requires explicit assignment save", async () => {
    const onAssigned = vi.fn();
    const created = { ...advisor, publicId: "new-advisor", name: "María Nueva", email: "maria@example.com" };
    vi.mocked(service.createBankAdvisor).mockResolvedValue(created);
    render(<FormAssignBank item={item} onAssigned={onAssigned} />);
    fireEvent.click(await screen.findByRole("button", { name: "Asignar banco" }));
    await screen.findByText(/ana@example.com/);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo ejecutivo" }));
    for (const [label, value] of [
        ["Nombre", "María Nueva"],
        ["Correo electrónico", "maria@example.com"],
        ["Teléfono", "22224444"],
        ["Área", "Hipotecas"],
        ["Motivo", "Nuevo contacto"],
    ] as const)
        fireEvent.change(screen.getByRole("textbox", { name: label }), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: /^Guardar$/ }));
    await waitFor(() => {
        expect(service.createBankAdvisor).toHaveBeenCalledWith("bank", { moduleCode: "formalizacion", name: "María Nueva", email: "maria@example.com", phone: "22224444", area: "Hipotecas", reason: "Nuevo contacto" }, expect.any(AbortSignal));
    });
    expect(await screen.findByText(/maria@example.com/)).toBeInTheDocument();
    expect(assignment.saveOrderBankAssignment).not.toHaveBeenCalled();
    expect(onAssigned).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo de la asignación" }), { target: { value: "Contacto bancario actualizado" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar asignación" }));
    await waitFor(() => {
        expect(assignment.saveOrderBankAssignment).toHaveBeenCalledWith(item, { bankPublicId: "bank", advisorPublicId: "new-advisor", expectedVersion: 2, reason: "Contacto bancario actualizado" }, expect.any(AbortSignal));
    });
    await waitFor(() => {
        expect(onAssigned).toHaveBeenCalledTimes(1);
    });
});
it("does not offer contact creation without its exact grant", async () => {
    vi.mocked(getIdentityProfile).mockResolvedValue(profile(["read", "update"]));
    render(<FormAssignBank item={item} />);
    fireEvent.click(await screen.findByRole("button", { name: "Asignar banco" }));
    await screen.findByText(/ana@example.com/);
    expect(screen.queryByRole("button", { name: "Nuevo ejecutivo" })).not.toBeInTheDocument();
});

it("hides assignment when order read has an explicit deny", async () => {
    const denied = profile();
    vi.mocked(getIdentityProfile).mockResolvedValue({ ...denied, permissions: [...denied.permissions, { scope: null, source: "override", code: "formalizacion.orders.read", effect: "deny" }] });
    render(<FormAssignBank item={item} />);
    await waitFor(() => {
        expect(getIdentityProfile).toHaveBeenCalled();
    });
    expect(screen.queryByText("Asignar banco")).not.toBeInTheDocument();
});
