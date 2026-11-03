import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationRecordSummary } from "../../src/modules/home/FormalizationRecordSummary";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { getOrderBankAssignment } from "../../src/services/formalization/order-bank-assignment-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/formalization/order-bank-assignment-service", () => ({ getOrderBankAssignment: vi.fn() }));
vi.mock("../../src/modules/home/FormAssignBank", () => ({ FormAssignBank: ({ onAssigned }: { onAssigned?: () => void }) => <button onClick={onAssigned}>Simular asignación guardada</button> }));
const item = { source: "legacy", id: "78", number: "LV208", state: { code: "contract_pending_send", label: "Por enviar", since: null, days: 0 } } as FollowUpItem;
const permission = { code: "formalizacion.catalog_bank.read", effect: "allow" };
const bank = { publicId: "bank", name: "BAC", status: "active" as const, version: 1, advisorCount: 1, createdAt: "2026-11-03T12:00:00Z", updatedAt: "2026-11-03T12:00:00Z" };
const assigned = { source: "legacy" as const, id: "78", version: 1, bank, advisor: { ...bank, publicId: "advisor", bankPublicId: "bank", name: "Paola Ejecutiva", email: "paola@example.com", phone: "72965655", area: "" }, changedAt: "2026-11-03T12:00:00Z" };
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(getOrderBankAssignment).mockResolvedValue(assigned);
});
afterEach(() => {
    cleanup();
    vi.resetAllMocks();
});
it("adds the bank chapter and navigation with the assigned contact", async () => {
    render(<FormalizationRecordSummary item={item} effectivePermissions={[permission]} />);
    expect(screen.getByRole("link", { name: "Banco y ejecutivo" })).toHaveAttribute("href", "#record-chapter-bank-assignment");
    expect(await screen.findByText("Paola Ejecutiva")).toBeInTheDocument();
    expect(screen.getByText("BAC")).toBeInTheDocument();
    expect(screen.getByText("paola@example.com")).toBeInTheDocument();
    expect(screen.getByText("72965655")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Banco y ejecutivo asignado" })).toBeVisible();
    expect(getOrderBankAssignment).toHaveBeenCalledWith(item, expect.any(AbortSignal));
});
it.each([{ permissions: [] }, { permissions: [permission, { ...permission, effect: "deny" }] }])("hides chapter and skips fetching without effective read", ({ permissions }) => {
    render(<FormalizationRecordSummary item={item} effectivePermissions={permissions} />);
    expect(screen.queryByRole("link", { name: "Banco y ejecutivo" })).not.toBeInTheDocument();
    expect(screen.queryByText("Banco y ejecutivo asignado")).not.toBeInTheDocument();
    expect(getOrderBankAssignment).not.toHaveBeenCalled();
});
it("shows an honest empty state without fabricated contact values", async () => {
    vi.mocked(getOrderBankAssignment).mockResolvedValue({ source: "legacy", id: "78", version: 0, bank: null, advisor: null, changedAt: null });
    render(<FormalizationRecordSummary item={item} effectivePermissions={[permission]} />);
    expect(await screen.findByText("Esta orden aún no tiene banco ni ejecutivo asignados.")).toBeInTheDocument();
    expect(screen.queryByText("Paola Ejecutiva")).not.toBeInTheDocument();
});
it("retries a failed read and refreshes after assignment is saved", async () => {
    vi.mocked(getOrderBankAssignment).mockRejectedValueOnce(new TypeError("network"));
    render(<FormalizationRecordSummary item={item} effectivePermissions={[permission]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar datos bancarios" }));
    expect(await screen.findByText("Paola Ejecutiva")).toBeInTheDocument();
    vi.mocked(getOrderBankAssignment).mockResolvedValue({ ...assigned, advisor: { ...assigned.advisor, name: "Nuevo Ejecutivo" } });
    fireEvent.click(screen.getByRole("button", { name: "Simular asignación guardada" }));
    expect(await screen.findByText("Nuevo Ejecutivo")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Paola Ejecutiva")).not.toBeInTheDocument());
});
it("jumping to a collapsed bank chapter opens it", async () => {
    render(<FormalizationRecordSummary item={item} effectivePermissions={[permission]} />);
    await screen.findByText("Paola Ejecutiva");
    const heading = screen.getByRole("button", { name: "Banco y ejecutivo asignado" });
    fireEvent.click(heading);
    expect(screen.queryByText("Paola Ejecutiva")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Banco y ejecutivo" }));
    expect(await screen.findByText("Paola Ejecutiva")).toBeInTheDocument();
});
it("discards the previous order's delayed bank response", async () => {
    let resolveOld: (value: typeof assigned) => void = () => undefined;
    const previous = new Promise<typeof assigned>((resolve) => {
        resolveOld = resolve;
    });
    vi.mocked(getOrderBankAssignment)
        .mockReturnValueOnce(previous)
        .mockResolvedValue({ ...assigned, id: "79", advisor: { ...assigned.advisor, name: "Contacto de otra orden" } });
    const view = render(<FormalizationRecordSummary item={item} effectivePermissions={[permission]} />);
    await waitFor(() => {
        expect(getOrderBankAssignment).toHaveBeenCalledWith(item, expect.any(AbortSignal));
    });
    view.rerender(<FormalizationRecordSummary item={{ ...item, id: "79", number: "LV209" }} effectivePermissions={[permission]} />);
    expect(await screen.findByText("Contacto de otra orden")).toBeInTheDocument();
    resolveOld(assigned);
    await waitFor(() => {
        expect(screen.queryByText("Paola Ejecutiva")).not.toBeInTheDocument();
    });
});
