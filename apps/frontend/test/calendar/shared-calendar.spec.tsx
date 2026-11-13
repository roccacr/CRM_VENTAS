import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { SharedCalendarPage } from "../../src/modules/calendar/SharedCalendarPage";
import { ApiClientError, apiRequest } from "../../src/services/api/api-client";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/api/api-client", async (original) => ({ ...(await original<object>()), apiRequest: vi.fn() }));
const descriptors = ["formalizacion", "mercadeo", "ventas", "contabilidad"].map((moduleCode) => ({ moduleCode, label: ({ formalizacion: "Formalización", mercadeo: "Mercadeo", ventas: "Ventas", contabilidad: "Contabilidad" } as Record<string, string>)[moduleCode], color: "#2563eb", canCreate: true, canUpdate: true, types: [{ id: `type-${moduleCode}`, code: "general", label: "General", color: "#2563eb", formKey: `${moduleCode}.general.v1` }] }));
const permissions = [
    { code: "formalizacion.calendar.read", effect: "allow" },
    { code: "ventas.calendar.read", effect: "allow" },
    { code: "mercadeo.calendar.read", effect: "allow" },
    { code: "mercadeo.calendar.read", effect: "deny" },
];
const event = { id: "event-1", source: "native", originModule: "ventas", typeId: "type-ventas", typeCode: "general", title: "Visita comercial", description: null, location: null, start: "2026-10-28T15:00:00Z", end: "2026-10-28T16:00:00Z", allDay: false, status: "scheduled", version: 3, canEdit: true, formKey: "ventas.general.v1", details: { reference: "Cliente interno" } };
it("renders independent module and type colors on the real calendar event element", async () => {
    const calendars = descriptors.map((calendar) => ({ ...calendar, color: "#b4325a", types: calendar.types.map((type) => ({ ...type, color: "#475569" })) }));
    const colored = { ...event, title: "Evento dos colores", originModule: "formalizacion", typeId: "type-formalizacion" };
    vi.mocked(apiRequest).mockImplementation((path) => Promise.resolve(path === "/calendar/calendars" ? { schemaVersion: 1, calendars } : { schemaVersion: 1, events: [colored] }));
    render(<SharedCalendarPage moduleCode="formalizacion" effectivePermissions={permissions} />);
    const labels = await screen.findAllByText("Evento dos colores");
    const element = labels.map((label) => label.closest<HTMLElement>(".cal-event")).find(Boolean);
    expect(element).toBeDefined();
    expect(element?.style.getPropertyValue("--calendar-module-color")).toBe("#b4325a");
    expect(element?.style.getPropertyValue("--fc-event-color")).toBe("#475569");
    expect(element).toHaveAttribute("title", "Evento dos colores · Formalización · General");
});
it("displays an Outlook-only event without inventing Habita ownership or exposing an editor", async () => {
    const remote = { ...event, id: "outlook-only", source: "outlook", originModule: null, typeId: "", typeCode: "", formKey: "outlook.readonly", canEdit: false, details: {}, title: "Cita personal" };
    vi.mocked(apiRequest).mockImplementation((path) => Promise.resolve(path === "/calendar/calendars" ? { schemaVersion: 1, calendars: descriptors } : { schemaVersion: 1, events: [remote], outlookStatus: "connected" }));
    render(<SharedCalendarPage moduleCode="formalizacion" effectivePermissions={permissions} />);
    fireEvent.click(await screen.findByText("Cita personal"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Evento de Outlook");
    expect(screen.getByRole("dialog")).toHaveTextContent("Este evento está disponible para consulta.");
    expect(screen.queryByRole("button", { name: "Guardar evento" })).toBeNull();
});
beforeEach(() => {
    installBrowserApiDoubles();
    window.history.replaceState(null, "", "/home/formalization/calendar?date=2026-10-28");
    vi.mocked(apiRequest)
        .mockReset()
        .mockImplementation((path) => Promise.resolve(path === "/calendar/calendars" ? { schemaVersion: 1, calendars: descriptors } : { schemaVersion: 1, events: [] }));
});
afterEach(cleanup);
it("keeps the preloader visible until the delayed calendar feed finishes", async () => {
    let finish: (value: unknown) => void = () => {};
    vi.mocked(apiRequest).mockImplementation((path) =>
        path === "/calendar/calendars"
            ? Promise.resolve({ schemaVersion: 1, calendars: descriptors })
            : new Promise((resolve) => {
                  finish = resolve;
              }),
    );
    render(<SharedCalendarPage moduleCode="formalizacion" effectivePermissions={permissions} />);
    await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining("/calendar/events?"));
    });
    expect(screen.getByRole("status", { name: "Cargando eventos" })).toBeVisible();
    expect(screen.getByRole("region", { name: "Calendario de Formalización" })).toHaveAttribute("aria-busy", "true");
    await act(async () => {
        finish({ schemaVersion: 1, events: [event], outlookStatus: "connected" });
        await Promise.resolve();
    });
    expect(await screen.findByText("Visita comercial")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Cargando eventos" })).toBeNull();
    expect(screen.getByRole("region", { name: "Calendario de Formalización" })).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("region", { name: "Calendario de Formalización" }).querySelector(".calendar-surface__body")).toHaveAttribute("aria-hidden", "false");
});
it("renders real calendar views and defaults to the current authorized module only", async () => {
    render(<SharedCalendarPage moduleCode="formalizacion" effectivePermissions={permissions} />);
    expect(await screen.findByRole("checkbox", { name: "Formalización" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Ventas" })).not.toBeChecked();
    expect(screen.queryByRole("checkbox", { name: "Mercadeo" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: "Contabilidad" })).toBeNull();
    for (const view of ["Mes", "Semana", "Día", "Agenda"]) expect(screen.getByText(view, { selector: "button" })).toBeInTheDocument();
    await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining("moduleCodes=formalizacion"));
    });
    fireEvent.click(screen.getByText("Agenda", { selector: "button" }));
    expect(await screen.findByText("No hay eventos para mostrar")).toBeInTheDocument();
});
it("has no Owner bypass and makes no requests without the current module read grant", () => {
    render(<SharedCalendarPage moduleCode="mercadeo" effectivePermissions={permissions} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No tienes permiso");
    expect(apiRequest).not.toHaveBeenCalled();
});
it("opens foreign events read-only using their origin form and offers origin navigation", async () => {
    const navigate = vi.fn();
    vi.mocked(apiRequest).mockImplementation((path) => Promise.resolve(path === "/calendar/calendars" ? { schemaVersion: 1, calendars: descriptors } : { schemaVersion: 1, events: path.includes("ventas") ? [{ ...event, canEdit: false }] : [] }));
    render(<SharedCalendarPage moduleCode="formalizacion" effectivePermissions={permissions} onNavigate={navigate} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Ventas" }));
    fireEvent.click(await screen.findByText("Visita comercial"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Evento de Ventas");
    expect(screen.getByLabelText("Referencia comercial")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar evento" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ir a Ventas" }));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining("/home/sales/calendar?"));
});
it("does not let a stale overlay response restore deselected events", async () => {
    let resolve: (value: unknown) => void = () => {};
    vi.mocked(apiRequest).mockImplementation((path) => {
        if (path === "/calendar/calendars") return Promise.resolve({ schemaVersion: 1, calendars: descriptors });
        if (path.includes("ventas"))
            return new Promise((done) => {
                resolve = done;
            });
        return Promise.resolve({ schemaVersion: 1, events: [] });
    });
    render(<SharedCalendarPage moduleCode="formalizacion" effectivePermissions={permissions} />);
    const overlay = await screen.findByRole("checkbox", { name: "Ventas" });
    fireEvent.click(overlay);
    await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining("ventas"));
    });
    fireEvent.click(overlay);
    await act(async () => {
        resolve({ schemaVersion: 1, events: [event] });
        await Promise.resolve();
    });
    expect(screen.queryByText("Visita comercial")).toBeNull();
});
it("creates with server types, immutable current origin and Costa Rica UTC conversion", async () => {
    vi.mocked(apiRequest).mockImplementation((path, options) => {
        if (options?.method === "POST") return Promise.resolve({ schemaVersion: 1, delivery: { status: "synced" }, event: { ...event, ...(options.body as object), originModule: "formalizacion", typeId: "type-formalizacion", formKey: "formalizacion.general.v1" } });
        return Promise.resolve(path === "/calendar/calendars" ? { schemaVersion: 1, calendars: descriptors } : { schemaVersion: 1, events: [] });
    });
    render(<SharedCalendarPage moduleCode="formalizacion" effectivePermissions={permissions} />);
    fireEvent.click(await screen.findByRole("button", { name: "Nuevo evento" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "type-formalizacion" } });
    fireEvent.change(screen.getByLabelText("Nombre del evento"), { target: { value: "Revisar expediente" } });
    fireEvent.change(screen.getByLabelText("Inicio"), { target: { value: "2026-10-28T09:30" } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-10-28T10:30" } });
    fireEvent.change(screen.getByLabelText("Referencia interna (opcional)"), { target: { value: "OV-208" } });
    fireEvent.click(await screen.findByRole("button", { name: "Guardar evento" }));
    await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith("/calendar/events", expect.objectContaining({ method: "POST", body: expect.objectContaining<Record<string, unknown>>({ moduleCode: "formalizacion", typeId: "type-formalizacion", title: "Revisar expediente", start: "2026-10-28T15:30:00Z", end: "2026-10-28T16:30:00Z", details: { reference: "OV-208", teamsRequested: false }, operationId: expect.any(String) as string }) as unknown }));
    });
    expect(await screen.findByRole("heading", { name: "Evento guardado" })).toBeVisible();
    expect(screen.getByLabelText("Nombre del evento")).not.toBeVisible();
    expect(screen.getByRole("region", { name: "Resultado de sincronización" })).toHaveTextContent("Revisar expediente");
    fireEvent.click(await screen.findByRole("button", { name: "Volver al calendario" }));
    await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});
it("edits a native event only in its origin, preserving version and retry operation", async () => {
    let attempt = 0;
    vi.mocked(apiRequest).mockImplementation((path, options) => {
        if (options?.method === "PATCH") {
            attempt++;
            return attempt === 1 ? Promise.reject(new TypeError("network")) : Promise.resolve({ schemaVersion: 1, delivery: { status: "synced" }, event: { ...event, version: 4 } });
        }
        return Promise.resolve(path === "/calendar/calendars" ? { schemaVersion: 1, calendars: descriptors } : { schemaVersion: 1, events: [event] });
    });
    render(<SharedCalendarPage moduleCode="ventas" effectivePermissions={permissions} />);
    fireEvent.click(await screen.findByText("Visita comercial"));
    fireEvent.change(screen.getByLabelText("Nombre del evento"), { target: { value: "Visita confirmada" } });
    fireEvent.click(await screen.findByRole("button", { name: "Guardar evento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se confirmó el guardado");
    expect(screen.getByLabelText("Nombre del evento")).toBeDisabled();
    fireEvent.click(await screen.findByRole("button", { name: "Guardar evento" }));
    fireEvent.click(await screen.findByRole("button", { name: "Volver al calendario" }));
    await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
    });
    const writes = vi.mocked(apiRequest).mock.calls.filter(([, options]) => options?.method === "PATCH");
    expect(writes).toHaveLength(2);
    expect(writes[0]?.[1]?.body).toMatchObject({ moduleCode: "ventas", expectedVersion: 3, title: "Visita confirmada" });
    expect(writes[1]?.[1]?.body).toEqual(writes[0]?.[1]?.body);
});
it("blocks stale versions and requires a fresh calendar instead of overwriting", async () => {
    vi.mocked(apiRequest).mockImplementation((path, options) => {
        if (options?.method === "PATCH") return Promise.reject(new ApiClientError("conflict", 409, null));
        return Promise.resolve(path === "/calendar/calendars" ? { schemaVersion: 1, calendars: descriptors } : { schemaVersion: 1, events: [event] });
    });
    render(<SharedCalendarPage moduleCode="ventas" effectivePermissions={permissions} />);
    fireEvent.click(await screen.findByText("Visita comercial"));
    fireEvent.click(await screen.findByRole("button", { name: "Guardar evento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Recarga el calendario");
    expect(await screen.findByRole("button", { name: "Guardar evento" })).toBeDisabled();
});
it.each(["legacy", "unknown-form", "not-editable"])("keeps %s events read-only even in their origin", async (restriction) => {
    const restricted = { ...event, source: restriction === "legacy" ? "legacy" : "native", canEdit: restriction !== "not-editable", formKey: restriction === "unknown-form" ? "ventas.unknown.v2" : event.formKey };
    vi.mocked(apiRequest).mockImplementation((path) => Promise.resolve(path === "/calendar/calendars" ? { schemaVersion: 1, calendars: descriptors } : { schemaVersion: 1, events: [restricted] }));
    render(<SharedCalendarPage moduleCode="ventas" effectivePermissions={permissions} />);
    fireEvent.click(await screen.findByText("Visita comercial"));
    expect(screen.getByLabelText("Nombre del evento")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Guardar evento" })).toBeNull();
    expect(vi.mocked(apiRequest).mock.calls.some(([, options]) => options?.method === "PATCH")).toBe(false);
});
it("requests another visible interval and never an empty module selection", async () => {
    render(<SharedCalendarPage moduleCode="formalizacion" effectivePermissions={permissions} />);
    await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining("/calendar/events?"));
    });
    const oldPath = vi
        .mocked(apiRequest)
        .mock.calls.filter(([path]) => path.startsWith("/calendar/events?"))
        .at(-1)?.[0];
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    await waitFor(() => {
        expect(
            vi
                .mocked(apiRequest)
                .mock.calls.filter(([path]) => path.startsWith("/calendar/events?"))
                .at(-1)?.[0],
        ).not.toBe(oldPath);
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "Formalización" }));
    expect(vi.mocked(apiRequest).mock.calls.some(([path]) => path.includes("moduleCodes=&"))).toBe(false);
});
it("sends all-day boundaries at Costa Rica midnight with an exclusive next day", async () => {
    render(<SharedCalendarPage moduleCode="formalizacion" effectivePermissions={permissions} />);
    fireEvent.click(await screen.findByRole("button", { name: "Nuevo evento" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Tipo" }), { target: { value: "type-formalizacion" } });
    fireEvent.change(screen.getByLabelText("Nombre del evento"), { target: { value: "Revisión" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Día completo" }));
    fireEvent.click(await screen.findByRole("button", { name: "Guardar evento" }));
    await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith("/calendar/events", expect.objectContaining({ method: "POST", body: expect.objectContaining<Record<string, unknown>>({ start: "2026-10-28T06:00:00Z", end: "2026-10-29T06:00:00Z", allDay: true }) as unknown }));
    });
});
it("reselects the current calendar when creating after it was unchecked", async () => {
    render(<SharedCalendarPage moduleCode="formalizacion" effectivePermissions={permissions} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Formalización" }));
    fireEvent.click(screen.getByRole("button", { name: "Nuevo evento" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Nuevo evento de Formalización");
    expect(screen.getByRole("checkbox", { name: "Formalización" })).toBeChecked();
});
it("removes a revoked overlay immediately and never requests the denied module again", async () => {
    const view = render(<SharedCalendarPage moduleCode="formalizacion" effectivePermissions={permissions} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Ventas" }));
    await waitFor(() => {
        expect(apiRequest).toHaveBeenCalledWith(expect.stringContaining("ventas"));
    });
    vi.mocked(apiRequest).mockClear();
    view.rerender(<SharedCalendarPage moduleCode="formalizacion" effectivePermissions={[...permissions, { code: "ventas.calendar.read", effect: "deny" }]} />);
    expect(screen.queryByRole("checkbox", { name: "Ventas" })).toBeNull();
    await screen.findByRole("checkbox", { name: "Formalización" });
    expect(vi.mocked(apiRequest).mock.calls.some(([path]) => path.includes("ventas"))).toBe(false);
});
it("clears an old catalog error as soon as a refresh starts", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(new TypeError("network"));
    render(<SharedCalendarPage moduleCode="formalizacion" effectivePermissions={permissions} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("No fue posible cargar");
    vi.mocked(apiRequest).mockImplementation(() => new Promise(() => {}));
    fireEvent.click(screen.getByRole("button", { name: "Recargar calendario" }));
    expect(screen.getByRole("status")).toHaveTextContent("Cargando");
    expect(screen.queryByRole("alert")).toBeNull();
});
it("preserves seconds and milliseconds when editing only an event title", async () => {
    const precise = { ...event, start: "2026-10-28T15:30:12.123Z", end: "2026-10-28T16:45:44.789Z" };
    vi.mocked(apiRequest).mockImplementation((path, options) => {
        if (options?.method === "PATCH") return Promise.resolve({ schemaVersion: 1, event: { ...precise, version: 4 } });
        return Promise.resolve(path === "/calendar/calendars" ? { schemaVersion: 1, calendars: descriptors } : { schemaVersion: 1, events: [precise] });
    });
    render(<SharedCalendarPage moduleCode="ventas" effectivePermissions={permissions} />);
    fireEvent.click(await screen.findByText("Visita comercial"));
    expect(screen.getByLabelText("Inicio")).toHaveValue("2026-10-28T09:30:12.123");
    expect(screen.getByLabelText("Fin")).toHaveValue("2026-10-28T10:45:44.789");
    expect(screen.getByLabelText("Inicio")).toHaveAttribute("step", "0.001");
    expect(screen.getByLabelText("Fin")).toHaveAttribute("step", "0.001");
    fireEvent.change(screen.getByLabelText("Nombre del evento"), { target: { value: "Solo cambia el título" } });
    fireEvent.click(await screen.findByRole("button", { name: "Guardar evento" }));
    await waitFor(() => {
        const write = vi.mocked(apiRequest).mock.calls.find(([, options]) => options?.method === "PATCH");
        expect(write?.[1]?.body).toMatchObject({ title: "Solo cambia el título", start: precise.start, end: precise.end, expectedVersion: 3 });
    });
});

it("opens an API-authorized invitation without origin membership as read-only", async () => {
    vi.mocked(apiRequest).mockImplementation((path) => Promise.resolve(path === "/calendar/calendars" ? { schemaVersion: 1, calendars: descriptors.filter((entry) => entry.moduleCode === "formalizacion") } : { schemaVersion: 1, events: [{ ...event, canEdit: false, location: "Sala", details: { teamsRequested: true } }] }));
    render(<SharedCalendarPage moduleCode="formalizacion" effectivePermissions={[{ code: "formalizacion.calendar.read", effect: "allow" }]} />);
    fireEvent.click(await screen.findByText("Visita comercial"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Evento de Ventas");
    expect(screen.getByLabelText("Lugar")).toHaveValue("Sala");
    expect(screen.getByLabelText("Inicio")).toBeDisabled();
    expect(screen.getByRole("dialog")).toHaveTextContent("Teams: Solicitado");
    expect(screen.queryByRole("button", { name: "Guardar evento" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Invitados internos" })).toBeNull();
    expect(vi.mocked(apiRequest).mock.calls.some(([path]) => path.startsWith("/calendar/lookup"))).toBe(false);
});
