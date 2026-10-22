import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { getAppRoute } from "../../src/routes/app-routes";
import { installBrowserApiDoubles } from "../support/browser";

afterEach(cleanup);

async function openSummary(onNavigate = vi.fn()) {
    installBrowserApiDoubles();
    const Page = getAppRoute("/home/formalization/summary")?.Page;
    if (!Page) throw new Error("Missing summary checklist");
    render(<Page currentUser={{ publicId: "user", displayName: "Test", email: "test@example.invalid", profileImageUrl: null, status: "active", permissionVersion: 1 }} onNavigate={onNavigate} />);
    await act(async () => {
        await vi.dynamicImportSettled();
    });
    expect(screen.getByRole("heading", { name: "Resumen", level: 1 })).toBeTruthy();
    return onNavigate;
}

it("presents a numbered PDF checklist with implementation, location and review steps", async () => {
    await openSummary();
    expect(screen.getByRole("heading", { name: "Resumen", level: 1 })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Checklist de Formalización" }).children).toHaveLength(15);
    expect(screen.getByText(/Indicadores de referencia/)).toBeTruthy();
    expect(screen.getByText(/Fuera de esta fase/)).toBeTruthy();
    expect(screen.getAllByText(/IDEA p. 5/).length).toBeGreaterThan(0);
});

it("keeps manual review separate from delivery status and preserves it after inspecting an order", async () => {
    await openSummary();
    fireEvent.click(screen.getByRole("checkbox", { name: "Revisado: Adjuntar contrato" }));
    expect(screen.getByRole("status").textContent).toContain("1 de 15");
    fireEvent.click(screen.getByRole("button", { name: "Revisar: Adjuntar contrato" }));
    expect(screen.getByRole("heading", { name: "Orden de venta DEMO-OV-101" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Volver al resumen" }));
    expect(screen.getByRole("checkbox", { name: "Revisado: Adjuntar contrato" })).toHaveProperty("checked", true);
});

it("opens the calendar from its requirement without external navigation", async () => {
    const navigate = await openSummary();
    fireEvent.click(screen.getByRole("button", { name: "Revisar: Calendario vinculado" }));
    expect(navigate).toHaveBeenCalledWith("/home/formalization/calendar");
});
