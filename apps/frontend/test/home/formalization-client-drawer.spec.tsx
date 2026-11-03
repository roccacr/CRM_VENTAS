import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationClientDrawer } from "../../src/modules/home/FormalizationClientDrawer";
import { FormalizationRecordSummary } from "../../src/modules/home/FormalizationRecordSummary";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { getOrderClientDetail } from "../../src/services/formalization/order-client-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/formalization/order-client-service", () => ({ getOrderClientDetail: vi.fn() }));
const order: FollowUpItem = { id: "legacy:208", source: "legacy", number: "RDR673", nativeCode: null, client: "Cliente seleccionado", project: null, unit: null, responsible: null, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null }, nextStep: "Registrar envío", completedThisYear: false };
const detail = { name: "Cliente seleccionado", groups: [{ title: "Contacto", fields: [{ label: "Correo", value: "cliente@example.com" }] }], warnings: [] };
beforeEach(() => {
    installBrowserApiDoubles();
    vi.resetAllMocks();
    vi.mocked(getOrderClientDetail).mockResolvedValue(detail);
});
afterEach(cleanup);
it("opens the shared side drawer only on a client click and requests the selected order identity", async () => {
    render(<FormalizationRecordSummary item={order} />);
    expect(getOrderClientDetail).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ver cliente Cliente seleccionado" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await screen.findByText("cliente@example.com");
    expect(getOrderClientDetail).toHaveBeenCalledExactlyOnceWith({ source: "legacy", id: "legacy:208" });
    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle del cliente" }));
    await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
});
it("shows a preload without example data", () => {
    vi.mocked(getOrderClientDetail).mockReturnValue(new Promise(() => {}));
    render(<FormalizationClientDrawer item={order} open onClose={() => {}} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("cliente@example.com")).not.toBeInTheDocument();
});
it("offers retry after an authorized endpoint error without revealing private errors", async () => {
    vi.mocked(getOrderClientDetail).mockRejectedValueOnce(new Error("private error"));
    render(<FormalizationClientDrawer item={order} open onClose={() => {}} />);
    expect(await screen.findByRole("alert")).not.toHaveTextContent("private error");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("cliente@example.com");
    expect(getOrderClientDetail).toHaveBeenCalledTimes(2);
});
it("does not select another client when the relationship is ambiguous", async () => {
    vi.mocked(getOrderClientDetail).mockResolvedValue({ ...detail, warnings: ["lead:ambiguous"] });
    render(<FormalizationClientDrawer item={order} open onClose={() => {}} />);
    await screen.findByText(/relación con el cliente no está disponible o es ambigua/);
    expect(screen.queryByText("cliente@example.com")).not.toBeInTheDocument();
});
it("ignores a late response when a different order is selected", async () => {
    let resolve!: (value: typeof detail) => void;
    vi.mocked(getOrderClientDetail).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    const view = render(<FormalizationClientDrawer item={order} open onClose={() => {}} />);
    vi.mocked(getOrderClientDetail).mockResolvedValueOnce({ ...detail, groups: [{ title: "Contacto", fields: [{ label: "Correo", value: "otro@example.com" }] }] });
    view.rerender(<FormalizationClientDrawer item={{ ...order, id: "legacy:214" }} open onClose={() => {}} />);
    await screen.findByText("otro@example.com");
    resolve(detail);
    await waitFor(() => {
        expect(screen.queryByText("cliente@example.com")).not.toBeInTheDocument();
    });
});
it("does not offer an opening action if the client is missing", () => {
    render(<FormalizationRecordSummary item={{ ...order, client: null }} />);
    expect(screen.queryByRole("button", { name: /^Ver cliente/ })).not.toBeInTheDocument();
    expect(getOrderClientDetail).not.toHaveBeenCalled();
});
it("oculta el perfil sin permiso y enlaza por la identidad del lead cuando está permitido", async () => {
    vi.mocked(getOrderClientDetail).mockResolvedValue({ ...detail, leadIdentity: { source: "legacy", id: "12" } });
    const view = render(<FormalizationClientDrawer item={order} open onClose={() => {}} />);
    await screen.findByText("cliente@example.com");
    expect(screen.queryByRole("link", { name: "Ver perfil del cliente" })).not.toBeInTheDocument();
    view.rerender(<FormalizationClientDrawer item={order} open onClose={() => {}} effectivePermissions={[{ code: "lead.profile.read", effect: "allow" }]} />);
    expect(screen.getByRole("link", { name: "Ver perfil del cliente" })).toHaveAttribute("href", "/perfil?source=legacy&id=12");
    view.rerender(
        <FormalizationClientDrawer
            item={order}
            open
            onClose={() => {}}
            effectivePermissions={[
                { code: "lead.profile.read", effect: "allow" },
                { code: "lead.profile.read", effect: "deny" },
            ]}
        />,
    );
    expect(screen.queryByRole("link", { name: "Ver perfil del cliente" })).not.toBeInTheDocument();
});

it.each([
    { source: "legacy" as const, id: "12", permissionSource: "role" },
    { source: "legacy" as const, id: "12", permissionSource: "override" },
    { source: "native" as const, id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", permissionSource: "role" },
    { source: "native" as const, id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", permissionSource: "override" },
])("enlaza el lead $source con permiso efectivo $permissionSource", async ({ source, id, permissionSource }) => {
    vi.mocked(getOrderClientDetail).mockResolvedValue({ ...detail, leadIdentity: { source, id } });
    const permissions = [{ code: "lead.profile.read", effect: "allow", source: permissionSource }];
    render(<FormalizationClientDrawer item={order} open onClose={() => {}} effectivePermissions={permissions} />);
    expect(await screen.findByRole("link", { name: "Ver perfil del cliente" })).toHaveAttribute("href", `/perfil?source=${source}&id=${id}`);
});

it("reserva el historial y los datos comerciales para la página de perfil, fuera de la orden", async () => {
    const entry = { id: "legacy:1", source: "legacy", action: "Seguimiento", detail: "Nota histórica", reason: { code: "legacy:58", name: "Cierre Firmado" }, actorName: null, actorCoverage: "current_directory", occurredAt: null, sourceDate: "2026-10-01 10:00:00", recordedAt: null, evidence: "legacy_observation", fromStatus: null, toStatus: null };
    const groups = [...detail.groups, { title: "Información comercial", fields: [{ label: "Proyecto", value: "Proyecto exclusivo del perfil" }] }, { title: "Captación y seguimiento", fields: [{ label: "Campaña", value: "Campaña exclusiva del perfil" }] }];
    vi.mocked(getOrderClientDetail)
        .mockResolvedValueOnce({ ...detail, groups, history: { items: [entry], hasMore: true, nextCursor: "cursor" } })
        .mockResolvedValueOnce({ ...detail, groups, history: { items: [entry, { ...entry, id: "native:2", source: "native", detail: "Cambio nuevo", actorName: "Ana", actorCoverage: "at_event" }], hasMore: false, nextCursor: null } });
    render(<FormalizationClientDrawer item={order} open onClose={() => {}} />);
    await screen.findByText("Nota histórica");
    expect(screen.getByText("Cierre Firmado")).toBeInTheDocument();
    expect(screen.getByText("Responsable no registrado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cargar más registros" }));
    await screen.findByText("Cambio nuevo");
    expect(screen.getAllByText("Nota histórica")).toHaveLength(1);
    expect(getOrderClientDetail).toHaveBeenLastCalledWith({ source: "legacy", id: "legacy:208" }, "cursor");
    expect(screen.queryByRole("button", { name: "Cargar más registros" })).not.toBeInTheDocument();
});
