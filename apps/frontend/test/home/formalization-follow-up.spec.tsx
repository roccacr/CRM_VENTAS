import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationFollowUpPreview } from "../../src/modules/home/FormalizationFollowUpPreview";
import { FormalizationHomePage } from "../../src/modules/home/FormalizationHomePage";
import { apiRequest } from "../../src/services/api/api-client";
import { installBrowserApiDoubles } from "../support/browser";
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
const payload = (number = "OV-REAL") => ({
    schemaVersion: 1,
    observedAt: "2026-10-26T12:00:00Z",
    filters: { search: "", projectId: "", queue: "all" },
    page: { number: 1, size: 25, total: 26, totalPages: 2 },
    counts: { all: 26, approvals: 2, contracts: 4, send: 3, signature: 1, bank: 0, balance: 0, transfer: 0, signed: 0, closed: 0 },
    projects: [{ id: "legacy-project:7", name: "Proyecto real" }],
    items: [{ id: number, source: "native", number, nativeCode: null, client: "Cliente real", project: null, unit: null, responsible: null, state: { code: "whatever", label: "Etiqueta del servidor", since: null, days: null }, nextStep: "Acción del servidor", completedThisYear: false }],
    sources: { native: { total: 26 }, legacy: { total: 0, enabled: true } },
});
const role = { code: "formalizacion", name: "Formalización", status: "active" as const };
const allow = { code: "formalizacion.home.stages.read", effect: "allow" as const };
const props = { enabled: true, tableOnly: false, scope: { filter: "all" as const }, onOpenOrder: vi.fn() };
const reads = () => vi.mocked(apiRequest).mock.calls.filter(([path]) => path.startsWith("/formalization/home/follow-up"));
beforeEach(() => {
    installBrowserApiDoubles();
    vi.stubEnv("DEV", false);
    vi.mocked(apiRequest).mockReset().mockResolvedValue(payload());
    props.onOpenOrder.mockClear();
});
afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllEnvs();
});
it("reports a source failure with retry instead of a zero or unavailable fixture", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new Error("offline"));
    render(<FormalizationFollowUpPreview {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar seguimiento" }));
    expect(screen.queryByText("0 órdenes")).toBeNull();
    await screen.findByText("OV-REAL");
    expect(reads()).toHaveLength(2);
});
it("renders canonical rows read-only, returned counts and nullable values", async () => {
    render(<FormalizationFollowUpPreview {...props} />);
    const row = await screen.findByText("OV-REAL");
    fireEvent.click(row);
    expect(props.onOpenOrder).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Ver seguimiento/ })).toBeNull();
    // The row opens a read-only side panel that repeats these values, so the table is queried on its own.
    const table = within(screen.getByRole("region", { name: "Órdenes filtradas" }));
    expect(table.getByText("Etiqueta del servidor")).toBeTruthy();
    expect(table.getByText("Acción del servidor")).toBeTruthy();
    expect(screen.getByText("Tiempo no disponible")).toBeTruthy();
    expect(screen.getByRole("option", { name: "Todas (26)" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Pendientes de aprobación/ })).toBeNull();
});
it("shares StrictMode replay and refreshes the visible consumer", async () => {
    const { rerender } = render(
        <StrictMode>
            <FormalizationFollowUpPreview {...props} />
        </StrictMode>,
    );
    await screen.findByText("OV-REAL");
    expect(reads()).toHaveLength(1);
    rerender(
        <StrictMode>
            <FormalizationFollowUpPreview {...props} refreshVersion={1} />
        </StrictMode>,
    );
    await waitFor(() => {
        expect(reads()).toHaveLength(2);
    });
});
it("sends queue, project and page changes to the server", async () => {
    render(<FormalizationFollowUpPreview {...props} canViewApprovals />);
    await screen.findByText("OV-REAL");
    fireEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => {
        expect(reads().at(-1)?.[0]).toContain("page=2");
    });
    fireEvent.change(screen.getByLabelText("Filtrar por proyecto"), { target: { value: "legacy-project:7" } });
    await waitFor(() => {
        expect(reads().at(-1)?.[0]).toContain("projectId=legacy-project%3A7&queue=all&page=1");
    });
    fireEvent.change(screen.getByLabelText("Bandeja de seguimiento"), { target: { value: "approvals" } });
    await waitFor(() => {
        expect(reads().at(-1)?.[0]).toContain("queue=approvals");
    });
});
it("debounces search for 300ms and hides previous results immediately", async () => {
    render(<FormalizationFollowUpPreview {...props} />);
    await screen.findByText("OV-REAL");
    vi.useFakeTimers();
    fireEvent.change(screen.getByLabelText("Buscar operación"), { target: { value: "new" } });
    expect(screen.queryByText("OV-REAL")).toBeNull();
    await act(async () => {
        await vi.advanceTimersByTimeAsync(299);
    });
    expect(reads()).toHaveLength(1);
    await act(async () => {
        await vi.advanceTimersByTimeAsync(1);
    });
    expect(reads()).toHaveLength(2);
    expect(reads().at(-1)?.[0]).toContain("search=new");
});
it("ignores stale results after a new load and after revocation", async () => {
    let finish: (value: unknown) => void = () => {};
    vi.mocked(apiRequest).mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    );
    const { rerender } = render(<FormalizationFollowUpPreview {...props} />);
    fireEvent.change(screen.getByLabelText("Bandeja de seguimiento"), { target: { value: "bank" } });
    await screen.findByText("OV-REAL");
    await act(async () => {
        finish(payload("STALE"));
        await Promise.resolve();
    });
    expect(screen.queryByText("STALE")).toBeNull();
    rerender(<FormalizationFollowUpPreview {...props} enabled={false} />);
    expect(screen.queryByText("OV-REAL")).toBeNull();
    expect(reads()).toHaveLength(2);
});
it("shows a successful empty result with zero rather than an error", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ...payload(), items: [], page: { number: 1, size: 25, total: 0, totalPages: 0 } });
    render(<FormalizationFollowUpPreview {...props} />);
    await screen.findByText("No hay órdenes para estos filtros.");
    expect(screen.getByText("0 órdenes")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
});
it("gates Home reads by active role and allow without deny, and removes revoked rows", async () => {
    const { rerender } = render(<FormalizationHomePage />);
    expect(reads()).toHaveLength(0);
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[allow, { ...allow, effect: "deny" }]} />);
    expect(reads()).toHaveLength(0);
    rerender(<FormalizationHomePage roles={[{ ...role, status: "inactive" }]} effectivePermissions={[allow]} />);
    expect(reads()).toHaveLength(0);
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[allow]} />);
    await screen.findByText("OV-REAL");
    expect(reads()).toHaveLength(1);
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[]} />);
    expect(screen.queryByText("OV-REAL")).toBeNull();
});
it("mounts only the visible Home or queue consumer and refreshes the list with banners", async () => {
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[allow]} />);
    await screen.findByText("OV-REAL");
    fireEvent.click(screen.getByRole("button", { name: "Recargar banners" }));
    await waitFor(() => {
        expect(reads()).toHaveLength(2);
    });
    fireEvent.click(screen.getByRole("button", { name: "Ver todas las órdenes" }));
    await waitFor(() => {
        expect(reads()).toHaveLength(3);
    });
    expect(screen.getAllByText("OV-REAL")).toHaveLength(1);
});
it("direct Orders entry has a single follow-up request", async () => {
    render(<FormalizationHomePage initialView="orders" roles={[role]} effectivePermissions={[allow]} />);
    await screen.findByText("OV-REAL");
    expect(reads()).toHaveLength(1);
});
it("fences a new load when returning to a previously completed filter", async () => {
    render(<FormalizationFollowUpPreview {...props} />);
    await screen.findByText("OV-REAL");
    vi.mocked(apiRequest).mockImplementation(() => new Promise(() => {}));
    fireEvent.change(screen.getByLabelText("Bandeja de seguimiento"), { target: { value: "bank" } });
    fireEvent.change(screen.getByLabelText("Bandeja de seguimiento"), { target: { value: "all" } });
    expect(screen.queryByText("OV-REAL")).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
});
it("keeps salesperson separate when stage responsibility is unknown", async () => {
    const data = payload();
    vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((item) => ({ ...item, seller: { id: "seller", name: "Ana" }, changedBy: { id: "author", name: "Luis" } })) });
    render(<FormalizationFollowUpPreview {...props} />);
    await screen.findByText("Sin responsable registrado");
    expect(screen.getByText("Vendedor: Ana")).toBeTruthy();
    expect(screen.getByText("Autor del cambio: Luis")).toBeTruthy();
    expect(screen.getByText("Tiempo no disponible")).toBeTruthy();
});
it.each([true, false])("shows the change author only when different from responsibility: %s", async (same) => {
    const data = payload();
    vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((item) => ({ ...item, responsible: { id: "owner", name: "Responsable etapa" }, seller: { id: "seller", name: "Ana" }, changedBy: { id: same ? "owner" : "author", name: same ? "Responsable etapa" : "Luis" } })) });
    render(<FormalizationFollowUpPreview {...props} />);
    await screen.findByText("Responsable etapa");
    expect(screen.getByText("Vendedor: Ana")).toBeTruthy();
    expect(screen.queryByText(/^Autor del cambio:/) !== null).toBe(!same);
});
it.each([false, true])("Home passes update permission, deny wins: %s", async (denied) => {
    const data = payload();
    vi.mocked(apiRequest).mockResolvedValue({ ...data, items: data.items.map((entry) => ({ ...entry, approvalsComplete: true, stateVersion: 0 })) });
    const update = { code: "formalizacion.orders.stage.update", effect: "allow" as const };
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[allow, update, ...(denied ? [{ ...update, effect: "deny" as const }] : [])]} />);
    fireEvent.click(await screen.findByText("OV-REAL"));
    const select = await screen.findByRole("combobox", { name: "Etapa de Formalización" });
    expect(select.hasAttribute("disabled")).toBe(denied);
});
it("saving a live drawer closes it and refreshes list and Home banners", async () => {
    const data = payload();
    vi.mocked(apiRequest).mockImplementation((path) => {
        if (path === "/formalization/orders/stage") return Promise.resolve({ source: "native", id: "OV-REAL", state: "contract_pending_signature", sequence: 1, replayed: false });
        return Promise.resolve({ ...data, items: data.items.map((entry) => ({ ...entry, approvalsComplete: true, stateVersion: 0, state: { ...entry.state, code: "contract_pending_send", label: "Por enviar" } })) });
    });
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[allow, { code: "formalizacion.orders.stage.update", effect: "allow" }]} />);
    fireEvent.click(await screen.findByText("OV-REAL"));
    fireEvent.change(await screen.findByRole("combobox", { name: "Etapa de Formalización" }), { target: { value: "contract_pending_signature" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    const summaryReads = () => vi.mocked(apiRequest).mock.calls.filter(([path]) => path === "/formalization/home/summary").length;
    const before = summaryReads();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => {
        expect(reads().length).toBeGreaterThan(1);
        expect(summaryReads()).toBeGreaterThan(before);
    });
    await waitFor(() => {
        expect(screen.queryByRole("combobox", { name: "Etapa de Formalización" })).toBeNull();
    });
});

it.each(["native", "legacy"])("opens Outlook addressed to the %s client only while pending send", async (source) => {
    const data = payload();
    Object.assign(data.items[0] ?? {}, { source, clientEmail: "cliente+contrato@example.com", state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null } });
    vi.mocked(apiRequest).mockResolvedValue(data);
    render(<FormalizationFollowUpPreview {...props} />);
    fireEvent.click(await screen.findByText("OV-REAL"));
    const link = await screen.findByRole("link", { name: "Abrir Outlook" });
    expect(new URL(link.getAttribute("href") ?? "").searchParams.get("to")).toBe("cliente+contrato@example.com");
    expect(link.getAttribute("target")).toBe("_blank");
});
it.each([null, "", "cliente@example.com\r\nBcc:otro@example.com"])("does not compose with missing or invalid client email %s", async (clientEmail) => {
    const data = payload();
    Object.assign(data.items[0] ?? {}, { clientEmail, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null } });
    vi.mocked(apiRequest).mockResolvedValue(data);
    render(<FormalizationFollowUpPreview {...props} />);
    fireEvent.click(await screen.findByText("OV-REAL"));
    expect(screen.queryByRole("link", { name: "Abrir Outlook" })).toBeNull();
    expect(screen.getByText("Correo del cliente no disponible")).toBeTruthy();
});
it("hides Outlook in other stages even with a client email", async () => {
    const data = payload();
    Object.assign(data.items[0] ?? {}, { clientEmail: "cliente@example.com" });
    vi.mocked(apiRequest).mockResolvedValue(data);
    render(<FormalizationFollowUpPreview {...props} />);
    fireEvent.click(await screen.findByText("OV-REAL"));
    expect(screen.queryByRole("link", { name: "Abrir Outlook" })).toBeNull();
});

it("opens the real order in the complete page and returns with the current filters intact", async () => {
    const data = payload("OV-COMPLETA");
    Object.assign(data.items[0] ?? {}, { clientEmail: "real@example.com", approvalsComplete: true, stateVersion: 0, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null } });
    vi.mocked(apiRequest).mockResolvedValue(data);
    render(<FormalizationFollowUpPreview {...props} canUpdateStage />);
    fireEvent.change(screen.getByLabelText("Bandeja de seguimiento"), { target: { value: "send" } });
    await waitFor(() => {
        expect(reads().at(-1)?.[0]).toContain("queue=send");
    });
    fireEvent.click(await screen.findByText("OV-COMPLETA"));
    fireEvent.click(await screen.findByRole("button", { name: "Ver orden completa" }));
    expect(await screen.findByRole("heading", { name: "Orden de venta OV-COMPLETA" })).toBeTruthy();
    expect(screen.queryByText("real@example.com")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Etapa de Formalización" })).toBeNull();
    expect(screen.queryByText("Restablecer ejemplo")).toBeNull();
    expect(screen.queryByText(/Ficticio|Asesor de ejemplo|example.invalid/)).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Órdenes de venta" }));
    expect(screen.getByLabelText("Bandeja de seguimiento").querySelector("option:checked")?.textContent).toBe("Por enviar (3)");
    expect(screen.queryByRole("heading", { name: "Orden de venta OV-COMPLETA" })).toBeNull();
});

it("opens the full record above the workspace in the CRM and preserves the list on return", async () => {
    vi.mocked(apiRequest).mockResolvedValue(payload("OV-PAGINA"));
    render(<FormalizationHomePage initialView="orders" roles={[role]} effectivePermissions={[allow]} />);
    fireEvent.click(await screen.findByText("OV-PAGINA"));
    fireEvent.click(await screen.findByRole("button", { name: "Ver orden completa" }));
    expect(await screen.findByRole("heading", { name: "Orden de venta OV-PAGINA" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Listado de órdenes" })).toBeNull();
    const record = screen.getByRole("region", { name: "Orden de venta OV-PAGINA" });
    expect(record.querySelector("h1")?.textContent).toBe("Orden de venta OV-PAGINA");
    expect(record.querySelectorAll(".formalization-record-progress__steps > li")).toHaveLength(7);
    expect(record.textContent).not.toContain("Cliente y unidad");
    expect(screen.queryByRole("button", { name: "Restablecer ejemplo" })).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Órdenes de venta" }));
    expect(await screen.findByRole("heading", { name: "Listado de órdenes" })).toBeTruthy();
});

it("shows the shared compact timeline inside the side panel", async () => {
    const data = payload();
    Object.assign(data.items[0] ?? {}, { state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null } });
    vi.mocked(apiRequest).mockResolvedValue(data);
    render(<FormalizationFollowUpPreview {...props} />);
    fireEvent.click(await screen.findByText("OV-REAL"));
    const progress = await screen.findByRole("progressbar", { name: "Avance de Formalización" });
    expect(progress.getAttribute("aria-valuenow")).toBe("2");
    expect(progress.getAttribute("aria-valuetext")).toBe("Etapa 2 de 7: Por enviar");
    const timeline = screen.getByRole("region", { name: "Etapas de Formalización" });
    expect(timeline.classList.contains("formalization-record-progress--compact")).toBe(true);
    expect(within(timeline).getAllByRole("listitem")).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Ver orden completa" })).toBeTruthy();
});
