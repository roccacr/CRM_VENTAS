import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CalendarEventDrawer } from "../../src/modules/calendar/CalendarEventDrawer";
import { useCalendarEventForm } from "../../src/modules/calendar/useCalendarEventForm";
import { apiRequest } from "../../src/services/api/api-client";
import type { CalendarDescriptor, CalendarEvent, CalendarLink } from "../../src/services/calendar/calendar-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/api/api-client", () => ({ ApiClientError: class extends Error {}, apiRequest: vi.fn().mockResolvedValue({ items: [] }) }));
const calendar: CalendarDescriptor = { moduleCode: "formalizacion", label: "Formalización", color: "#000", canCreate: true, canUpdate: true, types: ["adendum", "reunion"].map((code) => ({ id: code, code, label: code === "adendum" ? "Adéndum" : "Reunión", color: "#000", formKey: "formalizacion.general.v1" })) };
beforeEach(() => {
    installBrowserApiDoubles();
    vi.clearAllMocks();
});
afterEach(cleanup);

it.each([0, 2])("rejects an Adéndum with %s sales orders before requesting the API", async (count) => {
    const { result } = renderHook(() => useCalendarEventForm(null, calendar, "2026-11-03", { onSaved: vi.fn() }));
    act(() => {
        result.current.change("typeId", "adendum");
        result.current.change("title", "Cambio contractual");
        result.current.change(
            "links",
            Array.from({ length: count }, (_, index): CalendarLink => ({ entityType: "sales_order", source: "legacy", id: String(index + 1) })),
        );
    });
    await act(async () => {
        await result.current.save();
    });
    expect(result.current.failure?.message).toBe("El evento Adéndum debe vincular exactamente una orden de venta.");
    expect(apiRequest).not.toHaveBeenCalled();
});
it("expands Relations and disables saving until exactly one order is selected", () => {
    render(<CalendarEventDrawer event={null} date="2026-11-03" calendar={calendar} currentModule="formalizacion" onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "adendum" } });
    for (const label of ["Leads vinculados", "Órdenes de venta vinculadas"]) expect(screen.getByRole("group", { name: label }).querySelector(".event-required")).toHaveTextContent("*");
    expect(screen.getByLabelText("Relaciones").querySelector("details")).toHaveAttribute("open");
    expect(screen.getByText("El evento Adéndum debe vincular exactamente una orden de venta.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar evento" })).toBeDisabled();
});
it("accepts the fixed order context for Adéndum without clearing the client, order or draft", () => {
    const { result } = renderHook(() => useCalendarEventForm(null, calendar, "2026-11-03", { onSaved: vi.fn(), orderContext: { reference: "LV208", order: { id: "78", source: "legacy", label: "LV208", lead: { id: "20519", source: "legacy", label: "Cliente" } } } }));
    act(() => {
        result.current.change("typeId", "adendum");
        result.current.change("title", "Adéndum LV208");
    });
    expect(result.current.orderError).toBeNull();
    expect(result.current.requiresOrder).toBe(true);
    expect(result.current.fields.reference).toBe("LV208");
    expect(result.current.fields.links).toHaveLength(2);
    act(() => {
        result.current.change("typeId", "reunion");
    });
    expect(result.current.requiresOrder).toBe(false);
    expect(result.current.fields.title).toBe("Adéndum LV208");
});
it.each(["adendum", "reunion"])("keeps historical Adéndum relationships immutable when the saved type is %s", (typeCode) => {
    const links: CalendarLink[] = [
        { entityType: "lead", source: "legacy", id: "20519" },
        { entityType: "sales_order", source: "legacy", id: "78" },
    ];
    const event: CalendarEvent = { id: "event", source: "native", originModule: "formalizacion", typeId: typeCode, typeCode, orderLinksLocked: true, title: "Contrato", description: null, location: null, start: "2026-11-03T15:00:00Z", end: "2026-11-03T16:00:00Z", allDay: false, status: "scheduled", version: 1, canEdit: true, formKey: "formalizacion.general.v1", links, details: {} };
    const { result } = renderHook(() => useCalendarEventForm(event, calendar, "2026-11-03", { onSaved: vi.fn() }));
    act(() => {
        result.current.change("typeId", "reunion");
        result.current.change("links", [
            { entityType: "sales_order", source: "legacy", id: "79" },
            { entityType: "note", source: "native", id: "nota" },
        ]);
    });
    expect(result.current.orderContextLocked).toBe(true);
    expect(result.current.fields.links).toEqual([...links, { entityType: "note", source: "native", id: "nota" }]);
});
it.each([0, 1, 2])("selects an order automatically only when the lead has exactly one (%s)", async (count) => {
    const lead = { id: "lead-1", source: "native" as const, label: "Cliente" };
    const orders = Array.from({ length: count }, (_, index) => ({ id: `order-${String(index)}`, source: "native" as const, label: `OV-${String(index + 1)}`, lead }));
    vi.mocked(apiRequest).mockImplementation((path) => {
        if (path.startsWith("/calendar/lookup?")) {
            const query = new URLSearchParams(path.split("?")[1]);
            if (query.get("kind") === "leads") return Promise.resolve({ items: [lead] });
            if (query.get("kind") === "orders") return Promise.resolve({ items: query.get("leads") ? orders.filter((order) => order.label.includes(query.get("search") ?? "")) : [] });
        }
        return Promise.resolve({ items: [] });
    });
    render(<CalendarEventDrawer event={null} date="2026-11-03" calendar={calendar} currentModule="formalizacion" onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "adendum" } });
    fireEvent.click(await screen.findByRole("checkbox", { name: "Cliente" }));
    if (count === 1) {
        const selected = await screen.findByRole("list", { name: "Órdenes de venta vinculadas elegidos" });
        expect(selected).toHaveTextContent("OV-1");
    } else {
        await waitFor(() => {
            expect(vi.mocked(apiRequest).mock.calls.some(([path]) => path.includes("kind=orders") && decodeURIComponent(path).includes("lead-1"))).toBe(true);
        });
        if (count === 2) {
            await screen.findByRole("checkbox", { name: "OV-2" });
            fireEvent.change(screen.getByRole("textbox", { name: "Buscar órdenes de venta vinculadas" }), { target: { value: "OV-1" } });
            await waitFor(() => {
                expect(vi.mocked(apiRequest).mock.calls.some(([path]) => path.includes("search=OV-1"))).toBe(true);
            });
            expect(screen.queryByRole("list", { name: "Órdenes de venta vinculadas elegidos" })).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole("checkbox", { name: "OV-1" }));
            expect(await screen.findByRole("list", { name: "Órdenes de venta vinculadas elegidos" })).toHaveTextContent("OV-1");
            return;
        }
        expect(screen.queryByRole("list", { name: "Órdenes de venta vinculadas elegidos" })).not.toBeInTheDocument();
    }
});

it("ignores a single-order response belonging to a previously selected lead", () => {
    const { result } = renderHook(() => useCalendarEventForm(null, calendar, "2026-11-03", { onSaved: vi.fn() }));
    act(() => {
        result.current.change("links", [{ entityType: "lead", source: "native", id: "new-lead" }]);
    });
    act(() => {
        result.current.autoSelectOnlyOrder({ id: "old-order", source: "native", label: "Old", lead: { id: "old-lead", source: "native", label: "Old client" } }, { entityType: "lead", source: "native", id: "old-lead" });
    });
    expect(result.current.fields.links).toEqual([{ entityType: "lead", source: "native", id: "new-lead" }]);
});
