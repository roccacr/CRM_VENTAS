import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { CalendarEventDrawer } from "../../src/modules/calendar/CalendarEventDrawer";
import { useCalendarEventForm } from "../../src/modules/calendar/useCalendarEventForm";
import { apiRequest } from "../../src/services/api/api-client";
import { installBrowserApiDoubles } from "../support/browser";
vi.mock("../../src/services/api/api-client", () => ({ ApiClientError: class extends Error {}, apiRequest: vi.fn().mockResolvedValue({ items: [] }) }));
afterEach(cleanup);
it("keeps the order context selected, locked and expanded when scheduling from its detail", async () => {
    installBrowserApiDoubles();
    const calendar = { moduleCode: "formalizacion" as const, label: "Formalización", color: "#000", canCreate: true, canUpdate: true, types: [{ id: "tarea", code: "tarea", label: "Tarea", color: "#000", formKey: "formalizacion.general.v1" }] };
    render(<CalendarEventDrawer event={null} date="2026-11-03" calendar={calendar} currentModule="formalizacion" onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()} orderContext={{ reference: "LV208", order: { source: "legacy", id: "78", label: "LV208", lead: { source: "legacy", id: "99", label: "Ivonne Miranda Lewis" } } }} />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Nuevo evento de Formalización");
    expect(screen.getByLabelText("Referencia interna (opcional)")).toHaveValue("LV208");
    const relations = screen.getByLabelText("Relaciones");
    expect(relations.querySelector("details")).toHaveAttribute("open");
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "tarea" } });
    expect(screen.getByLabelText("Buscar leads vinculados")).toBeDisabled();
    expect(screen.getByLabelText("Buscar órdenes de venta vinculadas")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Quitar Ivonne Miranda Lewis" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Quitar LV208" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nombre del evento"), { target: { value: "Firma de contrato" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evento" }));
    const command = vi.mocked(apiRequest).mock.calls.find(([path]) => path === "/calendar/events")?.[1]?.body;
    expect(command).toMatchObject({
        links: [
            { entityType: "lead", source: "legacy", id: "99" },
            { entityType: "sales_order", source: "legacy", id: "78" },
        ],
        details: { reference: "LV208" },
    });
    await screen.findByText(/No se confirmó el guardado/);
});
it("preserves contextual identities even if another form action attempts to replace links", () => {
    const calendar = { moduleCode: "formalizacion" as const, label: "Formalización", color: "#000", canCreate: true, canUpdate: true, types: [] };
    const { result } = renderHook(() => useCalendarEventForm(null, calendar, "2026-11-03", { onSaved: vi.fn(), orderContext: { reference: "LV208", order: { source: "legacy", id: "78", label: "LV208", lead: { source: "native", id: "lead-public-id", label: "Cliente" } } } }));
    act(() => {
        result.current.change("links", [
            { entityType: "sales_order", source: "legacy", id: "500" },
            { entityType: "note", source: "native", id: "nota" },
        ]);
    });
    expect(result.current.fields.links).toEqual([
        { entityType: "lead", source: "native", id: "lead-public-id" },
        { entityType: "sales_order", source: "legacy", id: "78" },
        { entityType: "note", source: "native", id: "nota" },
    ]);
});
it("requires a type before enabling fields and preserves the draft on type changes", () => {
    installBrowserApiDoubles();
    const calendar = { moduleCode: "formalizacion" as const, label: "Formalización", color: "#000000", canCreate: true, canUpdate: true, types: ["tarea", "reunion"].map((id) => ({ id, code: id, label: id, color: "#000000", formKey: "formalizacion.general.v1" })) };
    render(<CalendarEventDrawer event={null} date="2026-11-03" calendar={calendar} currentModule="formalizacion" onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByLabelText("Nombre del evento")).toBeDisabled();
    for (const label of ["Tipo", "Nombre del evento", "Inicio", "Fin"]) {
        const field = screen.getByLabelText(label);
        expect(field).toBeRequired();
        expect(field.closest("label")?.querySelector(".event-required")).toHaveTextContent("*");
    }
    for (const label of ["Lugar", "Referencia interna (opcional)", "Descripción"]) {
        expect(screen.getByLabelText(label)).not.toBeRequired();
        expect(screen.getByLabelText(label).closest("label")?.querySelector(".event-required")).toBeNull();
    }
    expect(screen.getByRole("button", { name: "Guardar evento" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "tarea" } });
    expect(screen.queryByRole("checkbox", { name: "Guardar también en Outlook y enviar invitaciones" })).toBeNull();
    expect(screen.getByLabelText("Nombre del evento")).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Nombre del evento"), { target: { value: "Firma" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "reunion" } });
    expect(screen.getByLabelText("Nombre del evento")).toHaveValue("Firma");
});
