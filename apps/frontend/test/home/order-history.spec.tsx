import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationOrderHistoryDrawer } from "../../src/modules/home/FormalizationOrderHistoryDrawer";
import { FormalizationRecordSummary } from "../../src/modules/home/FormalizationRecordSummary";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { getOrderHistory, type OrderHistoryPage } from "../../src/services/formalization/order-history-service";
import { getOrderUnitDetail } from "../../src/services/formalization/order-unit-service";
import { installBrowserApiDoubles } from "../support/browser";
vi.mock("../../src/services/formalization/order-history-service", () => ({ getOrderHistory: vi.fn() }));
vi.mock("../../src/services/formalization/order-unit-service", () => ({ getOrderUnitDetail: vi.fn() }));
const order: FollowUpItem = { id: "legacy:208", source: "legacy", number: "RDR673", nativeCode: null, client: "Cliente", project: { id: "project", name: "BC Lofts" }, unit: "BC-L Edif#2 FF117", responsible: null, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null }, nextStep: "Registrar envío", completedThisYear: false };
const page: OrderHistoryPage = {
    schemaVersion: 1,
    source: "legacy",
    hasMore: false,
    nextCursor: null,
    coverage: { legacyAvailable: true, legacyLinked: true, note: "Solo acciones registradas" },
    items: [
        {
            id: "audit:1",
            source: "native",
            action: "state_change",
            label: "Cambio de etapa",
            reason: "Cambio confirmado",
            occurredAt: "2026-10-27T16:00:00.000Z",
            recordedAt: "2026-10-27T16:00:00.000Z",
            actorName: "Ana",
            fromState: "contract_pending_send",
            toState: "contract_pending_signature",
            fromStateLabel: "Por enviar",
            toStateLabel: "Pendiente de firma",
            snapshotScope: "partial",
            hiddenChanges: 0,
            changes: [{ field: "state", before: "contract_pending_send", after: "contract_pending_signature", beforeExists: true, afterExists: true }],
        },
    ],
};
beforeEach(() => {
    installBrowserApiDoubles();
    vi.resetAllMocks();
    vi.mocked(getOrderHistory).mockResolvedValue(page);
    vi.mocked(getOrderUnitDetail).mockResolvedValue({ groups: [{ title: "Unidad", fields: [{ label: "Código", value: "BC-L Edif#2 FF117" }] }], warnings: [] });
});
afterEach(cleanup);
it("loads history only after its button is clicked and shows actor, reason and transition", async () => {
    render(<FormalizationRecordSummary item={order} />);
    expect(getOrderHistory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ver bitácora de la orden" }));
    await screen.findByText("Cambio confirmado");
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Pendiente de firma")).toBeInTheDocument();
    expect(getOrderHistory).toHaveBeenCalledExactlyOnceWith({ source: "legacy", id: "legacy:208" });
});
it("opens the selected unit via Proyecto·Unidad without loading the history", async () => {
    render(<FormalizationRecordSummary item={order} />);
    fireEvent.click(screen.getByRole("button", { name: "Ver expediente de unidad BC-L Edif#2 FF117" }));
    await screen.findByText("Código");
    expect(getOrderUnitDetail).toHaveBeenCalledExactlyOnceWith({ source: "legacy", id: "legacy:208" });
    expect(getOrderHistory).not.toHaveBeenCalled();
});
it("paginates and deduplicates events", async () => {
    const first = page.items[0];
    if (!first) throw new Error("Missing test event");
    vi.mocked(getOrderHistory)
        .mockResolvedValueOnce({ ...page, hasMore: true, nextCursor: "cursor" })
        .mockResolvedValueOnce({ ...page, items: [...page.items, { ...first, id: "audit:2", reason: "Edición nueva" }] });
    render(<FormalizationOrderHistoryDrawer item={order} open onClose={() => {}} />);
    await screen.findByText("Cambio confirmado");
    fireEvent.click(screen.getByRole("button", { name: "Cargar más registros" }));
    await screen.findByText("Edición nueva");
    expect(screen.getAllByText("Cambio confirmado")).toHaveLength(1);
    expect(getOrderHistory).toHaveBeenLastCalledWith({ source: "legacy", id: "legacy:208" }, "cursor");
});
it("shows loading, an error with retry, and an honest empty history", async () => {
    vi.mocked(getOrderHistory)
        .mockRejectedValueOnce(new Error("private details"))
        .mockResolvedValueOnce({ ...page, items: [] });
    render(<FormalizationOrderHistoryDrawer item={order} open onClose={() => {}} />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(await screen.findByRole("alert")).not.toHaveTextContent("private details");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByText(/No hay acciones registradas/);
});
it("ignores a stale response after selecting another order", async () => {
    let finish!: (page: OrderHistoryPage) => void;
    vi.mocked(getOrderHistory).mockReturnValueOnce(
        new Promise((resolve) => {
            finish = resolve;
        }),
    );
    const view = render(<FormalizationOrderHistoryDrawer item={order} open onClose={() => {}} />);
    vi.mocked(getOrderHistory).mockResolvedValueOnce({ ...page, items: [] });
    view.rerender(<FormalizationOrderHistoryDrawer item={{ ...order, id: "legacy:209" }} open onClose={() => {}} />);
    await screen.findByText(/No hay acciones registradas/);
    finish(page);
    await waitFor(() => {
        expect(screen.queryByText("Cambio confirmado")).not.toBeInTheDocument();
    });
});
