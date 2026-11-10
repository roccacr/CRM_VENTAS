import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationMarkAddendum } from "../../src/modules/home/FormalizationMarkAddendum";
import { FormalizationOrderDrawer } from "../../src/modules/home/FormalizationOrderDrawer";
import { FormalizationOrderRecord } from "../../src/modules/home/FormalizationOrderPreview";
import { ApiClientError } from "../../src/services/api/api-client";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { getOrderAddendum, markOrderAddendumPending, type OrderAddendum } from "../../src/services/formalization/order-addendum-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/formalization/order-addendum-service", () => ({ getOrderAddendum: vi.fn(), markOrderAddendumPending: vi.fn(), updateOrderAddendum: vi.fn() }));
vi.mock("../../src/services/formalization/order-client-service", () => ({ getOrderClientDetail: vi.fn().mockResolvedValue({ name: "Cliente", warnings: [], groups: [] }) }));
const permissions = [
    { code: "formalizacion.orders.read", effect: "allow" },
    { code: "formalizacion.orders.addendum.read", effect: "allow" },
    { code: "formalizacion.orders.addendum.mark_pending", effect: "allow" },
];
const item: FollowUpItem = { id: "legacy:78", source: "legacy", number: "LV208", nativeCode: null, client: "Cliente", clientEmail: "cliente@example.com", project: null, unit: null, responsible: null, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null }, nextStep: "Registrar envío", completedThisYear: false };
const state: OrderAddendum = { schemaVersion: 1, source: "legacy", id: "78", status: null, version: 0, changedAt: null, canUpdate: false, note: null, canMarkPending: true };
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(getOrderAddendum).mockReset().mockResolvedValue(state);
    vi.mocked(markOrderAddendumPending)
        .mockReset()
        .mockResolvedValue({ ...state, status: "pending", version: 1, canMarkPending: false, replayed: false });
});
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});
async function open() {
    fireEvent.click(screen.getByRole("button", { name: "Marcar adéndum pendiente" }));
    await waitFor(() => {
        expect(screen.getByLabelText("Motivo")).toBeEnabled();
    });
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Motivo de la orden" } });
}

it("keeps the manual addendum dialog above the global overlay and order drawer", async () => {
    render(<FormalizationMarkAddendum item={item} permissions={permissions} />);
    await open();
    expect(screen.getByRole("dialog").closest(".ant-modal-wrap")).toHaveStyle({ zIndex: 1400 });
    expect(screen.getByRole("button", { name: "Marcar pendiente" })).toBeEnabled();
    expect(markOrderAddendumPending).not.toHaveBeenCalled();
});

it.each(["native", "legacy"] as const)("marks %s manually from both order views and refreshes their marker/count callbacks", async (source) => {
    const id = source === "legacy" ? "78" : "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const order = { ...item, source, id };
    let marked = false;
    vi.mocked(getOrderAddendum).mockImplementation(() => Promise.resolve({ ...state, source, id, status: marked ? "pending" : null, version: marked ? 1 : 0 }));
    vi.mocked(markOrderAddendumPending).mockImplementation((command) => {
        marked = true;
        return Promise.resolve({ ...state, source, id, status: "pending", version: 1, note: command.note, replayed: false });
    });
    const changed = vi.fn();
    const short = render(<FormalizationOrderDrawer item={order} position={1} total={2} onClose={vi.fn()} onSelectPrevious={vi.fn()} onSelectNext={vi.fn()} stagePermissions={permissions} onStageSaved={changed} />);
    await screen.findByText("Sin adéndum");
    expect(screen.getByRole("button", { name: "Ver orden completa" }).nextElementSibling).toBe(screen.getByRole("button", { name: "Marcar adéndum pendiente" }));
    await open();
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Acuerdo de compra" } });
    fireEvent.click(screen.getByRole("button", { name: "Marcar pendiente" }));
    await waitFor(() => {
        expect(changed).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(markOrderAddendumPending).mock.calls[0]?.[0]).toMatchObject({ source, id, expectedVersion: 0, note: "Acuerdo de compra" });
    await screen.findByText("Pendiente", { selector: "strong" });
    short.unmount();
    marked = false;
    render(<FormalizationOrderRecord item={order} stagePermissions={permissions} onBack={vi.fn()} onAddendumChanged={changed} />);
    await screen.findByText("Sin adéndum");
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Marcar pendiente" }));
    await waitFor(() => {
        expect(changed).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(markOrderAddendumPending).mock.calls[1]?.[0]).toHaveProperty("note", "Motivo de la orden");
});
it("reads a fresh canonical version only when the reason modal opens", async () => {
    const canonical = { ...state, source: "native" as const, id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", status: "completed" as const, version: 4 };
    vi.mocked(getOrderAddendum).mockResolvedValue(canonical);
    render(<FormalizationMarkAddendum item={item} permissions={permissions} />);
    expect(getOrderAddendum).not.toHaveBeenCalled();
    await open();
    expect(screen.getByLabelText("Motivo")).toHaveAttribute("maxlength", "2000");
    fireEvent.click(screen.getByRole("button", { name: "Marcar pendiente" }));
    await waitFor(() => {
        expect(markOrderAddendumPending).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(markOrderAddendumPending).mock.calls[0]?.[0]).toMatchObject({ source: "native", id: canonical.id, expectedVersion: 4 });
});
it.each([{ grants: [] }, { grants: permissions.filter((permission) => permission.code !== "formalizacion.orders.addendum.mark_pending") }, { grants: permissions.filter((permission) => permission.code !== "formalizacion.orders.addendum.read") }, { grants: [...permissions, { code: "formalizacion.orders.addendum.mark_pending", effect: "deny" }] }, { grants: [...permissions, { code: "formalizacion.orders.addendum.read", effect: "deny" }] }])(
    "does not infer manual marking from other roles/permissions and honors explicit denies",
    ({ grants }) => {
        render(<FormalizationMarkAddendum item={item} permissions={grants} />);
        expect(screen.queryByRole("button", { name: "Marcar adéndum pendiente" })).not.toBeInTheDocument();
        expect(getOrderAddendum).not.toHaveBeenCalled();
    },
);
it.each([
    { ...state, canMarkPending: false },
    { ...state, status: "pending" as const },
])("does not mark when the authoritative snapshot disallows it", async (snapshot) => {
    vi.mocked(getOrderAddendum).mockResolvedValue(snapshot);
    render(<FormalizationMarkAddendum item={item} permissions={permissions} />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar adéndum pendiente" }));
    await waitFor(() => {
        expect(screen.queryByText("Consultando versión y permisos de la orden…")).not.toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Marcar pendiente" })).toBeDisabled();
    expect(markOrderAddendumPending).not.toHaveBeenCalled();
});
it("single-flights a double click and preserves the exact command/note when a write is uncertain", async () => {
    let rejectWrite: (error: Error) => void = () => {};
    vi.mocked(markOrderAddendumPending).mockReturnValueOnce(
        new Promise((_resolve, reject) => {
            rejectWrite = reject;
        }),
    );
    render(<FormalizationMarkAddendum item={item} permissions={permissions} />);
    await open();
    fireEvent.change(screen.getByLabelText("Motivo"), { target: { value: "Nota original" } });
    const save = screen.getByRole("button", { name: "Marcar pendiente" });
    act(() => {
        fireEvent.click(save);
        fireEvent.click(save);
    });
    expect(markOrderAddendumPending).toHaveBeenCalledTimes(1);
    act(() => {
        rejectWrite(new Error("secret transport"));
    });
    expect(await screen.findByRole("alert")).not.toHaveTextContent("secret transport");
    expect(screen.getByLabelText("Motivo")).toBeDisabled();
    await waitFor(() => {
        const retry = screen.getByRole("button", { name: "Reintentar la misma marcación" });
        expect(retry).toBeEnabled();
        expect(retry).not.toHaveClass("ant-btn-loading");
    });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar la misma marcación" }));
    await waitFor(() => {
        expect(markOrderAddendumPending).toHaveBeenCalledTimes(2);
    });
    expect(vi.mocked(markOrderAddendumPending).mock.calls[1]?.[0]).toEqual(vi.mocked(markOrderAddendumPending).mock.calls[0]?.[0]);
});
it("requires fresh state after a conflict and does not write a second audit for an already-pending marker", async () => {
    vi.mocked(markOrderAddendumPending).mockRejectedValueOnce(new ApiClientError("private conflict", 409, {}));
    render(<FormalizationMarkAddendum item={item} permissions={permissions} />);
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Marcar pendiente" }));
    expect(await screen.findByRole("alert")).not.toHaveTextContent("private conflict");
    vi.mocked(getOrderAddendum).mockResolvedValueOnce({ ...state, status: "pending", version: 1, canMarkPending: false });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar información del adéndum" }));
    await screen.findByText("La orden ya tiene un adéndum pendiente.");
    expect(screen.getByRole("button", { name: "Marcar pendiente" })).toBeDisabled();
    expect(markOrderAddendumPending).toHaveBeenCalledTimes(1);
});
it("discards an old order read after the user selects another order", async () => {
    let resolve: (value: OrderAddendum) => void = () => {};
    vi.mocked(getOrderAddendum).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    const view = render(<FormalizationMarkAddendum item={item} permissions={permissions} />);
    fireEvent.click(screen.getByRole("button", { name: "Marcar adéndum pendiente" }));
    view.rerender(<FormalizationMarkAddendum item={{ ...item, id: "legacy:79", number: "LV209" }} permissions={permissions} />);
    vi.mocked(getOrderAddendum).mockResolvedValueOnce({ ...state, id: "79", version: 3 });
    await open();
    await act(async () => {
        resolve(state);
        await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "Marcar pendiente" }));
    await waitFor(() => {
        expect(markOrderAddendumPending).toHaveBeenCalledTimes(1);
    });
    expect(vi.mocked(markOrderAddendumPending).mock.calls[0]?.[0]).toMatchObject({ id: "79", expectedVersion: 3 });
});

it("requires at least three trimmed reason characters", async () => {
    render(<FormalizationMarkAddendum item={item} permissions={permissions} />);
    await open();
    for (const value of ["", "   ", "ab"]) {
        fireEvent.change(screen.getByLabelText("Motivo"), { target: { value } });
        expect(screen.getByRole("button", { name: "Marcar pendiente" })).toBeDisabled();
    }
    expect(markOrderAddendumPending).not.toHaveBeenCalled();
});
