import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationUnitDrawer } from "../../src/modules/home/FormalizationUnitDrawer";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { getOrderUnitDetail } from "../../src/services/formalization/order-unit-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/formalization/order-unit-service", () => ({ getOrderUnitDetail: vi.fn() }));
const order: FollowUpItem = { id: "legacy:208", source: "legacy", number: "RDR673", nativeCode: null, client: "Cliente seleccionado", project: null, unit: null, responsible: null, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null }, nextStep: "Registrar envío", completedThisYear: false };
const detail = { name: "Cliente seleccionado", groups: [{ title: "Contacto", fields: [{ label: "Correo", value: "cliente@example.com" }] }], warnings: [] };
beforeEach(() => {
    installBrowserApiDoubles();
    vi.resetAllMocks();
    vi.mocked(getOrderUnitDetail).mockResolvedValue(detail);
});
afterEach(cleanup);
it("shows a preload without example data", () => {
    vi.mocked(getOrderUnitDetail).mockReturnValue(new Promise(() => {}));
    render(<FormalizationUnitDrawer item={order} open onClose={() => {}} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("cliente@example.com")).not.toBeInTheDocument();
});
it("offers retry after an authorized endpoint error without revealing private errors", async () => {
    vi.mocked(getOrderUnitDetail).mockRejectedValueOnce(new Error("private error"));
    render(<FormalizationUnitDrawer item={order} open onClose={() => {}} />);
    expect(await screen.findByRole("alert")).not.toHaveTextContent("private error");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText("cliente@example.com");
    expect(getOrderUnitDetail).toHaveBeenCalledTimes(2);
});
it("does not select another client when the relationship is ambiguous", async () => {
    vi.mocked(getOrderUnitDetail).mockResolvedValue({ ...detail, warnings: ["unitFile:ambiguous"] });
    render(<FormalizationUnitDrawer item={order} open onClose={() => {}} />);
    await screen.findByText(/relación con la unidad no está disponible o es ambigua/);
    expect(screen.queryByText("cliente@example.com")).not.toBeInTheDocument();
});
it("ignores a late response when a different order is selected", async () => {
    let resolve!: (value: typeof detail) => void;
    vi.mocked(getOrderUnitDetail).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    const view = render(<FormalizationUnitDrawer item={order} open onClose={() => {}} />);
    vi.mocked(getOrderUnitDetail).mockResolvedValueOnce({ ...detail, groups: [{ title: "Contacto", fields: [{ label: "Correo", value: "otro@example.com" }] }] });
    view.rerender(<FormalizationUnitDrawer item={{ ...order, id: "legacy:214" }} open onClose={() => {}} />);
    await screen.findByText("otro@example.com");
    resolve(detail);
    await waitFor(() => {
        expect(screen.queryByText("cliente@example.com")).not.toBeInTheDocument();
    });
});

it("reads only while open and refreshes on reopening", async () => {
    const view = render(<FormalizationUnitDrawer item={order} open={false} onClose={() => {}} />);
    expect(getOrderUnitDetail).not.toHaveBeenCalled();
    view.rerender(<FormalizationUnitDrawer item={order} open onClose={() => {}} />);
    await screen.findByText("cliente@example.com");
    view.rerender(<FormalizationUnitDrawer item={order} open={false} onClose={() => {}} />);
    view.rerender(<FormalizationUnitDrawer item={order} open onClose={() => {}} />);
    await waitFor(() => {
        expect(getOrderUnitDetail).toHaveBeenCalledTimes(2);
    });
});
it("renders untrusted plans as text and delegates closing", async () => {
    const onClose = vi.fn();
    vi.mocked(getOrderUnitDetail).mockResolvedValue({ groups: [{ title: "Planos", fields: [{ label: "Planos", value: "<iframe src='https://example.com' />" }] }], warnings: [] });
    render(<FormalizationUnitDrawer item={order} open onClose={onClose} />);
    await screen.findByText("<iframe src='https://example.com' />");
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle de la unidad" }));
    expect(onClose).toHaveBeenCalledOnce();
});

it("ignores a stale rejection after changing the selected order", async () => {
    let reject!: (reason: Error) => void;
    vi.mocked(getOrderUnitDetail).mockReturnValueOnce(
        new Promise((_resolve, fail) => {
            reject = fail;
        }),
    );
    const view = render(<FormalizationUnitDrawer item={order} open onClose={() => {}} />);
    view.rerender(<FormalizationUnitDrawer item={{ ...order, source: "native", id: "other" }} open onClose={() => {}} />);
    await screen.findByText("cliente@example.com");
    reject(new Error("stale"));
    await waitFor(() => {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});

it.each(["https://rocca.box.com/s/example", "invalid", "Sin dato"])("renders the expediente safely: %s", async (value) => {
    vi.mocked(getOrderUnitDetail).mockResolvedValue({ groups: [{ title: "Planos", fields: [{ label: "Planos de la unidad (referencia de origen)", value, kind: "expediente" }] }], warnings: [] });
    render(<FormalizationUnitDrawer item={order} open onClose={() => {}} />);
    if (value.startsWith("https://")) {
        expect(await screen.findByRole("link", { name: "Ver expediente" })).toHaveAttribute("href", value);
    } else {
        expect(await screen.findByText(value === "Sin dato" ? "—" : value)).toBeInTheDocument();
        expect(screen.queryByRole("link")).toBeNull();
    }
});
