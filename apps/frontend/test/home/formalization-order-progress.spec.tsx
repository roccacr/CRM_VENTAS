import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { FormalizationOrderRecord } from "../../src/modules/home/FormalizationOrderPreview";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { installBrowserApiDoubles } from "../support/browser";

afterEach(cleanup);
const order: FollowUpItem = { id: "legacy:208", source: "legacy", number: "RDR673", nativeCode: null, client: null, project: null, unit: null, responsible: null, state: { code: "pending_approval", label: "Pendientes de aprobación", since: null, days: null }, nextStep: "", completedThisYear: false };
it.each([
    ["pending_approval", 1],
    ["contract_pending_send", 2],
    ["contract_pending_signature", 3],
    ["bank_management", 4],
    ["pending_balance", 5],
    ["pending_transfer", 6],
    ["transfer_signed", 7],
    ["closed", 7],
])("shows the position of %s as step %i of 7, never as a percentage", (code, step) => {
    installBrowserApiDoubles();
    render(<FormalizationOrderRecord item={{ ...order, state: { ...order.state, code } }} onBack={() => {}} />);
    expect(screen.getByRole("progressbar", { name: "Avance de Formalización" }).getAttribute("aria-valuenow")).toBe(String(step));
    expect(within(screen.getByRole("region", { name: "Etapas de Formalización" })).queryByText(/\d+ ?%/)).toBeNull();
    expect(within(screen.getByRole("list", { name: "Recorrido de etapas" })).getAllByRole("listitem")).toHaveLength(7);
});
it("marks the current step separately from the reached and future steps", () => {
    installBrowserApiDoubles();
    render(<FormalizationOrderRecord item={{ ...order, state: { ...order.state, code: "bank_management" } }} onBack={() => {}} />);
    const steps = within(screen.getByRole("list", { name: "Recorrido de etapas" })).getAllByRole("listitem");
    expect(steps.filter((step) => step.dataset.status === "reached")).toHaveLength(3);
    expect(steps.filter((step) => step.dataset.status === "pending")).toHaveLength(3);
    expect(steps.find((step) => step.getAttribute("aria-current") === "step")?.textContent).toContain("Gestión bancaria");
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
    expect(screen.getByRole("status").textContent).toContain("No fue posible cargar");
    expect(screen.queryByText("Vista de muestra.")).toBeNull();
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
    const highlights = within(document.querySelector<HTMLElement>('[aria-label="Datos clave de la orden"]')!);
    for (const value of ["Cliente BD", "Proyecto BD · Unidad BD", "Vendedor BD", "Pendiente de firma", "Dar seguimiento a la firma del contrato"]) expect(highlights.getByText(value)).toBeTruthy();
    const primary = screen.getByRole("region", { name: "Información primaria" });
    expect(primary.textContent).not.toContain("Cliente BD");
    expect(screen.getByRole("region", { name: "Resumen" }).textContent).not.toContain("229");
});
it("does not fabricate a seller or project when the database has no relationship", () => {
    installBrowserApiDoubles();
    render(<FormalizationOrderRecord item={order} onBack={() => {}} />);
    const highlights = document.querySelector<HTMLElement>('[aria-label="Datos clave de la orden"]')!;
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
