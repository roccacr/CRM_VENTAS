import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { CalendarEventDrawer } from "../../src/modules/calendar/CalendarEventDrawer";
import { FormalizationCalendarQuickCreate } from "../../src/modules/home/FormalizationCalendarQuickCreate";
import { GlobalHomeShell } from "../../src/modules/home/GlobalHomeShell";
import { getCalendars } from "../../src/services/calendar/calendar-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/calendar/calendar-service", () => ({ getCalendars: vi.fn() }));
vi.mock("../../src/modules/calendar/CalendarEventDrawer", () => ({
    CalendarEventDrawer: vi.fn(({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) => (
        <div role="dialog" aria-label="Nuevo evento de Formalización">
            <button onClick={onSaved}>Guardar evento</button>
            <button onClick={onClose}>Cerrar evento</button>
        </div>
    )),
}));
const permissions: NonNullable<ComponentProps<typeof GlobalHomeShell>["effectivePermissions"]> = [
    { code: "formalizacion.home.read", effect: "allow" },
    { code: "formalizacion.calendar.read", effect: "allow" },
];
const calendar = { moduleCode: "formalizacion" as const, label: "Formalización", color: "#000", canCreate: true, canUpdate: true, types: [{ id: "reunion", code: "reunion", label: "Reunión", color: "#000", formKey: "formalizacion.general.v1" }] };
function shell(props: Partial<ComponentProps<typeof GlobalHomeShell>> = {}) {
    return (
        <GlobalHomeShell initialWorkspaceCode="formalization" activeMenuItemCode="formalization-management" effectivePermissions={permissions} orgUnits={[{ code: "formalizacion", status: "active" }]} {...props}>
            Pantalla actual de la orden
        </GlobalHomeShell>
    );
}
beforeEach(() => {
    installBrowserApiDoubles();
    window.history.replaceState({}, "", "/home/formalization/orders?orderSource=legacy&orderId=78");
    vi.mocked(getCalendars).mockResolvedValue([calendar]);
});
afterEach(() => {
    cleanup();
    vi.resetAllMocks();
    window.history.replaceState({}, "", "/");
});

it.each(["Guardar evento", "Cerrar evento"])("opens an empty Formalización form from the white header and stays on the same URL after %s", async (action) => {
    const onNavigate = vi.fn();
    const url = window.location.href;
    render(shell({ onMenuItemSelect: onNavigate }));
    const header = within(screen.getByRole("banner", { name: "Barra superior global Habita" }));
    fireEvent.click(await header.findByRole("button", { name: "Nuevo evento de Formalización" }));
    expect(screen.getByRole("dialog", { name: "Nuevo evento de Formalización" })).toBeInTheDocument();
    const props = vi.mocked(CalendarEventDrawer).mock.calls.at(-1)?.[0];
    expect(props).toMatchObject({ event: null, currentModule: "formalizacion", calendar });
    expect(props).not.toHaveProperty("orderContext");
    expect(props).not.toHaveProperty("range");
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(screen.queryByRole("dialog", { name: "Nuevo evento de Formalización" })).not.toBeInTheDocument();
    expect(window.location.href).toBe(url);
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByText("Pantalla actual de la orden")).toBeInTheDocument();
});
it.each([{ effectivePermissions: [] }, { effectivePermissions: [...permissions, { code: "formalizacion.calendar.read", effect: "deny" as const }] }])("does not expose quick creation without effective calendar read permission", ({ effectivePermissions }) => {
    render(shell({ effectivePermissions: [...effectivePermissions, { code: "formalizacion.home.read", effect: "allow" }] }));
    expect(screen.queryByRole("button", { name: "Nuevo evento de Formalización" })).not.toBeInTheDocument();
    expect(getCalendars).not.toHaveBeenCalled();
});
it.each([
    { ...calendar, canCreate: false },
    { ...calendar, types: [] },
])("does not expose creation when the authoritative descriptor denies it", async (descriptor) => {
    vi.mocked(getCalendars).mockResolvedValue([descriptor]);
    render(shell());
    await act(async () => {
        await Promise.resolve();
    });
    expect(screen.queryByRole("button", { name: "Nuevo evento de Formalización" })).not.toBeInTheDocument();
});
it("is scoped to Formalización and does not query its calendar from another workspace", () => {
    render(
        shell({
            initialWorkspaceCode: "sales",
            effectivePermissions: [...permissions, { code: "lead.read", effect: "allow" }],
            orgUnits: [
                { code: "formalizacion", status: "active" },
                { code: "ventas", status: "active" },
            ],
        }),
    );
    expect(screen.queryByRole("button", { name: "Nuevo evento de Formalización" })).not.toBeInTheDocument();
    expect(getCalendars).not.toHaveBeenCalled();
});
it("closes the draft and revalidates creation when calendar permissions change", async () => {
    const view = render(shell());
    fireEvent.click(await screen.findByRole("button", { name: "Nuevo evento de Formalización" }));
    vi.mocked(getCalendars).mockResolvedValueOnce([{ ...calendar, canCreate: false }]);
    view.rerender(shell({ effectivePermissions: [...permissions, { code: "formalizacion.calendar.create", effect: "deny" }] }));
    await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Nuevo evento de Formalización" })).not.toBeInTheDocument();
});

const marketingCalendar = { ...calendar, moduleCode: "mercadeo" as const, label: "Mercadeo", types: [{ id: "reunion", code: "reunion", label: "Reunión", color: "#000", formKey: "mercadeo.general.v1" }] };
const marketingPermissions: NonNullable<ComponentProps<typeof GlobalHomeShell>["effectivePermissions"]> = [
    { code: "mercadeo.home.read", effect: "allow" },
    { code: "mercadeo.calendar.read", effect: "allow" },
];
it.each(["Guardar evento", "Cerrar evento"])("opens a clean Mercadeo event in the header and preserves the page after %s", async (action) => {
    window.history.replaceState({}, "", "/home/marketing/leads");
    const url = window.location.href;
    const navigate = vi.fn();
    vi.mocked(getCalendars).mockResolvedValue([calendar, marketingCalendar]);
    render(shell({ initialWorkspaceCode: "marketing", effectivePermissions: marketingPermissions, orgUnits: [{ code: "mercadeo", status: "active" }], onMenuItemSelect: navigate }));
    const header = within(screen.getByRole("banner", { name: "Barra superior global Habita" }));
    fireEvent.click(await header.findByRole("button", { name: "Nuevo evento de Mercadeo" }));
    const props = vi.mocked(CalendarEventDrawer).mock.calls.at(-1)?.[0];
    expect(props).toMatchObject({ event: null, currentModule: "mercadeo", calendar: marketingCalendar });
    expect(props).not.toHaveProperty("orderContext");
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(window.location.href).toBe(url);
    expect(navigate).not.toHaveBeenCalled();
});
it.each(["missing", "deny", "descriptor"])("does not expose Mercadeo quick creation for %s access", async (scenario) => {
    vi.mocked(getCalendars).mockResolvedValue([{ ...marketingCalendar, canCreate: scenario !== "descriptor" }]);
    const effectivePermissions = scenario === "missing" ? marketingPermissions.slice(0, 1) : [...marketingPermissions, ...(scenario === "deny" ? [{ code: "mercadeo.calendar.read", effect: "deny" as const }] : [])];
    render(shell({ initialWorkspaceCode: "marketing", effectivePermissions, orgUnits: [{ code: "mercadeo", status: "active" }] }));
    await act(async () => {
        await Promise.resolve();
    });
    expect(screen.queryByRole("button", { name: "Nuevo evento de Mercadeo" })).not.toBeInTheDocument();
});

it.each([
    ["sales", "ventas", "Ventas"],
    ["accounting", "contabilidad", "Contabilidad"],
] as const)("opens the correct empty calendar from workspace %s", async (workspace, moduleCode, label) => {
    const descriptor = { ...calendar, moduleCode, label, types: [{ id: "reunion", code: "reunion", label: "Reunión", color: "#000", formKey: `${moduleCode}.general.v1` }] };
    vi.mocked(getCalendars).mockResolvedValue([calendar, descriptor]);
    render(
        shell({
            initialWorkspaceCode: workspace,
            orgUnits: [{ code: moduleCode, status: "active" }],
            effectivePermissions: [
                { code: `${moduleCode}.home.read`, effect: "allow" },
                { code: `${moduleCode}.calendar.read`, effect: "allow" },
            ],
        }),
    );
    fireEvent.click(await screen.findByRole("button", { name: `Nuevo evento de ${label}` }));
    expect(vi.mocked(CalendarEventDrawer).mock.calls.at(-1)?.[0]).toMatchObject({ event: null, currentModule: moduleCode, calendar: descriptor });
});
it("restores Formalización after switching back from Mercadeo and closes the previous draft", async () => {
    vi.mocked(getCalendars).mockResolvedValue([calendar, marketingCalendar]);
    const props = {
        effectivePermissions: [...permissions, ...marketingPermissions],
        orgUnits: [
            { code: "formalizacion", status: "active" },
            { code: "mercadeo", status: "active" },
        ],
    };
    const view = render(<FormalizationCalendarQuickCreate workspaceCode="formalization" permissions={props.effectivePermissions} />);
    fireEvent.click(await screen.findByRole("button", { name: "Nuevo evento de Formalización" }));
    view.rerender(<FormalizationCalendarQuickCreate workspaceCode="marketing" permissions={props.effectivePermissions} />);
    await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(await screen.findByRole("button", { name: "Nuevo evento de Mercadeo" })).toBeInTheDocument();
    view.rerender(<FormalizationCalendarQuickCreate workspaceCode="formalization" permissions={props.effectivePermissions} />);
    fireEvent.click(await screen.findByRole("button", { name: "Nuevo evento de Formalización" }));
    expect(vi.mocked(CalendarEventDrawer).mock.calls.at(-1)?.[0]).toMatchObject({ event: null, currentModule: "formalizacion" });
});
