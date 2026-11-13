import "@testing-library/jest-dom/vitest";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CALENDAR_CONTEXT } from "../../src/modules/calendar/calendar-config";
import { SharedCalendarPage } from "../../src/modules/calendar/SharedCalendarPage";
import { apiRequest } from "../../src/services/api/api-client";
import { CALENDAR_MODULES, type CalendarDescriptor, type CalendarEvent, type CalendarEventCommand } from "../../src/services/calendar/calendar-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/api/api-client", async (original) => ({ ...(await original<object>()), apiRequest: vi.fn() }));
interface TypeDefinition {
    codigo: string;
    tipo: string;
    color: string;
    modulos: string[];
}
const definitions = JSON.parse(readFileSync(resolve(process.cwd(), "../api/src/modules/crm/calendar/calendar-event-types.json"), "utf8")) as TypeDefinition[];
// Synthetic public IDs exist only in the substituted HTTP catalog; no database fixtures or migrations.
const calendars: CalendarDescriptor[] = CALENDAR_MODULES.filter((moduleCode) => moduleCode !== "ventas").map((moduleCode, moduleIndex) => ({
    moduleCode,
    label: CALENDAR_CONTEXT[moduleCode].label,
    color: "#000000",
    canCreate: true,
    canUpdate: true,
    types: definitions.filter((type) => type.modulos.includes(moduleCode)).map((type, index) => ({ id: `01ARZ3NDEKTSV4RRFFQ69G5F${String(moduleIndex)}${String(index)}`, code: type.codigo, label: type.tipo, color: type.color, formKey: `${moduleCode}.general.v1` })),
}));
const permissions = CALENDAR_MODULES.map((module) => ({ code: `${module}.calendar.read`, effect: "allow" }));
beforeEach(() => {
    installBrowserApiDoubles();
    window.history.replaceState(null, "", "/home/formalization/calendar?date=2026-10-28");
    vi.mocked(apiRequest).mockReset();
});
afterEach(cleanup);

it("uses the actual global JSON's current labels, colors and module memberships", () => {
    expect(definitions.map(({ codigo, tipo, color }) => ({ codigo, tipo, color }))).toEqual([
        { codigo: "tarea", tipo: "Tarea", color: "#475569" },
        { codigo: "reunion", tipo: "Reunión", color: "#4F46E5" },
        { codigo: "cita", tipo: "Cita", color: "#0F766E" },
        { codigo: "seguimiento", tipo: "Seguimiento", color: "#B45309" },
        { codigo: "formalizacion_bancaria", tipo: "Formalización bancaria", color: "#0369A1" },
        { codigo: "adendum", tipo: "Adéndum", color: "#7C3AED" },
    ]);
    for (const type of definitions) expect(type.modulos).toEqual(type.codigo === "cita" ? ["mercadeo", "ventas"] : ["formalizacion_bancaria", "adendum"].includes(type.codigo) ? ["formalizacion"] : [...CALENDAR_MODULES]);
});

it.each(calendars)("selects and persists the server's reunion public ID in $moduleCode", async (calendar) => {
    const reunion = calendar.types.find((type) => type.code === "reunion");
    if (!reunion) throw new Error("Missing reunion in the real catalog");
    let persisted: CalendarEvent | null = null;
    vi.mocked(apiRequest).mockImplementation((path, options) => {
        if (options?.method === "POST" && path === "/calendar/events") {
            const command = options.body as CalendarEventCommand;
            persisted = { ...command, id: "01ARZ3NDEKTSV4RRFFQ69G5FZZ", source: "native", originModule: command.moduleCode, typeCode: "reunion", description: command.description ?? null, location: command.location ?? null, status: "scheduled", version: 1, canEdit: true, formKey: `${command.moduleCode}.general.v1` };
            return Promise.resolve({ schemaVersion: 1, event: persisted, delivery: { status: "synced" } });
        }
        return Promise.resolve(path === "/calendar/calendars" ? { schemaVersion: 1, calendars } : { schemaVersion: 1, events: persisted ? [persisted] : [] });
    });
    render(<SharedCalendarPage moduleCode={calendar.moduleCode} effectivePermissions={permissions} />);
    fireEvent.click(await screen.findByRole("button", { name: "Nuevo evento" }));
    const selector = screen.getByRole("combobox", { name: "Tipo" });
    expect(selector).toHaveValue("");
    expect(selector).toBeRequired();
    expect(
        within(selector)
            .getAllByRole("option")
            .map((option) => option.textContent),
    ).toEqual(["Selecciona un tipo", ...calendar.types.map((type) => type.label)]);
    fireEvent.change(selector, { target: { value: reunion.id } });
    fireEvent.change(screen.getByLabelText("Nombre del evento"), { target: { value: "Reunión de coordinación" } });
    fireEvent.change(screen.getByLabelText("Inicio"), { target: { value: "2026-10-28T09:00" } });
    fireEvent.change(screen.getByLabelText("Fin"), { target: { value: "2026-10-28T10:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar evento" }));
    await waitFor(() => {
        const write = vi.mocked(apiRequest).mock.calls.find(([path, options]) => path === "/calendar/events" && options?.method === "POST");
        expect(write?.[1]?.body).toMatchObject({ moduleCode: calendar.moduleCode, typeId: reunion.id, publishToCalendar: true });
        expect(write?.[1]?.body).not.toHaveProperty("typeCode");
    });
    fireEvent.click(await screen.findByRole("button", { name: "Volver al calendario" }));
    await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
    });
    const surface = screen.getByRole("region", { name: `Calendario de ${calendar.label}` });
    fireEvent.click(await within(surface).findByText("Reunión de coordinación"));
    expect(screen.getByRole("combobox", { name: "Tipo" })).toHaveValue(reunion.id);
    expect(screen.getByRole("option", { name: "Reunión" })).toHaveProperty("selected", true);
});

it.each(calendars)("renders each real type color in FullCalendar for $moduleCode", async (calendar) => {
    const events: CalendarEvent[] = calendar.types.map((type, index) => ({
        id: `01ARZ3NDEKTSV4RRFFQ69G5FZ${String(index)}`,
        source: "native",
        originModule: calendar.moduleCode,
        typeId: type.id,
        typeCode: type.code,
        title: `Evento ${type.label}`,
        description: null,
        location: null,
        start: new Date(Date.UTC(2026, 9, 28 + index, 15)).toISOString(),
        end: new Date(Date.UTC(2026, 9, 28 + index, 16)).toISOString(),
        allDay: false,
        status: "scheduled",
        version: 1,
        canEdit: true,
        formKey: type.formKey,
        details: {},
    }));
    vi.mocked(apiRequest).mockImplementation((path) => Promise.resolve(path === "/calendar/calendars" ? { schemaVersion: 1, calendars } : { schemaVersion: 1, events }));
    render(<SharedCalendarPage moduleCode={calendar.moduleCode} effectivePermissions={permissions} />);
    const surface = screen.getByRole("region", { name: `Calendario de ${calendar.label}` });
    for (const type of calendar.types) {
        const title = await within(surface).findByText(`Evento ${type.label}`);
        expect(title.closest<HTMLElement>(".cal-event")?.style.getPropertyValue("--fc-event-color")).toBe(type.color);
    }
});
