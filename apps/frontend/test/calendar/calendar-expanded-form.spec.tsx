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
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "type" } });
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
    const { result } = renderHook(() => useCalendarEventForm(null, calendar, "2026-10-29", { onSaved: vi.fn() }));
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
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "type" } });
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
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "type" } });
    fireEvent.change(screen.getByLabelText("Nombre del evento"), { target: { value: "Evento listo" } });
    fireEvent.change(screen.getByLabelText("Invitados externos (clientes o terceros)"), { target: { value: "guest@example.com" } });
    const form = screen.getByLabelText("Invitados externos (clientes o terceros)").closest("form");
    if (!form) throw new Error("Missing event form");
    const submit = vi.fn();
    form.addEventListener("submit", submit);
    for (const name of ["Buscar colaboradores de la empresa", "Buscar notas vinculadas", "Buscar leads vinculados", "Buscar órdenes de venta vinculadas", "Invitados externos (clientes o terceros)"]) {
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
        expect(vi.mocked(apiRequest).mock.calls.filter(([path, options]) => path === "/calendar/events" && options?.method === "POST")).toHaveLength(0);
    }
    await user.click(screen.getByRole("button", { name: "Guardar evento" }));
    expect(submit).toHaveBeenCalledTimes(1);
    await waitFor(() => {
        expect(vi.mocked(apiRequest).mock.calls.filter(([path, options]) => path === "/calendar/events" && options?.method === "POST")).toHaveLength(1);
    });
});

it("selecting an order adds its source-qualified lead and filters later order searches", async () => {
    installBrowserApiDoubles();
    vi.mocked(apiRequest).mockImplementation((path) => Promise.resolve(path.includes("kind=orders") ? { items: [{ id: "7", source: "legacy", label: "OV-7", lead: { id: "9", source: "legacy", label: "Cliente de OV-7" } }] } : { items: [] }));
    render(<CalendarEventDrawer event={null} date="2026-11-04" calendar={calendar} currentModule="ventas" onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "type" } });
    const orders = screen.getByRole("group", { name: "Órdenes de venta vinculadas" });
    fireEvent.change(within(orders).getByRole("textbox"), { target: { value: "OV" } });
    fireEvent.click(await within(orders).findByRole("checkbox", { name: "OV-7" }));
    expect(await within(screen.getByRole("group", { name: "Leads vinculados" })).findByRole("checkbox", { name: "Cliente de OV-7" })).toBeChecked();
    await waitFor(() => {
        expect(
            vi.mocked(apiRequest).mock.calls.some(([path]) => {
                const query = new URL(path, "http://test").searchParams;
                return query.get("kind") === "orders" && query.get("leads") === JSON.stringify([{ entityType: "lead", source: "legacy", id: "9" }]);
            }),
        ).toBe(true);
    });
});

it("keeps draft and operation identity frozen after an uncertain save", async () => {
    vi.mocked(apiRequest).mockRejectedValue(new Error("network result unknown"));
    const { result } = renderHook(() => useCalendarEventForm(null, calendar, "2026-11-04", { onSaved: vi.fn() }));
    act(() => {
        result.current.change("typeId", "type");
        result.current.change("title", "Firma");
    });
    await act(() => result.current.save());
    const first = vi.mocked(apiRequest).mock.calls.at(-1)?.[1]?.body;
    act(() => {
        result.current.change("start", "2026-11-04T15:00");
    });
    expect(result.current.fields.start).toBe("2026-11-04T09:00");
    expect(result.current.failure?.uncertain).toBe(true);
    await act(() => result.current.save());
    expect(vi.mocked(apiRequest).mock.calls.at(-1)?.[1]?.body).toEqual(first);
});
it("requires reload after an Outlook version conflict instead of retrying the stale remote version", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, delivery: { status: "conflict" }, event: { id: "confirmed-crm", source: "native", originModule: "ventas", typeId: "type", typeCode: "general", title: "Firma", description: "", location: "", start: "2026-11-04T15:00:00Z", end: "2026-11-04T16:00:00Z", allDay: false, status: "scheduled", version: 1, canEdit: true, formKey: "ventas.general.v1", details: {} } });
    const { result } = renderHook(() => useCalendarEventForm(null, calendar, "2026-11-04", { onSaved: vi.fn() }));
    act(() => {
        result.current.change("typeId", "type");
        result.current.change("title", "Firma");
    });
    await act(async () => {
        await result.current.save();
    });
    expect(result.current.confirmedId).toBe("confirmed-crm");
    expect(result.current.failure).toMatchObject({ stale: true, uncertain: false });
    expect(result.current.failure?.message).toContain("Recarga");
    await act(async () => {
        await result.current.save();
    });
    expect(apiRequest).toHaveBeenCalledTimes(1);
});
it("finishes a confirmed CRM-only save without waiting for Outlook or showing a false synchronization receipt", async () => {
    const onSaved = vi.fn();
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, delivery: { status: "crm_only" }, event: { id: "confirmed-local", source: "native", originModule: "ventas", typeId: "type", typeCode: "general", title: "Firma", description: "", location: "", start: "2026-11-04T15:00:00Z", end: "2026-11-04T16:00:00Z", allDay: false, status: "scheduled", version: 1, canEdit: true, formKey: "ventas.general.v1", details: {} } });
    const { result } = renderHook(() => useCalendarEventForm(null, calendar, "2026-11-04", { onSaved }));
    act(() => {
        result.current.change("typeId", "type");
        result.current.change("title", "Firma");
    });
    await act(async () => {
        await result.current.save();
    });
    expect(onSaved).toHaveBeenCalledOnce();
    expect(result.current.failure).toBeNull();
    expect(result.current.receipt).toBeNull();
});
it.each([
    [false, "available", "Disponible"],
    [true, "busy", "No disponible"],
    [false, "unknown", "Sin confirmar"],
] as const)("selects a real Microsoft room (%s, %s)", async (freeLocation, availability, statusLabel) => {
    installBrowserApiDoubles();
    const user = userEvent.setup();
    vi.mocked(apiRequest).mockImplementation((path) => Promise.resolve(path.startsWith("/calendar/rooms?") ? { status: "connected", data: [{ address: "warroom@test.test", label: "War Room", capacity: 8, availability }] } : path === "/calendar/availability" ? { status: "connected", data: { events: [], conflicts: [], suggestions: [], incomplete: false } } : { items: [] }));
    render(<CalendarEventDrawer event={null} date="2026-11-04" calendar={calendar} currentModule="ventas" onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "type" } });
    fireEvent.change(screen.getByLabelText("Nombre del evento"), { target: { value: "Reunión" } });
    const place = screen.getByRole("combobox", { name: "Lugar" });
    await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith(expect.stringMatching(/^\/calendar\/rooms\?moduleCode=ventas&start=.+&end=.+$/));
    });
    await user.type(place, "War");
    const option = await screen.findByText("War Room · 8 personas");
    await waitFor(() => {
        expect(screen.getByText(statusLabel)).toBeInTheDocument();
    });
    expect(option.parentElement?.querySelector(".calendar-room-dot")).toHaveAttribute("data-availability", availability);
    await user.click(option);
    expect(place).toHaveValue("War Room");
    if (freeLocation) {
        await user.clear(place);
        await user.type(place, "Oficina externa");
    }
    fireEvent.click(screen.getByRole("button", { name: "Guardar evento" }));
    await waitFor(() => {
        const body = vi.mocked(apiRequest).mock.calls.find(([path]) => path === "/calendar/events")?.[1]?.body;
        expect(body).toMatchObject({ location: freeLocation ? "Oficina externa" : "War Room" });
        if (freeLocation) expect(body).toHaveProperty("details", { teamsRequested: false });
        else expect(body).toMatchObject({ details: { roomAddress: "warroom@test.test" } });
    });
});

it("shows the Teams choice next to the event fields without opening Participants", () => {
    installBrowserApiDoubles();
    vi.mocked(apiRequest).mockResolvedValue({ items: [] });
    render(<CalendarEventDrawer event={null} date="2026-11-04" calendar={calendar} currentModule="ventas" onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()} />);
    const teams = screen.getByRole("checkbox", { name: "Reunión de Microsoft Teams" });
    expect(teams.closest("details")).toBeNull();
});
it("adds comma-separated colleagues once and sends external emails with the Teams preference", async () => {
    installBrowserApiDoubles();
    vi.mocked(apiRequest).mockImplementation((path) =>
        Promise.resolve(
            path.includes("kind=users")
                ? {
                      items: [
                          { id: "ana", source: "native", label: "Ana", secondary: "ana@example.test" },
                          { id: "luis", source: "native", label: "Luis", secondary: "luis@example.test" },
                      ],
                  }
                : path.startsWith("/calendar/rooms?")
                  ? { status: "connected", data: [] }
                  : path === "/calendar/availability"
                    ? { status: "connected", data: { events: [], conflicts: [], suggestions: [], incomplete: false } }
                    : { items: [] },
        ),
    );
    render(<CalendarEventDrawer event={null} date="2026-11-04" calendar={calendar} currentModule="ventas" onClose={vi.fn()} onSaved={vi.fn()} onRefresh={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "type" } });
    fireEvent.change(screen.getByLabelText("Nombre del evento"), { target: { value: "Reunión" } });
    fireEvent.click(screen.getByText("Participantes"));
    fireEvent.change(screen.getByRole("textbox", { name: "Buscar colaboradores de la empresa" }), { target: { value: "ana@example.test, luis@example.test, ana@example.test" } });
    const chips = await screen.findByRole("list", { name: "Colaboradores de la empresa elegidos" });
    expect(within(chips).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Invitados externos (clientes o terceros)"), { target: { value: "guest1@example.test, guest2@example.test" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Reunión de Microsoft Teams" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar evento" }));
    await waitFor(() => {
        const body = vi.mocked(apiRequest).mock.calls.find(([path]) => path === "/calendar/events")?.[1]?.body;
        expect(body).toMatchObject({ details: { teamsRequested: true }, participants: [{ userId: "ana" }, { userId: "luis" }, { email: "guest1@example.test" }, { email: "guest2@example.test" }] });
    });
});
