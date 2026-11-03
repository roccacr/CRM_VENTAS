import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationScheduleEvent } from "../../src/modules/home/FormalizationScheduleEvent";
import { getCalendarLookup, getCalendars } from "../../src/services/calendar/calendar-service";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/calendar/calendar-service", () => ({ getCalendars: vi.fn(), getCalendarLookup: vi.fn() }));
vi.mock("../../src/modules/calendar/CalendarEventDrawer", () => ({
    CalendarEventDrawer: ({ orderContext, onClose }: { orderContext: unknown; onClose: () => void }) => (
        <div role="dialog">
            <pre>{JSON.stringify(orderContext)}</pre>
            <button onClick={onClose}>Cerrar evento</button>
        </div>
    ),
}));
const permissions = [
    { code: "formalizacion.calendar.read", effect: "allow" },
    { code: "formalizacion.calendar.assign_lead", effect: "allow" },
];
const calendar = { moduleCode: "formalizacion" as const, label: "Formalización", color: "#000", canCreate: true, canUpdate: true, types: [{ id: "tarea", code: "tarea", label: "Tarea", color: "#000", formKey: "formalizacion.general.v1" }] };
const item: FollowUpItem = { id: "legacy:78", source: "legacy", number: "LV208", nativeCode: null, client: "Nombre no usado como identidad", project: { id: "p", name: "Proyecto" }, unit: null, responsible: null, seller: null, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null }, nextStep: "Registrar envío", completedThisYear: false };
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(getCalendars).mockResolvedValue([calendar]);
    vi.mocked(getCalendarLookup).mockResolvedValue([{ id: "78", source: "legacy", label: "LV208", lead: { id: "canonical-client", source: "native", label: "Cliente canónico" } }]);
});
afterEach(() => {
    cleanup();
    vi.resetAllMocks();
});

it.each(["native", "legacy"] as const)("opens an event on the same screen with the exact %s order and canonical client", async (source) => {
    const originalUrl = window.location.href;
    const id = source === "native" ? "01ARZ3NDEKTSV4RRFFQ69G5FAV" : "78";
    vi.mocked(getCalendarLookup).mockResolvedValue([{ id, source, label: "LV208", lead: { id: "canonical-client", source: "native", label: "Cliente canónico" } }]);
    render(<FormalizationScheduleEvent item={{ ...item, source, id }} effectivePermissions={permissions} />);
    fireEvent.click(await screen.findByRole("button", { name: "Agendar evento" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent('"reference":"LV208"');
    expect(dialog).toHaveTextContent('"id":"canonical-client","source":"native"');
    expect(dialog).not.toHaveTextContent("Nombre no usado como identidad");
    expect(getCalendarLookup).toHaveBeenCalledWith("orders", "LV208", "formalizacion");
    expect(window.location.href).toBe(originalUrl);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar evento" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it("requires a confirmed client relationship before opening the draft", async () => {
    vi.mocked(getCalendarLookup).mockResolvedValue([{ id: "78", source: "legacy", label: "LV208" }]);
    render(<FormalizationScheduleEvent item={item} effectivePermissions={permissions} />);
    fireEvent.click(await screen.findByRole("button", { name: "Agendar evento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo confirmar el cliente autorizado");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
it.each([{ effectivePermissions: [] }, { effectivePermissions: [...permissions, { code: "formalizacion.calendar.read", effect: "deny" }] }])("does not query or expose calendar actions without effective read permission", ({ effectivePermissions }) => {
    render(<FormalizationScheduleEvent item={item} effectivePermissions={effectivePermissions} />);
    expect(getCalendars).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Agendar evento" })).not.toBeInTheDocument();
});
it.each([{ effectivePermissions: [{ code: "formalizacion.calendar.read", effect: "allow" }] }, { effectivePermissions: [...permissions, { code: "formalizacion.calendar.assign_lead", effect: "deny" }] }, { effectivePermissions: [{ code: "formalizacion.calendar.assign_lead", effect: "allow" }] }])("does not expose scheduling without both assignment and read permissions", async ({ effectivePermissions }) => {
    render(<FormalizationScheduleEvent item={item} effectivePermissions={effectivePermissions} />);
    // Espera la consulta del descriptor si una implementación omite el nuevo permiso.
    await waitFor(() => {
        expect(screen.queryByRole("button", { name: "Agendar evento" })).not.toBeInTheDocument();
    });
    expect(getCalendars).not.toHaveBeenCalled();
    expect(getCalendarLookup).not.toHaveBeenCalled();
});
it("does not offer creation when the server denies it", async () => {
    vi.mocked(getCalendars).mockResolvedValue([{ ...calendar, canCreate: false }]);
    render(<FormalizationScheduleEvent item={item} effectivePermissions={permissions} />);
    await waitFor(() => {
        expect(getCalendars).toHaveBeenCalledOnce();
    });
    expect(screen.queryByRole("button", { name: "Agendar evento" })).not.toBeInTheDocument();
});
it("does not guess another order or client if the authorized lookup cannot confirm the exact identity", async () => {
    vi.mocked(getCalendarLookup).mockResolvedValue([{ id: "99", source: "legacy", label: "LV208", lead: { id: "bad", source: "legacy", label: "Otro cliente" } }]);
    render(<FormalizationScheduleEvent item={item} effectivePermissions={permissions} />);
    fireEvent.click(await screen.findByRole("button", { name: "Agendar evento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo confirmar el cliente autorizado");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
