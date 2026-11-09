import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { FormalizationOrderRecord } from "../../src/modules/home/FormalizationOrderPreview";
import { apiRequest } from "../../src/services/api/api-client";
import { type FollowUpItem, getFollowUp } from "../../src/services/formalization/follow-up-service";
import type { NetsuitePrimary } from "../../src/services/formalization/netsuite-primary";
import { installBrowserApiDoubles } from "../support/browser";

afterEach(cleanup);
const order: FollowUpItem = { id: "legacy:208", source: "legacy", number: "RDR673", nativeCode: null, client: null, project: null, unit: null, responsible: null, state: { code: "pending_approval", label: "Pendientes de aprobación", since: null, days: null }, nextStep: "", completedThisYear: false };
it.each([
    ["pending_approval", 1],
    ["contract_pending_send", 2],
    ["contract_pending_signature", 3],
    ["bank_management", 4],
    ["bank_management_in_progress", 5],
    ["pending_balance", 6],
    ["pending_transfer", 7],
    ["transfer_signed", 8],
    ["closed", 8],
])("shows the position of %s as step %i of 8, never as a percentage", (code, step) => {
    installBrowserApiDoubles();
    render(<FormalizationOrderRecord item={{ ...order, state: { ...order.state, code } }} onBack={() => {}} />);
    expect(screen.getByRole("progressbar", { name: "Avance de Formalización" }).getAttribute("aria-valuenow")).toBe(String(step));
    expect(within(screen.getByRole("region", { name: "Etapas de Formalización" })).queryByText(/\d+ ?%/)).toBeNull();
    expect(within(screen.getByRole("list", { name: "Recorrido de etapas" })).getAllByRole("listitem")).toHaveLength(8);
});
it("marks earlier positions neutrally without inventing visits after a stage skip", () => {
    installBrowserApiDoubles();
    render(<FormalizationOrderRecord item={{ ...order, state: { ...order.state, code: "bank_management" } }} onBack={() => {}} />);
    const steps = within(screen.getByRole("list", { name: "Recorrido de etapas" })).getAllByRole("listitem");
    expect(steps.filter((step) => step.dataset.status === "previous")).toHaveLength(3);
    expect(steps.filter((step) => step.dataset.status === "pending")).toHaveLength(4);
    expect(within(screen.getByRole("list", { name: "Recorrido de etapas" })).getAllByText("Etapa anterior")).toHaveLength(3);
    expect(screen.queryByText("Alcanzada")).toBeNull();
    expect(steps.slice(0, 3).every((step) => step.querySelector('[aria-label="check"]'))).toBe(true);
    expect(steps.slice(3).every((step) => !step.querySelector('[aria-label="check"]'))).toBe(true);
    expect(steps.find((step) => step.getAttribute("aria-current") === "step")?.textContent).toContain("Gestión bancaria");
});
it("shows closure as a finished process with the final step completed and no current stage", () => {
    installBrowserApiDoubles();
    render(<FormalizationOrderRecord item={{ ...order, state: { ...order.state, code: "closed" } }} onBack={() => {}} />);
    const progress = screen.getByRole("region", { name: "Etapas de Formalización" });
    expect(within(progress).getByText("Formalización cerrada")).toBeTruthy();
    expect(progress.textContent).toContain("Proceso finalizado");
    expect(within(progress).getByRole("progressbar").getAttribute("aria-valuetext")).toBe("Formalización cerrada: Proceso finalizado");
    const steps = within(progress).getAllByRole("listitem");
    expect(steps).toHaveLength(8);
    expect(steps.some((step) => step.hasAttribute("aria-current"))).toBe(false);
    expect(steps[7]?.dataset.status).toBe("completed");
    expect(steps[7]?.textContent).toContain("Completada");
    expect(within(progress).queryByText("Etapa actual")).toBeNull();
});
it("does not invent a percentage for an unknown stage", () => {
    installBrowserApiDoubles();
    render(<FormalizationOrderRecord item={{ ...order, state: { ...order.state, code: "unclassified" } }} onBack={() => {}} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText("Etapa sin identificar")).toBeTruthy();
});

it("hides example values while the provider request is pending", () => {
    installBrowserApiDoubles();
    render(<FormalizationOrderRecord item={order} netsuiteStatus="loading" onBack={() => {}} />);
    expect(screen.getByRole("status").textContent).toContain("Cargando datos");
    expect(screen.getByRole("status", { name: "Datos de la orden" }).getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByText("Vista de muestra.")).toBeNull();
    expect(screen.queryByRole("region", { name: "Resumen" })).toBeNull();
});
it("does not restore example fields on provider failure", () => {
    installBrowserApiDoubles();
    render(<FormalizationOrderRecord item={order} netsuiteStatus="error" onBack={() => {}} />);
    expect(screen.getByText(/No fue posible cargar/).getAttribute("role")).toBe("status");
    expect(screen.queryByText("Vista de muestra.")).toBeNull();
});
it("shows the confirmed provider absence message instead of a generic load failure", () => {
    installBrowserApiDoubles();
    const message = "La orden de venta no existe en NetSuite en el entorno configurado.";
    render(<FormalizationOrderRecord item={order} netsuiteStatus="error" netsuiteErrorMessage={message} onBack={() => {}} />);
    expect(screen.getByText(message).getAttribute("role")).toBe("status");
    expect(screen.queryByText(/No fue posible cargar los datos/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Aprobar Formalización" })).toBeNull();
});

it("offers a transaction reload action and disables it while loading", () => {
    installBrowserApiDoubles();
    let calls = 0;
    const onRefresh = () => {
        calls += 1;
    };
    const view = render(<FormalizationOrderRecord item={order} onBack={() => {}} onRefresh={onRefresh} />);
    fireEvent.click(screen.getByRole("button", { name: "Recargar transacción" }));
    expect(calls).toBe(1);
    view.rerender(<FormalizationOrderRecord item={order} onBack={() => {}} onRefresh={onRefresh} netsuiteStatus="loading" />);
    expect(screen.getByRole("button", { name: "Recargar transacción" }).hasAttribute("disabled")).toBe(true);
});

it.each(["native", "legacy"] as const)("fills only the five highlights from the %s database projection", (source) => {
    installBrowserApiDoubles();
    const item: FollowUpItem = { ...order, source, client: "Cliente BD", project: { id: "project", name: "Proyecto BD" }, unit: "Unidad BD", seller: { id: "seller", name: "Vendedor BD" }, state: { code: "contract_pending_signature", label: "Pendiente de firma", since: null, days: null }, nextStep: "Dar seguimiento a la firma del contrato" };
    render(<FormalizationOrderRecord item={item} onBack={() => {}} />);
    const highlights = within(screen.getByLabelText("Datos clave de la orden"));
    for (const value of ["Cliente BD", "Proyecto BD · Unidad BD", "Vendedor BD", "Pendiente de firma", "Dar seguimiento a la firma del contrato"]) expect(highlights.getByText(value)).toBeTruthy();
    const primary = screen.getByRole("region", { name: "Información primaria" });
    expect(primary.textContent).not.toContain("Cliente BD");
    expect(screen.getByRole("region", { name: "Resumen" }).textContent).not.toContain("229");
});
it("does not fabricate a seller or project when the database has no relationship", () => {
    installBrowserApiDoubles();
    render(<FormalizationOrderRecord item={order} onBack={() => {}} />);
    const highlights = screen.getByLabelText("Datos clave de la orden");
    expect(within(highlights).getAllByText("—")).toHaveLength(4);
});

it("uses one loading boundary for identity, timeline and record data, then reveals the refreshed database values", () => {
    installBrowserApiDoubles();
    const view = render(<FormalizationOrderRecord item={order} onBack={() => {}} netsuiteStatus="loading" />);
    expect(screen.getByRole("status").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("heading", { name: "Orden de venta RDR673" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Ruta de la orden" })).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText("RDR673")).toBeNull();
    const refreshed = { ...order, number: "BD-ACTUAL", state: { ...order.state, code: "contract_pending_signature", label: "Pendiente de firma" } };
    view.rerender(<FormalizationOrderRecord item={refreshed} onBack={() => {}} netsuiteStatus="success" />);
    expect(screen.getByRole("heading", { name: "Orden de venta BD-ACTUAL" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Ruta de la orden" }).textContent).toContain("BD-ACTUAL");
    expect(screen.getByRole("region", { name: "Etapas de Formalización" }).textContent).toContain("Pendiente de firma");
});
it("offers approval in the full order independently of stage update permission", async () => {
    installBrowserApiDoubles();
    render(<FormalizationOrderRecord item={{ ...order, stateVersion: 0, state: { ...order.state, code: "pending_approval" } }} onBack={() => {}} canUpdateStage={false} stagePermissions={[{ code: "formalizacion.orders.approve", effect: "allow" }]} />);
    expect(screen.getByRole("button", { name: "Aprobar Formalización" }).hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Aprobar Formalización" }));
    expect(await screen.findByRole("dialog", { name: "Confirmar aprobación de Formalización" })).toBeTruthy();
});

vi.mock("../../src/services/api/api-client", async (original) => ({ ...(await original<object>()), apiRequest: vi.fn() }));
vi.mock("../../src/services/formalization/follow-up-service", async (original) => ({ ...(await original<object>()), getFollowUp: vi.fn() }));

it("bounds the confirmed approval flag to the same order and exact provider projection", async () => {
    installBrowserApiDoubles();
    const primary: NetsuitePrimary = { items: [], fields: {}, sales: {}, authorization: {}, articles: {}, reservation: {}, payment: {}, summary: {}, checks: { "Aprobación formalización": false, "Aprobación jefe de ventas": false } };
    const approved = { ...order, stateVersion: 0 };
    const permissions = [{ code: "formalizacion.orders.approve", effect: "allow" }];
    vi.mocked(apiRequest).mockImplementation((path) => {
        if (path === "/formalization/orders/approve") return Promise.resolve({ source: "legacy", id: "208", approved: true, state: "contract_pending_send", sequence: 1, replayed: false });
        if (path === "/formalization/orders/legacy/208/record") return Promise.resolve({ ...approved, stateVersion: 1, state: { ...order.state, code: "contract_pending_send" } });
        return Promise.reject(new Error("Unexpected request: " + path));
    });
    const view = render(<FormalizationOrderRecord item={approved} primary={primary} stagePermissions={permissions} onBack={() => {}} />);
    const flag = () => screen.getByText("Aprobación formalización").closest("li")?.getAttribute("data-checked");
    expect(flag()).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: "Aprobar Formalización" }));
    fireEvent.click(await screen.findByRole("button", { name: /Confirmar aprobación/ }));
    await waitFor(() => {
        expect(flag()).toBe("true");
    });
    expect(screen.getByText("Aprobación jefe de ventas").closest("li")?.getAttribute("data-checked")).toBe("false");
    expect(primary.checks["Aprobación formalización"]).toBe(false);
    view.rerender(<FormalizationOrderRecord item={{ ...approved, stateVersion: 1, state: { ...order.state, code: "contract_pending_send" } }} primary={primary} stagePermissions={permissions} onBack={() => {}} />);
    expect(flag()).toBe("true");
    view.rerender(<FormalizationOrderRecord item={{ ...approved, id: "legacy:209" }} primary={primary} stagePermissions={permissions} onBack={() => {}} />);
    expect(flag()).toBe("false");
    view.rerender(<FormalizationOrderRecord item={approved} primary={{ ...primary }} stagePermissions={permissions} onBack={() => {}} />);
    expect(flag()).toBe("false");
    expect(
        vi
            .mocked(apiRequest)
            .mock.calls.filter(([path]) => !path.endsWith("/database") && !path.endsWith("/netsuite/context") && path !== "/identity/me")
            .map(([path, options]) => [path, options?.method ?? "GET"]),
    ).toEqual([
        ["/formalization/orders/approve", "POST"],
        ["/formalization/orders/legacy/208/record", "GET"],
    ]);
    expect(getFollowUp).not.toHaveBeenCalled();
});
