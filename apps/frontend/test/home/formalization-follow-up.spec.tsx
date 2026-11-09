import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationFollowUpPreview } from "../../src/modules/home/FormalizationFollowUpPreview";
import { FormalizationHomePage } from "../../src/modules/home/FormalizationHomePage";
import type * as ApiClient from "../../src/services/api/api-client";
import { apiRequest } from "../../src/services/api/api-client";
import { installBrowserApiDoubles } from "../support/browser";
vi.mock("../../src/services/api/api-client", async (importOriginal) => ({ ...(await importOriginal<typeof ApiClient>()), apiRequest: vi.fn() }));
vi.mock("antd/es/notification", () => ({ default: { success: vi.fn() } }));
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
it("keeps the order drawer open with its revalidated stage after approval removes the row from the queue", async () => {
    let committed = false;
    const data = payload("BC552");
    const selected = { ...data.items[0], id: "legacy:271", source: "legacy", number: "BC552", approvalsComplete: false, contractSigned: true, stateVersion: 0, state: { code: "pending_approval", label: "Pendiente de aprobación", since: null, days: null } };
    vi.mocked(apiRequest).mockImplementation((path) => {
        if (path === "/formalization/orders/approve") {
            committed = true;
            return Promise.resolve({ source: "legacy", id: "271", approved: true, state: "contract_pending_send", sequence: 1, replayed: false, alreadyApproved: true });
        }
        if (path.endsWith("/record")) return Promise.resolve({ ...selected, approvalsComplete: true, stateVersion: 1, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: 0 } });
        return Promise.resolve({ ...data, items: committed ? [] : [selected] });
    });
    render(<FormalizationFollowUpPreview {...props} canViewApprovals stagePermissions={[{ code: "formalizacion.orders.approve", effect: "allow" }]} />);
    fireEvent.click(await screen.findByText("BC552"));
    fireEvent.click(await screen.findByRole("button", { name: "Aprobar Formalización" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar aprobación" }));
    await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith("/formalization/orders/legacy/271/record");
    });
    expect(await screen.findByRole("button", { name: "Ver orden completa" })).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Avance de Formalización" }).getAttribute("aria-valuenow")).toBe("2");
    expect(apiRequest).not.toHaveBeenCalledWith(expect.stringContaining("/netsuite"));
});
const role = { code: "formalizacion", name: "Formalización", status: "active" as const };
const allow = { code: "formalizacion.home.stages.read", effect: "allow" as const };
const detail = { code: "formalizacion.orders.read", effect: "allow" as const };
const props = { canReadOrder: true, enabled: true, tableOnly: false, scope: { filter: "all" as const }, onOpenOrder: vi.fn() };
const reads = () => vi.mocked(apiRequest).mock.calls.filter(([path]) => path.startsWith("/formalization/home/follow-up"));
beforeEach(() => {
    window.history.replaceState({}, "", "/home/formalization");
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
    const table = within(await screen.findByRole("region", { name: "Órdenes filtradas" }));
    expect(table.getByText("Etiqueta del servidor")).toBeTruthy();
    expect(table.getByText("Acción del servidor")).toBeTruthy();
    expect(screen.getByText("Tiempo no disponible")).toBeTruthy();
    expect(screen.getByText("26 órdenes")).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Bandeja de seguimiento" }));
    expect(screen.queryByRole("option", { name: /Pendientes de aprobación/ })).toBeNull();
});
it.each([true, false])("shows only the pending badge/queue with effective adendum read without hiding ordinary orders: %s", async (readable) => {
    const data = payload("OV-ADENDUM");
    vi.mocked(apiRequest).mockResolvedValue({ ...data, counts: { ...data.counts, addendum: 1 }, items: data.items.map((item) => ({ ...item, addendumStatus: "pending" })) });
    const permissions = [{ code: "formalizacion.orders.read", effect: "allow" }, { code: "formalizacion.orders.addendum.read", effect: "allow" }, ...(readable ? [] : [{ code: "formalizacion.orders.addendum.read", effect: "deny" }])];
    render(<FormalizationFollowUpPreview {...props} stagePermissions={permissions} />);
    await screen.findByText("OV-ADENDUM");
    expect(Boolean(screen.queryByText("Adéndum pendiente"))).toBe(readable);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Bandeja de seguimiento" }));
    expect(Boolean(screen.queryByRole("option", { name: "Pendientes de adéndum (1)" }))).toBe(readable);
    expect(screen.getByText("26 órdenes")).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Bandeja de seguimiento" }));
});
it("does not present a missing legacy-compatible addendum count as zero or undefined", async () => {
    render(
        <FormalizationFollowUpPreview
            {...props}
            stagePermissions={[
                { code: "formalizacion.orders.read", effect: "allow" },
                { code: "formalizacion.orders.addendum.read", effect: "allow" },
            ]}
        />,
    );
    await screen.findByText("OV-REAL");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Bandeja de seguimiento" }));
    expect(screen.getByRole("option", { name: "Pendientes de adéndum (—)" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Pendientes de adéndum (0)" })).toBeNull();
});
it.each(["completed", "cancelled"] as const)("refreshes the pending queue, badge and count after confirming an addendum as %s", async (target) => {
    let committed = false;
    const data = payload("OV-ADENDUM-QUEUE");
    const selected = { ...data.items[0], id: "78", source: "legacy", number: "OV-ADENDUM-QUEUE", addendumStatus: "pending", state: { code: "contract_pending_send", label: "Por enviar", since: null, days: 0 } };
    const marker = () => ({ schemaVersion: 1, source: "legacy", id: "78", status: committed ? target : "pending", version: committed ? 2 : 1, changedAt: "2026-11-03T12:00:00Z", canUpdate: true });
    vi.mocked(apiRequest).mockImplementation((path, options) => {
        if (path === "/formalization/orders/addendum" && options?.method === "POST") {
            committed = true;
            return Promise.resolve({ ...marker(), replayed: false });
        }
        if (path.startsWith("/formalization/orders/addendum?")) return Promise.resolve(marker());
        if (path.endsWith("/record")) return Promise.resolve({ ...selected, addendumStatus: target });
        if (path.endsWith("/database")) return Promise.resolve({ schemaVersion: 1, source: "legacy", observedAt: data.observedAt, order: {}, contact: null, lead: null, unitFile: null, references: [], warnings: [] });
        const projection = committed ? { items: [], total: 0 } : { items: [selected], total: 1 };
        return Promise.resolve({ ...data, filters: { ...data.filters, queue: "addendum" }, items: projection.items, counts: { ...data.counts, addendum: projection.total }, page: { ...data.page, total: projection.total } });
    });
    const onRefresh = vi.fn();
    render(
        <FormalizationFollowUpPreview
            {...props}
            scope={{ filter: "addendum" }}
            allowedQueues={["all", "addendum"]}
            stagePermissions={[
                { code: "formalizacion.orders.read", effect: "allow" },
                { code: "formalizacion.orders.addendum.read", effect: "allow" },
                { code: "formalizacion.orders.addendum.update", effect: "allow" },
            ]}
            onRefresh={onRefresh}
        />,
    );
    fireEvent.click(await screen.findByText("OV-ADENDUM-QUEUE"));
    fireEvent.click(await screen.findByRole("button", { name: target === "completed" ? "Marcar adéndum como completado" : "Cancelar adéndum" }));
    await waitFor(() => {
        expect(vi.mocked(apiRequest).mock.calls.some(([path, opts]) => path === "/formalization/orders/addendum" && opts?.method === "POST")).toBe(true);
    });
    expect(within(await screen.findByRole("region", { name: "Órdenes filtradas" })).queryByText("OV-ADENDUM-QUEUE")).toBeNull();
    expect(within(await screen.findByRole("region", { name: "Órdenes filtradas" })).queryByText("Adéndum pendiente")).toBeNull();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(vi.mocked(apiRequest).mock.calls.filter(([path, options]) => path === "/formalization/orders/addendum" && options?.method === "POST")).toHaveLength(1);
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
    await chooseFollowUpFilter("Filtrar por proyecto", "Proyecto real");
    await waitFor(() => {
        expect(reads().at(-1)?.[0]).toContain("projectIds=legacy-project%3A7");
    });
    await chooseFollowUpFilter("Bandeja de seguimiento", /^Pendientes de aprobación/);
    await waitFor(() => {
        expect(reads().at(-1)?.[0]).toContain("queues=approvals");
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
    await chooseFollowUpFilter("Bandeja de seguimiento", /^Gestión bancaria \(/);
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
it("gates Home reads by effective allow without deny, and removes revoked rows", async () => {
    const { rerender } = render(<FormalizationHomePage />);
    expect(reads()).toHaveLength(0);
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[detail, allow, { ...allow, effect: "deny" }]} />);
    expect(reads()).toHaveLength(0);
    rerender(<FormalizationHomePage roles={[{ ...role, status: "inactive" }]} effectivePermissions={[]} />);
    expect(reads()).toHaveLength(0);
    rerender(<FormalizationHomePage roles={[]} effectivePermissions={[detail, allow]} />);
    await screen.findByText("OV-REAL");
    expect(reads()).toHaveLength(1);
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[]} />);
    expect(screen.queryByText("OV-REAL")).toBeNull();
});
it("keeps a single Home consumer and filters its list with banners", async () => {
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[detail, allow]} />);
    await screen.findByText("OV-REAL");
    fireEvent.click(screen.getByRole("button", { name: "Recargar banners" }));
    await waitFor(() => {
        expect(reads()).toHaveLength(2);
    });
    fireEvent.click(screen.getByRole("button", { name: "Abrir Por enviar" }));
    await waitFor(() => {
        expect(reads()).toHaveLength(3);
    });
    expect(screen.getAllByText("OV-REAL")).toHaveLength(1);
});
it("direct Orders entry has a single follow-up request", async () => {
    render(<FormalizationHomePage initialView="orders" roles={[role]} effectivePermissions={[detail, allow]} />);
    await screen.findByText("OV-REAL");
    expect(reads()).toHaveLength(1);
});
it("fences a new load when returning to a previously completed filter", async () => {
    render(<FormalizationFollowUpPreview {...props} />);
    await screen.findByText("OV-REAL");
    vi.mocked(apiRequest).mockImplementation(() => new Promise(() => {}));
    await chooseFollowUpFilter("Bandeja de seguimiento", /^Gestión bancaria \(/);
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Bandeja de seguimiento" }), { key: "Backspace" });
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
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[detail, allow, update, { code: "formalizacion.orders.stage.skip", effect: "allow" }, ...(denied ? [{ ...update, effect: "deny" as const }] : [])]} />);
    fireEvent.click(await screen.findByText("OV-REAL"));
    const move = await screen.findByRole("button", { name: "Mover a otro estado" });
    expect(move.hasAttribute("disabled")).toBe(denied);
    fireEvent.click(move);
    if (denied) {
        expect(screen.queryByRole("combobox", { name: "Etapa de Formalización" })).toBeNull();
        return;
    }
    const select = await screen.findByRole("combobox", { name: "Etapa de Formalización" });
    expect(select.hasAttribute("disabled")).toBe(false);
});
it("saving a live drawer preserves it and refreshes its record, list and Home banners", async () => {
    const data = payload();
    const id = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    let committed = false;
    vi.mocked(apiRequest).mockImplementation((path) => {
        if (path === "/formalization/orders/stage") {
            committed = true;
            return Promise.resolve({ source: "native", id, state: "contract_pending_signature", sequence: 1, replayed: false });
        }
        const items = data.items.map((entry) => ({ ...entry, id, approvalsComplete: true, stateVersion: Number(committed), state: { ...entry.state, code: committed ? "contract_pending_signature" : "contract_pending_send", label: committed ? "Pendiente de firma" : "Por enviar" } }));
        return Promise.resolve(path.endsWith("/record") ? items[0] : { ...data, items });
    });
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[detail, allow, { code: "formalizacion.orders.stage.update", effect: "allow" }, { code: "formalizacion.orders.stage.contract_pending_signature", effect: "allow" }]} />);
    fireEvent.click(await screen.findByText("OV-REAL"));
    fireEvent.click(await screen.findByRole("button", { name: "Marcar como enviado" }));
    const summaryReads = () => vi.mocked(apiRequest).mock.calls.filter(([path]) => path === "/formalization/home/summary").length;
    const before = summaryReads();
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
    await waitFor(() => {
        expect(reads().length).toBeGreaterThan(1);
        expect(summaryReads()).toBeGreaterThan(before);
    });
    await waitFor(() => {
        expect(screen.getByRole("button", { name: "Ver orden completa" })).toBeTruthy();
        expect(screen.getByRole("progressbar", { name: "Avance de Formalización" }).getAttribute("aria-valuenow")).toBe("3");
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
    await chooseFollowUpFilter("Bandeja de seguimiento", /^Por enviar/);
    await waitFor(() => {
        expect(reads().at(-1)?.[0]).toContain("queues=send");
    });
    fireEvent.click(await screen.findByText("OV-COMPLETA"));
    fireEvent.click(await screen.findByRole("button", { name: "Ver orden completa" }));
    expect(await screen.findByRole("heading", { name: "Orden de venta OV-COMPLETA" })).toBeTruthy();
    expect(screen.getByText("real@example.com")).toBeTruthy();
    expect(new URL(screen.getByRole("link", { name: "Abrir Outlook" }).getAttribute("href") ?? "").searchParams.get("to")).toBe("real@example.com");
    expect(screen.queryByRole("combobox", { name: "Etapa de Formalización" })).toBeNull();
    expect(screen.queryByText("Restablecer ejemplo")).toBeNull();
    expect(screen.queryByText(/Ficticio|Asesor de ejemplo|example.invalid/)).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Órdenes de venta" }));
    expect(reads().at(-1)?.[0]).toContain("queues=send");
    expect(screen.queryByRole("heading", { name: "Orden de venta OV-COMPLETA" })).toBeNull();
});

it("opens the full record above the workspace in the CRM and preserves the list on return", async () => {
    vi.mocked(apiRequest).mockImplementation((path) => {
        const data = payload("OV-PAGINA");
        const item = { ...data.items[0], id: "01ARZ3NDEKTSV4RRFFQ69G5FAV" };
        return Promise.resolve(path.endsWith("/record") ? item : { ...data, items: [item] });
    });
    render(<FormalizationHomePage initialView="orders" roles={[role]} effectivePermissions={[detail, allow]} />);
    fireEvent.click(await screen.findByText("OV-PAGINA"));
    fireEvent.click(await screen.findByRole("button", { name: "Ver orden completa" }));
    expect(await screen.findByRole("heading", { name: "Orden de venta OV-PAGINA" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Listado de órdenes" })).toBeNull();
    const record = screen.getByRole("region", { name: "Orden de venta OV-PAGINA" });
    expect(record.querySelector("h1")?.textContent).toBe("Orden de venta OV-PAGINA");
    expect(record.querySelectorAll(".formalization-record-progress__steps > li")).toHaveLength(8);
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
    expect(progress.getAttribute("aria-valuetext")).toBe("Etapa 2 de 8: Por enviar");
    const timeline = screen.getByRole("region", { name: "Etapas de Formalización" });
    expect(timeline.classList.contains("formalization-record-progress--compact")).toBe(true);
    expect(within(timeline).getAllByRole("listitem")).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Ver orden completa" })).toBeTruthy();
});

it("revalidates only the committed CRM order and preserves provider details after a stage change", async () => {
    window.history.replaceState({}, "", "/home/formalization/orders?orderSource=legacy&orderId=208");
    let committed = false;
    const data = payload("RDR673");
    vi.mocked(apiRequest).mockImplementation((path) => {
        if (path.endsWith("/netsuite")) return Promise.resolve({ schemaVersion: 1, order: { source: "legacy", id: "legacy:208", netsuiteId: "11998725" }, data: { status: 200, data: { id: "11998725", type: "salesorder", fields: { initialtranid: "RDR673", currencyname: "US Dollar" } } } });
        if (path.endsWith("/database"))
            return Promise.resolve({ schemaVersion: 1, observedAt: "2026-10-27T22:00:00Z", source: "legacy", order: {}, lead: null, contact: null, unitFile: null, references: [], warnings: [], detail: { sections: [{ title: "Registro", fields: [{ code: "stage", label: "Etapa guardada", value: `BD guardada: ${String(committed)}`, kind: "text" }] }], currency: null, client: { name: null, identification: null, phone: null, email: null, advisor: null, identity: null }, warnings: [] } });
        if (path === "/formalization/orders/stage") {
            committed = true;
            return Promise.resolve({ source: "legacy", id: "208", state: "contract_pending_signature", sequence: 1, replayed: false });
        }
        const item = { ...data.items[0], id: "legacy:208", source: "legacy", approvalsComplete: true, contractSigned: true, stateVersion: Number(committed), state: { code: committed ? "contract_pending_signature" : "contract_pending_send", label: committed ? "Pendiente de firma" : "Por enviar", since: null, days: null }, nextStep: committed ? "Registrar firma" : "Registrar envío" };
        return Promise.resolve(path.endsWith("/record") ? item : { ...data, items: [item] });
    });
    render(<FormalizationHomePage roles={[role]} effectivePermissions={[detail, allow, { code: "formalizacion.orders.stage.update", effect: "allow" }, { code: "formalizacion.orders.stage.contract_pending_signature", effect: "allow" }, { code: "formalizacion.orders.stage.bank_management", effect: "allow" }]} />);
    const advance = await screen.findByRole("button", { name: "Marcar como enviado" });
    const providerReads = () => vi.mocked(apiRequest).mock.calls.filter(([path]) => path.endsWith("/netsuite")).length;
    const databaseReads = () => vi.mocked(apiRequest).mock.calls.filter(([path]) => path.endsWith("/database")).length;
    const recordReads = () => vi.mocked(apiRequest).mock.calls.filter(([path]) => path === "/formalization/orders/legacy/208/record").length;
    const beforeDatabase = databaseReads();
    const before = providerReads();
    const beforeRecord = recordReads();
    fireEvent.click(advance);
    fireEvent.click(await screen.findByRole("button", { name: "Confirmar cambio" }));
    await screen.findByText("Estado guardado y verificado correctamente.");
    expect(providerReads()).toBe(before);
    expect(databaseReads()).toBe(beforeDatabase);
    expect(recordReads()).toBe(beforeRecord + 1);
    expect(reads().some(([path]) => path.includes("recordId="))).toBe(false);
    expect(screen.queryByText("Cargando datos de la orden…")).toBeNull();
    expect(screen.getByRole("button", { name: "Registrar siguiente etapa" })).toBeTruthy();
    expect(screen.getByText("US Dollar")).toBeTruthy();
    window.history.replaceState({}, "", "/home/formalization");
});

it("approvals-only reads the list without an umbrella grant", async () => {
    render(<FormalizationHomePage initialView="orders" roles={[role]} effectivePermissions={[{ code: "formalizacion.home.approvals.read", effect: "allow" }]} />);
    await screen.findByText("OV-REAL");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Bandeja de seguimiento" }));
    expect(screen.getByRole("option", { name: /Pendientes de aprobación/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /Gestión bancaria/ })).toBeNull();
    expect(reads()).toHaveLength(1);
});

it("detail revoke invalidates an in-flight direct record restore", async () => {
    window.history.replaceState({}, "", "/home/formalization/orders?orderSource=legacy&orderId=208");
    let finish: (value: unknown) => void = () => {};
    vi.mocked(apiRequest).mockImplementation((path) =>
        path.endsWith("/record")
            ? new Promise((resolve) => {
                  finish = resolve;
              })
            : Promise.resolve(payload()),
    );
    const contracts = { code: "formalizacion.home.contracts.read", effect: "allow" as const };
    const { rerender } = render(<FormalizationHomePage roles={[role]} effectivePermissions={[contracts, detail]} />);
    rerender(<FormalizationHomePage roles={[role]} effectivePermissions={[contracts]} />);
    await act(async () => {
        finish({ ...payload("STALE-DIRECT").items[0], id: "legacy:208", source: "legacy" });
        await Promise.resolve();
    });
    expect(screen.queryByText("STALE-DIRECT")).toBeNull();
    expect(screen.queryByRole("heading", { name: /Orden de venta STALE-DIRECT/ })).toBeNull();
    window.history.replaceState({}, "", "/home/formalization");
});

it("banner-only list cannot open a drawer or request order details", async () => {
    render(<FormalizationHomePage initialView="orders" roles={[role]} effectivePermissions={[allow]} />);
    fireEvent.click(await screen.findByText("OV-REAL"));
    expect(screen.queryByRole("button", { name: "Ver orden completa" })).toBeNull();
    expect(screen.queryByLabelText("Abrir detalle de la orden OV-REAL")).toBeNull();
    expect(vi.mocked(apiRequest).mock.calls.some(([path]) => path.startsWith("/formalization/orders/"))).toBe(false);
});

it("detail-only direct URL restores without banner, list or count reads", async () => {
    window.history.replaceState({}, "", "/home/formalization/orders?orderSource=legacy&orderId=208");
    vi.mocked(apiRequest).mockImplementation((path) => {
        if (path.endsWith("/record")) return Promise.resolve({ ...payload("DETAIL-ONLY").items[0], id: "legacy:208", source: "legacy" });
        return Promise.reject(new Error("provider unavailable"));
    });
    render(<FormalizationHomePage initialView="orders" roles={[role]} effectivePermissions={[detail]} />);
    expect(await screen.findByRole("heading", { name: /Orden de venta DETAIL-ONLY/ })).toBeTruthy();
    expect(reads()).toHaveLength(0);
    expect(vi.mocked(apiRequest).mock.calls.some(([path]) => path.includes("/home/summary"))).toBe(false);
    window.history.replaceState({}, "", "/home/formalization");
});

it("an explicit detail deny clears an open drawer while preserving category list access", async () => {
    const { rerender } = render(<FormalizationHomePage initialView="orders" roles={[role]} effectivePermissions={[allow, detail]} />);
    fireEvent.click(await screen.findByText("OV-REAL"));
    expect(await screen.findByRole("button", { name: "Ver orden completa" })).toBeTruthy();
    rerender(<FormalizationHomePage initialView="orders" roles={[role]} effectivePermissions={[allow, detail, { ...detail, effect: "deny" }]} />);
    expect(screen.queryByRole("button", { name: "Ver orden completa" })).toBeNull();
    await screen.findByText("OV-REAL");
    fireEvent.click(screen.getByText("OV-REAL"));
    expect(screen.queryByRole("button", { name: "Ver orden completa" })).toBeNull();
});

it.each([false, true])("restores multi-project and multi-queue preferences after remount tableOnly=%s", async (tableOnly) => {
    const key = `multi-user:${tableOnly ? "orders" : "home"}:all:`;
    localStorage.setItem("crm:follow-up:v1:" + key, JSON.stringify({ projectIds: ["legacy-project:7", "legacy-project:8"], selections: ["send", "bank_in_progress"] }));
    const view = render(<FormalizationFollowUpPreview {...props} tableOnly={tableOnly} filterStorageKey="multi-user" />);
    await screen.findByText("OV-REAL");
    let params = new URL(reads().at(-1)?.[0] ?? "", "http://localhost").searchParams;
    expect(params.get("projectIds")).toBe("legacy-project:7,legacy-project:8");
    expect(params.get("queues")).toBe("send,bank");
    expect(params.get("bankStages")).toBe("bank_management_in_progress");
    view.unmount();
    render(<FormalizationFollowUpPreview {...props} tableOnly={tableOnly} filterStorageKey="multi-user" />);
    await screen.findByText("OV-REAL");
    params = new URL(reads().at(-1)?.[0] ?? "", "http://localhost").searchParams;
    expect(params.get("projectIds")).toBe("legacy-project:7,legacy-project:8");
    localStorage.clear();
});

async function chooseFollowUpFilter(label: string, name: string | RegExp) {
    const input = screen.getByRole("combobox", { name: label });
    fireEvent.mouseDown(input);
    fireEvent.click(await screen.findByRole("option", { name }));
    fireEvent.keyDown(input, { key: "Escape" });
}

it("applies a pending banner request when the Home list mounts again", async () => {
    render(<FormalizationFollowUpPreview {...props} filterRequest={{ selection: "balance", version: 1 }} />);
    await waitFor(() => {
        expect(reads().at(-1)?.[0]).toContain("queues=balance");
    });
});
