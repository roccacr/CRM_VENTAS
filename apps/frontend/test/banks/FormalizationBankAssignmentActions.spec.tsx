import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { FormalizationBankAssignmentActions } from "../../src/modules/home/FormalizationBankAssignmentActions";
import { ApiClientError } from "../../src/services/api/api-client";
import { getIdentityProfile } from "../../src/services/auth/auth-service";
import type { IdentityProfile } from "../../src/services/auth/identity-contracts";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { type OrderBankAssignment, unlinkOrderBankAssignment } from "../../src/services/formalization/order-bank-assignment-service";
import { installBrowserApiDoubles } from "../support/browser";
vi.mock("../../src/services/auth/auth-service", () => ({ getIdentityProfile: vi.fn() }));
vi.mock("../../src/services/formalization/order-bank-assignment-service", () => ({ unlinkOrderBankAssignment: vi.fn() }));
vi.mock("../../src/modules/home/FormAssignBank", () => ({ FormAssignBank: ({ label }: { label: string }) => <button>{label}</button> }));
const profile = {
    user: { publicId: "u" },
    session: { publicId: "s" },
    roles: [
        { code: "owner", status: "active" },
        { code: "formalizacion", status: "active" },
    ],
    orgUnits: [],
    permissions: ["formalizacion.orders.read", "formalizacion.catalog_bank.read", "formalizacion.catalog_bank.update"].map((code) => ({ code, effect: "allow" })),
} as unknown as IdentityProfile;
const item = { source: "legacy", id: "78", number: "OV78" } as FollowUpItem;
const snapshot = { source: "legacy", id: "78", version: 2, bank: { name: "Banco Centro" }, advisor: { name: "Ana" }, changedAt: null } as OrderBankAssignment;
afterEach(() => {
    cleanup();
    vi.resetAllMocks();
});
async function open(onChanged = vi.fn()) {
    installBrowserApiDoubles();
    vi.mocked(getIdentityProfile).mockResolvedValue(profile);
    render(<FormalizationBankAssignmentActions item={item} assignment={snapshot} onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: "Desvincular banco" }));
    return onChanged;
}
it("requires a reason and submits only the versioned unlink after fresh authorization", async () => {
    const onChanged = await open();
    const confirm = screen.getByRole("button", { name: /Confirmar desvinculación/u });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo de la desvinculación" }), { target: { value: "  Cambio de financiamiento  " } });
    vi.mocked(unlinkOrderBankAssignment).mockResolvedValue({ ...snapshot, version: 3, bank: null, advisor: null });
    fireEvent.click(confirm);
    await waitFor(() => {
        expect(unlinkOrderBankAssignment).toHaveBeenCalledWith(item, { expectedVersion: 2, reason: "Cambio de financiamiento" }, expect.any(AbortSignal));
    });
    await waitFor(() => {
        expect(onChanged).toHaveBeenCalledTimes(1);
    });
    expect(getIdentityProfile).toHaveBeenCalledTimes(2);
});
it("does not send after session identity changes", async () => {
    await open();
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo de la desvinculación" }), { target: { value: "Cambio de banco" } });
    vi.mocked(getIdentityProfile).mockResolvedValue({ ...profile, session: { publicId: "other" } } as IdentityProfile);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar desvinculación/u }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Confirmar desvinculación/u })).not.toBeInTheDocument());
    expect(unlinkOrderBankAssignment).not.toHaveBeenCalled();
});
it("blocks replay after conflict while preserving the reason", async () => {
    await open();
    vi.mocked(unlinkOrderBankAssignment).mockRejectedValue(new ApiClientError("Changed", 409, { code: "CONFLICT" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo de la desvinculación" }), { target: { value: "Cambio de banco" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar desvinculación/u }));
    await waitFor(() => expect(screen.getByRole("button", { name: /Confirmar desvinculación/u })).toBeDisabled());
    expect(screen.getByRole("textbox", { name: "Motivo de la desvinculación" })).toHaveValue("Cambio de banco");
    expect(unlinkOrderBankAssignment).toHaveBeenCalledTimes(1);
});

it("hides actions for read-only profiles and explicit denies", async () => {
    installBrowserApiDoubles();
    vi.mocked(getIdentityProfile).mockResolvedValue({ ...profile, permissions: [...profile.permissions, { code: "formalizacion.catalog_bank.update", effect: "deny", scope: null, source: "override" }] });
    render(<FormalizationBankAssignmentActions item={item} assignment={snapshot} />);
    await waitFor(() => {
        expect(getIdentityProfile).toHaveBeenCalled();
    });
    expect(screen.queryByRole("button", { name: "Desvincular banco" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cambiar banco" })).not.toBeInTheDocument();
});
it("blocks unknown results and refreshes the order when the panel closes", async () => {
    const onChanged = await open();
    vi.mocked(unlinkOrderBankAssignment).mockRejectedValue(new TypeError("Network unavailable"));
    fireEvent.change(screen.getByRole("textbox", { name: "Motivo de la desvinculación" }), { target: { value: "Cambio de banco" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar desvinculación/u }));
    await screen.findByText(/No pudimos confirmar el resultado/);
    expect(screen.getByRole("button", { name: /Confirmar desvinculación/u })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(unlinkOrderBankAssignment).toHaveBeenCalledTimes(1);
});
