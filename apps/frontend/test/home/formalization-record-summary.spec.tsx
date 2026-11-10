import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { FormalizationRecordSummary } from "../../src/modules/home/FormalizationRecordSummary";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";

afterEach(cleanup);

const order: FollowUpItem = { id: "legacy:208", source: "legacy", number: "RDR673", nativeCode: null, client: "Francisco Yau Cheng", project: { id: "p", name: "La Estefana" }, unit: "LE-N FF117", responsible: null, seller: { id: null, name: "Valeria Arriola Miranda" }, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: 4 }, nextStep: "Registrar el envío del contrato", completedThisYear: false };

it.each(["native", "legacy"] as const)("adds the existing Outlook action after next-step highlights for a %s order", (source) => {
    render(<FormalizationRecordSummary item={{ ...order, source, clientEmail: "cliente+contrato@example.com" }} />);
    const facts = screen.getByLabelText("Datos clave de la orden");
    expect(within(facts).getByText("Registrar el envío del contrato")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Abrir Outlook" });
    const summary = screen.getByRole("region", { name: "Resumen de la orden" });
    expect(summary).toContainElement(facts);
    expect(summary.nextElementSibling).toContainElement(link);
    expect(screen.getByText("cliente+contrato@example.com")).toBeInTheDocument();
    expect(new URL(link.getAttribute("href") ?? "").searchParams.get("to")).toBe("cliente+contrato@example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
});

it("does not offer composing without a client email or after the contract was sent", () => {
    const view = render(<FormalizationRecordSummary item={order} />);
    expect(screen.getByText("Correo del cliente no disponible")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir Outlook" })).not.toBeInTheDocument();
    view.rerender(<FormalizationRecordSummary item={{ ...order, clientEmail: "cliente@example.com", state: { ...order.state, code: "contract_pending_signature", label: "Pendiente de firma" } }} />);
    expect(screen.queryByText("Envío del contrato")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Abrir Outlook" })).not.toBeInTheDocument();
});

it("shows the four database highlights and no sample notice", () => {
    render(<FormalizationRecordSummary item={order} />);
    const facts = screen.getByLabelText("Datos clave de la orden");
    for (const text of ["Francisco Yau Cheng", "La Estefana · LE-N FF117", "Valeria Arriola Miranda", "Registrar el envío del contrato"]) expect(within(facts).getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.queryByText("RDR673", { selector: "dd" })).not.toBeInTheDocument();
    expect(facts.querySelectorAll("dd")).toHaveLength(4);
    expect(screen.queryByText("OV-DEMO-001")).not.toBeInTheDocument();
    expect(screen.queryByText("Cliente de ejemplo")).not.toBeInTheDocument();
});

it("keeps facts in the page and money plus read-only answers in the margin, grouped by the question they answer", () => {
    render(<FormalizationRecordSummary item={order} />);
    for (const name of ["Información primaria", "Información de ventas", "Autorización de venta", "Resumen"]) expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    const margin = screen.getByRole("complementary");
    expect(within(margin).getByText("Total")).toBeInTheDocument();
    for (const group of ["Hitos de la orden", "Aprobaciones", "Cálculos de comisión", "Condiciones comerciales", "Excepciones"]) expect(within(margin).getByRole("list", { name: group })).toBeInTheDocument();
    expect(within(margin).getByRole("list", { name: "Hitos de la orden" })).toHaveTextContent("Cierre firmadoSin dato");
    expect(within(margin).queryByRole("checkbox")).not.toBeInTheDocument();
    // Unmapped indicators must not imply confirmed approvals or sample progress.
    expect(within(margin).getByRole("heading", { name: /Aprobaciones/ })).not.toHaveTextContent(/ de /);
    expect(margin.querySelector('[data-checked="true"]')).toBeNull();
    for (const value of margin.querySelectorAll("dd")) expect(value).toHaveTextContent("—");
    expect(within(margin).getByRole("heading", { name: /Condiciones comerciales/ })).not.toHaveTextContent(/ de /);
    expect(screen.queryByText(/marcados/)).not.toBeInTheDocument();
});

it("keeps unmapped fields visible and empty until their mapping is approved", () => {
    render(<FormalizationRecordSummary item={order} />);
    for (const name of ["Información primaria", "Información de ventas", "Autorización de venta"]) {
        const section = screen.getByRole("region", { name });
        const values = section.querySelectorAll("dd");
        expect(values.length).toBeGreaterThan(0);
        for (const value of values) expect(value).toHaveTextContent(/^Sin dato$/);
    }
    expect(screen.queryByText(/campos? sin dato/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Socio").length).toBeGreaterThan(0);
});

it("folds one part of the file and leaves the margin and the other parts visible", () => {
    render(<FormalizationRecordSummary item={order} />);
    const toggle = screen.getByRole("button", { name: "Información primaria" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("N.º de pedido")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Información de ventas" })).toBeInTheDocument();
    expect(screen.getByRole("complementary")).toBeInTheDocument();
});

it("offers jump links, not tabs, and opens or closes every part", () => {
    render(<FormalizationRecordSummary item={order} />);
    expect(screen.getByRole("tablist", { name: "Detalles de la orden" })).toBeInTheDocument();
    const bar = screen.getByRole("navigation", { name: "Secciones de la orden" });
    expect(within(bar).getByRole("link", { name: "Autorización de venta" })).toHaveAttribute("href", "#record-chapter-authorization");
    fireEvent.click(within(bar).getByRole("button", { name: "Contraer todo" }));
    expect(screen.queryByText("N.º de pedido")).not.toBeInTheDocument();
    fireEvent.click(within(bar).getByRole("link", { name: "Información primaria" }));
    expect(screen.getByText("N.º de pedido")).toBeInTheDocument();
    fireEvent.click(within(bar).getByRole("button", { name: "Expandir todo" }));
    expect(screen.getByRole("heading", { name: "Origen" })).toBeInTheDocument();
});

it("switches the four additional sections independently, including keyboard navigation", () => {
    render(<FormalizationRecordSummary item={order} />);
    expect(screen.getByRole("tabpanel", { name: "Artículos" })).toBeVisible();
    expect(screen.queryByRole("tabpanel", { name: "Reserva" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Reserva" }));
    expect(screen.getByRole("tabpanel", { name: "Reserva" })).toBeVisible();
    expect(screen.queryByRole("tabpanel", { name: "Artículos" })).not.toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Reserva" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Detalle de pago" })).toHaveFocus();
    expect(screen.getByRole("tabpanel", { name: "Detalle de pago" })).toBeVisible();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Detalle de pago" }), { key: "End" });
    expect(within(screen.getByRole("tabpanel", { name: "OneDrive" })).getByText("No tienes permiso para consultar los documentos de la orden.")).toBeVisible();
    expect(screen.getByRole("region", { name: "Información primaria" })).toBeVisible();
});
