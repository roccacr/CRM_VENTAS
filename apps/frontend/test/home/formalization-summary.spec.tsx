import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { FormalizationSummaryPage as Page } from "../../src/modules/home/FormalizationSummaryPage";
import { installBrowserApiDoubles } from "../support/browser";

afterEach(cleanup);

async function openSummary(onNavigate = vi.fn()) {
    installBrowserApiDoubles();
    render(<Page onNavigate={onNavigate} />);
    await act(async () => {
        await vi.dynamicImportSettled();
    });
    expect(screen.getByRole("heading", { name: "Resumen", level: 1 })).toBeInTheDocument();
    return onNavigate;
}

it("presents a numbered PDF checklist with implementation, location and review steps", async () => {
    await openSummary();
    expect(screen.getByRole("heading", { name: "Resumen", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Checklist de Formalización" }).children).toHaveLength(15);
    expect(screen.getByText(/Indicadores de referencia/)).toBeInTheDocument();
    expect(screen.getByText(/Fuera de esta fase/)).toBeInTheDocument();
    expect(screen.getAllByText(/IDEA p. 5/).length).toBeGreaterThan(0);
});

it("keeps manual review separate from delivery status and preserves it after inspecting an order", async () => {
    await openSummary();
    fireEvent.click(screen.getByRole("checkbox", { name: "Revisado: Adjuntar contrato" }));
    expect(screen.getByRole("status").textContent).toContain("1 de 15");
    fireEvent.click(screen.getByRole("button", { name: "Revisar: Adjuntar contrato" }));
    expect(screen.getByRole("heading", { name: "Orden de venta DEMO-OV-101" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Volver al resumen" }));
    expect(screen.getByRole("checkbox", { name: "Revisado: Adjuntar contrato" })).toHaveProperty("checked", true);
});

it("opens the calendar from its requirement without external navigation", async () => {
    const navigate = await openSummary();
    fireEvent.click(screen.getByRole("button", { name: "Revisar: Calendario vinculado" }));
    expect(navigate).toHaveBeenCalledWith("/home/formalization/calendar");
});
