import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationOrderAddendum } from "../../src/modules/home/FormalizationOrderAddendum";
import { FormalizationOrderDrawer } from "../../src/modules/home/FormalizationOrderDrawer";
import { FormalizationOrderRecord } from "../../src/modules/home/FormalizationOrderPreview";
import { ApiClientError } from "../../src/services/api/api-client";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { getOrderAddendum, markOrderAddendumSent, type OrderAddendum, updateOrderAddendum } from "../../src/services/formalization/order-addendum-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/formalization/order-addendum-service", () => ({ getOrderAddendum: vi.fn(), markOrderAddendumSent: vi.fn(), updateOrderAddendum: vi.fn() }));
vi.mock("../../src/services/formalization/order-client-service", () => ({ getOrderClientDetail: vi.fn().mockResolvedValue({ name: "Cliente", warnings: [], groups: [] }) }));
const permissions = [
    { code: "formalizacion.orders.read", effect: "allow" },
    { code: "formalizacion.orders.addendum.read", effect: "allow" },
    { code: "formalizacion.orders.addendum.update", effect: "allow" },
];
const item: FollowUpItem = { id: "legacy:78", source: "legacy", number: "LV208", nativeCode: null, client: "Cliente", clientEmail: "cliente@example.com", project: null, unit: null, responsible: null, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null }, nextStep: "Registrar envío", completedThisYear: false };
const state: OrderAddendum = { schemaVersion: 1, source: "legacy", id: "78", status: "pending", version: 1, changedAt: "2026-11-03T12:00:00.000Z", canUpdate: true };
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(getOrderAddendum).mockResolvedValue(state);
    vi.mocked(updateOrderAddendum).mockResolvedValue({ ...state, status: "completed", version: 2, replayed: false });
});
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

it.each(["native", "legacy"] as const)("shows the order-level marker and actions in both existing views for %s", async (source) => {
    const order = { ...item, source, id: source === "legacy" ? "legacy:78" : "01ARZ3NDEKTSV4RRFFQ69G5FAV" };
    const full = render(<FormalizationOrderRecord item={order} stagePermissions={permissions} onBack={vi.fn()} />);
    const getFullMarker = () => screen.getByRole("button", { name: "Adéndum de la orden" });
    await waitFor(() => expect(getFullMarker()).toHaveTextContent("Pendiente"));
    fireEvent.click(getFullMarker());
    expect(await screen.findByRole("button", { name: "Cancelar adéndum" })).toBeInTheDocument();
    full.unmount();
    render(<FormalizationOrderDrawer item={order} position={1} total={2} onClose={vi.fn()} onSelectPrevious={vi.fn()} onSelectNext={vi.fn()} stagePermissions={permissions} />);
    await waitFor(() => {
        expect(screen.getByRole("button", { name: "Adéndum de la orden" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Adéndum de la orden" }));
    expect(await screen.findByRole("button", { name: "Cancelar adéndum" })).toBeInTheDocument();
    expect(getOrderAddendum).toHaveBeenCalledWith({ source, id: order.id });
    expect(screen.getByRole("link", { name: "Abrir Outlook" })).toBeInTheDocument();
});
it("keeps the complete order readable while hiding its marker without the new read permission", () => {
    render(<FormalizationOrderRecord item={item} stagePermissions={[{ code: "formalizacion.orders.read", effect: "allow" }]} onBack={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Orden de venta LV208" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Adéndum de la orden")).not.toBeInTheDocument();
    expect(getOrderAddendum).not.toHaveBeenCalled();
});
it("places one addendum marker in the full order summary and one in the drawer header", async () => {
    const full = render(<FormalizationOrderRecord item={item} stagePermissions={permissions} canUpdateStage onBack={vi.fn()} />);
    const getFullMarker = () => screen.getByRole("button", { name: "Adéndum de la orden" });
    await waitFor(() => expect(getFullMarker()).toHaveTextContent("Pendiente"));
    expect(within(screen.getByRole("region", { name: "Resumen de la orden" })).getByRole("button", { name: "Adéndum de la orden" })).toBe(getFullMarker());
    expect(getOrderAddendum).toHaveBeenCalledTimes(1);
    full.unmount();
    render(<FormalizationOrderDrawer item={item} position={1} total={1} onClose={vi.fn()} onSelectPrevious={vi.fn()} onSelectNext={vi.fn()} stagePermissions={permissions} />);
    await waitFor(() => {
        expect(screen.getByRole("button", { name: "Adéndum de la orden" })).toHaveTextContent("Pendiente");
    });
    expect(screen.getAllByRole("button", { name: "Adéndum de la orden" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Adéndum de la orden" }).closest(".user-detail-drawer__identity")).not.toBeNull();
    expect(getOrderAddendum).toHaveBeenCalledTimes(2);
});
it.each([null, "completed", "cancelled"] as const)("does not expose pending-only actions for status %s", async (status) => {
    vi.mocked(getOrderAddendum).mockResolvedValue({ ...state, status });
    render(<FormalizationOrderAddendum item={item} permissions={permissions} />);
    await screen.findByText(status === null ? "Sin adéndum" : status === "completed" ? "Completado" : "Cancelado");
    expect(screen.queryByRole("button", { name: "Cancelar adéndum" })).not.toBeInTheDocument();
});
it.each([{ permissions: [] }, { permissions: [...permissions, { code: "formalizacion.orders.read", effect: "deny" }] }])("does not read or expose a marker without effective order read permission", ({ permissions: effective }) => {
    render(<FormalizationOrderAddendum item={item} permissions={effective} />);
    expect(getOrderAddendum).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Adéndum de la orden")).not.toBeInTheDocument();
});
it.each([
    {
        permissions: [
            { code: "formalizacion.orders.read", effect: "allow" },
            { code: "formalizacion.orders.addendum.read", effect: "allow" },
        ],
    },
    { permissions: [...permissions, { code: "formalizacion.orders.addendum.update", effect: "deny" }] },
])("keeps the marker read-only without the dedicated effective permission", async ({ permissions: effective }) => {
    render(<FormalizationOrderAddendum item={item} permissions={effective} />);
    await screen.findByText("Pendiente");
    expect(screen.queryByRole("button", { name: "Cancelar adéndum" })).not.toBeInTheDocument();
});
it("honors the provider authorization even when the UI permission allows updating", async () => {
    vi.mocked(getOrderAddendum).mockResolvedValue({ ...state, canUpdate: false });
    render(<FormalizationOrderAddendum item={item} permissions={permissions} />);
    await screen.findByText("Pendiente");
    expect(screen.queryByRole("button", { name: "Cancelar adéndum" })).not.toBeInTheDocument();
});
it.each(["completed", "cancelled"] as const)("records one %s command with the canonical identity/version despite a double click", async (status) => {
    const onChanged = vi.fn();
    let resolve: (value: OrderAddendum & { replayed: boolean }) => void = () => {};
    vi.mocked(updateOrderAddendum).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    render(<FormalizationOrderAddendum item={item} permissions={permissions} onChanged={onChanged} />);
    const button = await screen.findByRole("button", { name: status === "completed" ? "Marcar adéndum como completado" : "Cancelar adéndum" });
    act(() => {
        fireEvent.click(button);
        fireEvent.click(button);
    });
    expect(updateOrderAddendum).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateOrderAddendum).mock.calls[0]?.[0]).toMatchObject({ source: "legacy", id: "78", status, expectedVersion: 1 });
    await act(async () => {
        resolve({ ...state, status, version: 2, replayed: false });
        await Promise.resolve();
    });
    expect(await screen.findByText(status === "completed" ? "Completado" : "Cancelado")).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalledTimes(1);
});
it("keeps a confirmed change confirmed when refreshing the parent fails", async () => {
    const onChanged = vi.fn().mockRejectedValue(new Error("private refresh details"));
    render(<FormalizationOrderAddendum item={item} permissions={permissions} onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: "Marcar adéndum como completado" }));
    expect(await screen.findByText("Completado")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Cambio guardado");
    expect(screen.getByRole("alert")).not.toHaveTextContent("private");
    expect(screen.queryByRole("button", { name: "Reintentar el mismo cambio" })).not.toBeInTheDocument();
    expect(updateOrderAddendum).toHaveBeenCalledTimes(1);
});
it("retries uncertain writes with exactly the same operation instead of allowing another target", async () => {
    const onChanged = vi.fn();
    vi.mocked(updateOrderAddendum).mockRejectedValueOnce(new Error("private transport details"));
    vi.mocked(updateOrderAddendum).mockResolvedValueOnce({ ...state, status: "completed", version: 2, replayed: true });
    render(<FormalizationOrderAddendum item={item} permissions={permissions} onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: "Marcar adéndum como completado" }));
    expect(await screen.findByRole("alert")).not.toHaveTextContent("private transport");
    expect(screen.getByRole("button", { name: "Cancelar adéndum" })).toBeDisabled();
    expect(onChanged).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar el mismo cambio" }));
    await screen.findByText("Completado");
    expect(vi.mocked(updateOrderAddendum).mock.calls[1]?.[0]).toEqual(vi.mocked(updateOrderAddendum).mock.calls[0]?.[0]);
    await waitFor(() => {
        expect(onChanged).toHaveBeenCalledTimes(1);
    });
});
it("requires a fresh read after a conflict and never silently replays a stale change", async () => {
    const onChanged = vi.fn();
    vi.mocked(updateOrderAddendum).mockRejectedValueOnce(new ApiClientError("secret conflict", 409, {}));
    render(<FormalizationOrderAddendum item={item} permissions={permissions} onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancelar adéndum" }));
    expect(await screen.findByRole("alert")).not.toHaveTextContent("secret conflict");
    expect(screen.queryByRole("button", { name: "Cancelar adéndum" })).not.toBeInTheDocument();
    vi.mocked(getOrderAddendum).mockResolvedValueOnce({ ...state, status: "completed", version: 3 });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar adéndum" }));
    await screen.findByText("Completado");
    expect(updateOrderAddendum).toHaveBeenCalledTimes(1);
    expect(onChanged).not.toHaveBeenCalled();
});
it("does not notify another order after a stale confirmed response", async () => {
    const onChanged = vi.fn();
    let resolve: (value: OrderAddendum & { replayed: boolean }) => void = () => {};
    vi.mocked(updateOrderAddendum).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    const mounted = render(<FormalizationOrderAddendum item={item} permissions={permissions} onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: "Marcar adéndum como completado" }));
    vi.mocked(getOrderAddendum).mockResolvedValueOnce({ ...state, id: "79" });
    mounted.rerender(<FormalizationOrderAddendum item={{ ...item, id: "legacy:79" }} permissions={permissions} onChanged={onChanged} />);
    await screen.findByText("Pendiente");
    await act(async () => {
        resolve({ ...state, status: "completed", version: 2, replayed: false });
        await Promise.resolve();
    });
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
});
it("reloads the marker after a calendar close refresh and ignores stale reads after changing order", async () => {
    let resolve: (value: OrderAddendum) => void = () => {};
    vi.mocked(getOrderAddendum).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    const view = render(<FormalizationOrderAddendum item={item} permissions={permissions} />);
    vi.mocked(getOrderAddendum).mockResolvedValueOnce({ ...state, id: "79", status: "cancelled", version: 3 });
    view.rerender(<FormalizationOrderAddendum item={{ ...item, id: "legacy:79" }} permissions={permissions} />);
    await screen.findByText("Cancelado");
    await act(async () => {
        resolve(state);
        await Promise.resolve();
    });
    expect(screen.queryByText("Pendiente")).not.toBeInTheDocument();
    vi.mocked(getOrderAddendum).mockResolvedValueOnce({ ...state, id: "79", status: "pending", version: 4 });
    view.rerender(<FormalizationOrderAddendum item={{ ...item, id: "legacy:79" }} permissions={permissions} refreshVersion={1} />);
    await screen.findByText("Pendiente");
    await waitFor(() => {
        expect(getOrderAddendum).toHaveBeenCalledTimes(3);
    });
});

it("allows a reader to record sent without exposing completion/cancellation", async () => {
    vi.mocked(getOrderAddendum).mockResolvedValue({ ...state, canUpdate: false, canMarkSent: true });
    vi.mocked(markOrderAddendumSent).mockResolvedValue({ ...state, status: "sent", version: 2, canUpdate: false, canMarkSent: true, replayed: false });
    render(<FormalizationOrderAddendum item={item} permissions={permissions.filter((p) => p.code !== "formalizacion.orders.addendum.update")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Marcar adéndum como enviado" }));
    await screen.findByText("Enviado");
    expect(markOrderAddendumSent).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Cancelar adéndum" })).not.toBeInTheDocument();
    expect(updateOrderAddendum).not.toHaveBeenCalled();
});
it("allows completion after sent with the existing update capability", async () => {
    vi.mocked(getOrderAddendum).mockResolvedValue({ ...state, status: "sent", canMarkSent: true });
    render(<FormalizationOrderAddendum item={item} permissions={permissions} />);
    fireEvent.click(await screen.findByRole("button", { name: "Marcar adéndum como completado" }));
    await waitFor(() => {
        expect(updateOrderAddendum).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole("button", { name: "Marcar adéndum como enviado" })).not.toBeInTheDocument();
});

it("retries a reader sent operation with the identical command and no update request", async () => {
    vi.mocked(getOrderAddendum).mockResolvedValue({ ...state, canUpdate: false, canMarkSent: true });
    vi.mocked(markOrderAddendumSent)
        .mockRejectedValueOnce(new Error("transport"))
        .mockResolvedValueOnce({ ...state, status: "sent", version: 2, canUpdate: false, replayed: true });
    render(<FormalizationOrderAddendum item={item} permissions={permissions.filter((p) => p.code !== "formalizacion.orders.addendum.update")} />);
    fireEvent.click(await screen.findByRole("button", { name: /como enviado/ }));
    await screen.findByRole("alert");
    expect(markOrderAddendumSent).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar el mismo cambio" }));
    await screen.findByText("Enviado");
    expect(vi.mocked(markOrderAddendumSent).mock.calls[1]?.[0]).toEqual(vi.mocked(markOrderAddendumSent).mock.calls[0]?.[0]);
    expect(updateOrderAddendum).not.toHaveBeenCalled();
});
it("does not offer sent when the API capability is absent", async () => {
    render(<FormalizationOrderAddendum item={item} permissions={permissions} />);
    await screen.findByText("Pendiente");
    expect(screen.queryByRole("button", { name: /como enviado/ })).not.toBeInTheDocument();
});
