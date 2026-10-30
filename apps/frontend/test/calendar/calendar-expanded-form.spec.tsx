import "@testing-library/jest-dom/vitest";

import { act, cleanup, createEvent, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";

import { CalendarEventDrawer } from "../../src/modules/calendar/CalendarEventDrawer";
import { useCalendarEventForm } from "../../src/modules/calendar/useCalendarEventForm";
import { apiRequest } from "../../src/services/api/api-client";
import { type CalendarDescriptor, type CalendarEvent, getCalendarEvents, getCalendarLookup } from "../../src/services/calendar/calendar-service";
import { installBrowserApiDoubles } from "../support/browser";
vi.mock("../../src/services/api/api-client", async (original) => ({ ...(await original<object>()), apiRequest: vi.fn() }));
const calendar: CalendarDescriptor = { moduleCode: "ventas", label: "Ventas", color: "#000000", canCreate: true, canUpdate: true, types: [{ id: "type", code: "general", label: "General", color: "#000000", formKey: "ventas.general.v1" }] };
afterEach(() => {
    cleanup();
    vi.mocked(apiRequest).mockReset();
});
it("scopes lookup to origin and rejects legacy users", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ items: [{ id: "user", source: "legacy", label: "Unavailable" }] });
    await expect(getCalendarLookup("users", "a & b", "ventas")).rejects.toThrow();
    expect(apiRequest).toHaveBeenLastCalledWith("/calendar/lookup?kind=users&search=a+%26+b&moduleCode=ventas");
});
it("retains native and legacy identities with the same id independently", async () => {
    installBrowserApiDoubles();
    vi.mocked(apiRequest).mockResolvedValue({
        items: [
            { id: "same", source: "native", label: "Nota" },
            { id: "same", source: "legacy", label: "Nota" },
        ],
    });
    render(<CalendarEventDrawer event={null} date="2026-10-29" calendar={calendar} currentModule="ventas" onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()} />);
    await screen.findAllByRole("checkbox", { name: "Nota" });
    expect(screen.queryByText(/\((?:Legacy|Nativo)\)/)).not.toBeInTheDocument();
    // Each linked record picker gets the same substituted results, so select within Notes.
    const type = screen.getByRole("combobox", { name: "Tipo" });
    const title = screen.getByLabelText("Nombre del evento");
    expect(type.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("region", { name: "Relaciones" })).toBeTruthy();
    const notes = screen.getByRole("group", { name: "Notas vinculadas" });
    const inputs = notes.querySelectorAll("input[type=checkbox]");
    if (!inputs[0] || !inputs[1]) throw new Error("Missing options");
    fireEvent.click(inputs[0]);
    fireEvent.click(inputs[1]);
    expect(inputs[0]).toBeChecked();
    expect(inputs[1]).toBeChecked();
});
it("validates emails and sends identities, Teams preference and existing reference", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error("unconfirmed"));
    const { result } = renderHook(() => useCalendarEventForm(null, calendar, "2026-10-29", vi.fn()));
    act(() => {
        result.current.change("typeId", "type");
        result.current.change("title", "Meeting");
        result.current.change("externalEmails", "invalid");
    });
    await act(() => result.current.save());
    expect(apiRequest).not.toHaveBeenCalled();
    act(() => {
        result.current.change("externalEmails", "A@example.com; a@example.com");
        result.current.change("userIds", ["public-user"]);
        result.current.change("teamsRequested", true);
        result.current.change("reference", "OV");
        result.current.change("links", [{ entityType: "lead", source: "legacy", id: "17" }]);
    });
    await act(() => result.current.save());
    expect(vi.mocked(apiRequest).mock.calls.at(-1)?.[1]?.body).toMatchObject({ participants: [{ userId: "public-user" }, { email: "a@example.com" }], links: [{ entityType: "lead", source: "legacy", id: "17" }], details: { reference: "OV", teamsRequested: true } });
    await waitFor(() => {
        expect(result.current.failure?.uncertain).toBe(true);
    });
});

it("omits restricted relations from PATCH and hides relation lookups", async () => {
    installBrowserApiDoubles();
    vi.mocked(apiRequest).mockResolvedValue({ items: [] });
    const event: CalendarEvent = { id: "restricted-event", source: "native", originModule: "ventas", typeId: "type", typeCode: "general", title: "Restricted", description: null, location: null, start: "2026-10-29T15:00:00Z", end: "2026-10-29T16:00:00Z", allDay: false, status: "scheduled", version: 3, canEdit: true, formKey: "ventas.general.v1", details: {}, linksEditable: false };
    render(<CalendarEventDrawer event={event} date="2026-10-29" calendar={calendar} currentModule="ventas" onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText("Relaciones restringidas; se conservan sin cambios")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Notas vinculadas" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Guardar evento" }));
    await waitFor(() => {
        const write = vi.mocked(apiRequest).mock.calls.find(([, options]) => options?.method === "PATCH");
        expect(write?.[1]?.body).toBeDefined();
        expect(write?.[1]?.body).not.toHaveProperty("links");
        expect(write?.[1]?.body).toHaveProperty("expectedVersion", 3);
    });
    expect(vi.mocked(apiRequest).mock.calls.some(([path]) => /kind=(notes|leads|orders)/.test(path))).toBe(false);
});

it("keeps selected labels and secondary text across changed and cleared searches", async () => {
    installBrowserApiDoubles();
    vi.mocked(apiRequest).mockImplementation((path) => {
        const query = new URL(path, "https://crm.test").searchParams;
        return Promise.resolve({
            items:
                query.get("kind") === "leads" && query.get("search") === ""
                    ? [
                          { id: "same", source: "native", label: "Lead nativo", secondary: "Proyecto" },
                          { id: "same", source: "legacy", label: "Lead anterior" },
                      ]
                    : [],
        });
    });
    render(<CalendarEventDrawer event={null} date="2026-10-29" calendar={calendar} currentModule="ventas" onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()} />);
    const leads = within(screen.getByRole("group", { name: "Leads vinculados" }));
    fireEvent.click(await leads.findByRole("checkbox", { name: "Lead nativo · Proyecto" }));
    fireEvent.click(leads.getByRole("checkbox", { name: "Lead anterior" }));
    const search = leads.getByRole("textbox", { name: "Buscar leads vinculados" });
    fireEvent.change(search, { target: { value: "sin resultados" } });
    expect(leads.getByRole("checkbox", { name: "Lead nativo · Proyecto" })).toBeChecked();
    await leads.findByText("Sin resultados autorizados.");
    expect(leads.getByRole("checkbox", { name: "Lead anterior" })).toBeChecked();
    fireEvent.change(search, { target: { value: "" } });
    expect(leads.getByRole("checkbox", { name: "Lead nativo · Proyecto" })).toBeChecked();
    expect(leads.getByRole("checkbox", { name: "Lead anterior" })).toBeChecked();
});

it("reopens a selected legacy order using authorized metadata without sending labels", async () => {
    installBrowserApiDoubles();
    const persisted = {
        id: "existing-event",
        source: "native",
        originModule: "ventas",
        typeId: "type",
        typeCode: "general",
        title: "Existing",
        description: null,
        location: null,
        start: "2026-10-29T15:00:00Z",
        end: "2026-10-29T16:00:00Z",
        allDay: false,
        status: "scheduled",
        version: 3,
        canEdit: true,
        formKey: "ventas.general.v1",
        details: {},
        links: [{ entityType: "sales_order", source: "legacy", id: "opaque-order-id" }],
        selectionOptions: { users: [], notes: [], leads: [], orders: [{ id: "opaque-order-id", source: "legacy", label: "Orden de cliente", secondary: "Proyecto autorizado" }] },
    };
    vi.mocked(apiRequest).mockImplementation((path, options) => Promise.resolve(path.startsWith("/calendar/lookup") ? { items: [] } : options?.method === "PATCH" ? { schemaVersion: 1, event: persisted } : { schemaVersion: 1, events: [persisted] }));
    const [event] = await getCalendarEvents(["ventas"], { start: persisted.start, end: persisted.end }, "ventas");
    if (!event) throw new Error("Missing parsed event");
    render(<CalendarEventDrawer event={event} date="2026-10-29" calendar={calendar} currentModule="ventas" onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()} />);
    const orders = within(screen.getByRole("group", { name: "Órdenes de venta vinculadas" }));
    expect(orders.getByRole("checkbox", { name: "Orden de cliente · Proyecto autorizado" })).toBeChecked();
    expect(orders.queryByText(/opaque-order-id/)).toBeNull();
    fireEvent.change(orders.getByRole("textbox", { name: "Buscar órdenes de venta vinculadas" }), { target: { value: "otro" } });
    await orders.findByText("Sin resultados autorizados.");
    expect(orders.getByRole("checkbox", { name: "Orden de cliente · Proyecto autorizado" })).toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Guardar evento" }));
    await waitFor(() => {
        const write = vi.mocked(apiRequest).mock.calls.find(([, options]) => options?.method === "PATCH");
        expect(write?.[1]?.body).toHaveProperty("links", persisted.links);
        expect(write?.[1]?.body).not.toHaveProperty("selectionOptions");
    });
});

it("does not submit on Enter in lookup searches or external emails, but still saves explicitly", async () => {
    installBrowserApiDoubles();
    const user = userEvent.setup();
    vi.mocked(apiRequest).mockResolvedValue({ items: [] });
    render(<CalendarEventDrawer event={null} date="2026-10-29" calendar={calendar} currentModule="ventas" onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "type" } });
    fireEvent.change(screen.getByLabelText("Nombre del evento"), { target: { value: "Evento listo" } });
    fireEvent.change(screen.getByLabelText("Correos de invitados externos"), { target: { value: "guest@example.com" } });
    const form = screen.getByLabelText("Correos de invitados externos").closest("form");
    if (!form) throw new Error("Missing event form");
    const submit = vi.fn();
    form.addEventListener("submit", submit);
    for (const name of ["Buscar invitados internos", "Buscar notas vinculadas", "Buscar leads vinculados", "Buscar órdenes de venta vinculadas", "Correos de invitados externos"]) {
        const input = screen.getByRole("textbox", { name });
        const enter = createEvent.keyDown(input, { key: "Enter", bubbles: true, cancelable: true });
        fireEvent(input, enter);
        expect(enter.defaultPrevented, name).toBe(true);
        const otherKey = createEvent.keyDown(input, { key: "a", bubbles: true, cancelable: true });
        fireEvent(input, otherKey);
        expect(otherKey.defaultPrevented, name).toBe(false);
        await user.click(input);
        await user.keyboard("{Enter}");
        expect(submit).not.toHaveBeenCalled();
        expect(vi.mocked(apiRequest).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(0);
    }
    await user.click(screen.getByRole("button", { name: "Guardar evento" }));
    expect(submit).toHaveBeenCalledTimes(1);
    await waitFor(() => {
        expect(vi.mocked(apiRequest).mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
    });
});
