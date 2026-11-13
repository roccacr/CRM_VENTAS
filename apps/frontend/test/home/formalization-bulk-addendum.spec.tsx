import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationBulkAddendum } from "../../src/modules/home/FormalizationBulkAddendum";
import { ApiClientError } from "../../src/services/api/api-client";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import type * as AddendumService from "../../src/services/formalization/order-addendum-service";
import { markSelectedOrderAddendumPending, type OrderAddendum, previewSelectedOrderAddendums } from "../../src/services/formalization/order-addendum-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/formalization/order-addendum-service", async (importOriginal) => ({ ...(await importOriginal<typeof AddendumService>()), previewSelectedOrderAddendums: vi.fn(), markSelectedOrderAddendumPending: vi.fn() }));
const items: readonly FollowUpItem[] = ["78", "79", "80"].map((id) => ({ source: "legacy", id: `legacy:${id}`, number: `OV${id}`, nativeCode: null, client: `Cliente ${id}`, clientEmail: null, project: { id: "1", name: "Proyecto" }, unit: `Unidad ${id}`, responsible: null, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null }, nextStep: "Registrar envío", completedThisYear: false }));
const state: OrderAddendum = { schemaVersion: 1, source: "legacy", id: "78", status: "pending", version: 3, changedAt: null, note: "Anterior", canUpdate: false, canMarkPending: true, availableForPending: true };
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(previewSelectedOrderAddendums)
        .mockReset()
        .mockResolvedValue(items.map((item) => ({ ...state, id: item.id.replace("legacy:", "") })));
    vi.mocked(markSelectedOrderAddendumPending)
        .mockReset()
        .mockImplementation((command) => Promise.resolve({ ...state, ...command, status: "pending", version: 4, replayed: false }));
});
afterEach(cleanup);

async function enterReason() {
    await waitFor(() => {
        expect(screen.getByLabelText("Motivo")).toBeEnabled();
    });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "  Motivo común  " } });
    fireEvent.click(screen.getByRole("button", { name: "Marcar pendientes" }));
}

it("shows selected details and warnings, renews pending orders with one reason and retains individual outcomes", async () => {
    vi.mocked(markSelectedOrderAddendumPending).mockImplementation((command) => {
        if (command.id === "79") return Promise.reject(new ApiClientError("changed", 409, null));
        return Promise.resolve({ ...state, ...command, version: 4, replayed: false });
    });
    const onSaved = vi.fn();
    render(<FormalizationBulkAddendum items={items} onClose={vi.fn()} onSaved={onSaved} />);
    await enterReason();
    await waitFor(() => {
        expect(onSaved).toHaveBeenCalledOnce();
    });
    expect(screen.getByRole("status")).toHaveTextContent("Marcadas: 2. No marcadas: 1. Sin confirmar: 0.");
    expect(screen.getByRole("region", { name: "Detalle de órdenes seleccionadas" })).toHaveTextContent("Cliente 80");
    expect(screen.getByText(/OV78: Ya tiene un adéndum pendiente/)).toBeInTheDocument();
    expect(vi.mocked(markSelectedOrderAddendumPending).mock.calls.map(([command]) => command.note)).toEqual(["Motivo común", "Motivo común", "Motivo común"]);
    expect(new Set(vi.mocked(markSelectedOrderAddendumPending).mock.calls.map(([command]) => command.operationId)).size).toBe(3);
});

it("retries only uncertain commands unchanged and reports a subsequent state change truthfully", async () => {
    let attempts = 0;
    vi.mocked(markSelectedOrderAddendumPending).mockImplementation((command) => {
        if (command.id === "79" && attempts++ === 0) return Promise.reject(new Error("response lost"));
        return Promise.resolve({ ...state, ...command, status: command.id === "79" ? "completed" : "pending", version: 4, replayed: true });
    });
    render(<FormalizationBulkAddendum items={items} onClose={vi.fn()} onSaved={vi.fn()} />);
    await enterReason();
    await waitFor(() => {
        expect(screen.getByRole("button", { name: "Reintentar sin confirmar" })).toBeEnabled();
    });
    const original = vi.mocked(markSelectedOrderAddendumPending).mock.calls[1]?.[0];
    expect(screen.getByLabelText("Motivo")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar sin confirmar" }));
    await screen.findByText(/la orden cambió después/);
    expect(markSelectedOrderAddendumPending).toHaveBeenCalledTimes(4);
    expect(vi.mocked(markSelectedOrderAddendumPending).mock.calls[3]?.[0]).toEqual(original);
});

it("does not send orders whose permissions or availability cannot be verified", async () => {
    vi.mocked(previewSelectedOrderAddendums).mockResolvedValue([state, { ...state, id: "79", availableForPending: false }, null]);
    render(<FormalizationBulkAddendum items={items} onClose={vi.fn()} onSaved={vi.fn()} />);
    await enterReason();
    await waitFor(() => {
        expect(markSelectedOrderAddendumPending).toHaveBeenCalledOnce();
    });
    expect(vi.mocked(markSelectedOrderAddendumPending).mock.calls[0]?.[0]).toMatchObject({ id: "78" });
});

it("keeps a lost response uncertain if a later permission rejection prevents verification", async () => {
    vi.mocked(markSelectedOrderAddendumPending)
        .mockRejectedValueOnce(new Error("response lost"))
        .mockRejectedValueOnce(new ApiClientError("permission revoked", 403, null));
    render(<FormalizationBulkAddendum items={items.slice(0, 1)} onClose={vi.fn()} onSaved={vi.fn()} />);
    await enterReason();
    await waitFor(() => {
        expect(screen.getByRole("button", { name: "Reintentar sin confirmar" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar sin confirmar" }));
    await screen.findByText(/La marcación anterior sigue sin confirmar/);
    expect(screen.getByRole("status")).toHaveTextContent("Marcadas: 0. No marcadas: 0. Sin confirmar: 1.");
});
