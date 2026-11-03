import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createPortal } from "react-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { FormalizationOrderDrawer } from "../../src/modules/home/FormalizationOrderDrawer";
import { getCalendarLookup, getCalendars } from "../../src/services/calendar/calendar-service";
import type { FollowUpItem } from "../../src/services/formalization/follow-up-service";
import { getOrderClientDetail, type OrderClientDetail } from "../../src/services/formalization/order-client-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/formalization/order-client-service", () => ({ getOrderClientDetail: vi.fn() }));
vi.mock("../../src/services/calendar/calendar-service", () => ({ getCalendars: vi.fn(), getCalendarLookup: vi.fn() }));
vi.mock("../../src/modules/calendar/CalendarEventDrawer", () => ({ CalendarEventDrawer: () => createPortal(<button>Formulario del evento</button>, document.body) }));
const permissions = [
    { code: "lead.profile.read", effect: "allow" },
    { code: "formalizacion.calendar.read", effect: "allow" },
    { code: "formalizacion.calendar.assign_lead", effect: "allow" },
];
const item: FollowUpItem = { id: "legacy:78", source: "legacy", number: "LV208", nativeCode: null, client: "Cliente de resumen", clientEmail: "contrato@example.com", project: null, unit: null, responsible: null, state: { code: "contract_pending_send", label: "Por enviar", since: null, days: null }, nextStep: "Registrar envío", completedThisYear: false };
const detail: OrderClientDetail = {
    name: "Cliente canónico",
    leadIdentity: { source: "legacy", id: "99" },
    warnings: [],
    groups: [
        {
            title: "Contacto",
            fields: [
                { label: "Nombre completo", value: "Cliente canónico" },
                { label: "Correo", value: "cliente@example.com" },
                { label: "Teléfono", value: "88887777" },
            ],
        },
        { title: "Información comercial", fields: [{ label: "Proyecto", value: "No mostrar en resumen" }] },
    ],
};
const props = { item, position: 1, total: 2, onClose: vi.fn(), onSelectPrevious: vi.fn(), onSelectNext: vi.fn(), stagePermissions: permissions };
beforeEach(() => {
    installBrowserApiDoubles();
    vi.mocked(getOrderClientDetail).mockResolvedValue(detail);
    vi.mocked(getCalendars).mockResolvedValue([{ moduleCode: "formalizacion", label: "Formalización", color: "#000", canCreate: true, canUpdate: true, types: [{ id: "reunion", code: "reunion", label: "Reunión", color: "#000", formKey: "formalizacion.general.v1" }] }]);
    vi.mocked(getCalendarLookup).mockResolvedValue([{ source: "legacy", id: "78", label: "LV208", lead: { source: "legacy", id: "99", label: "Cliente canónico" } }]);
});
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

it.each(["native", "legacy"] as const)("shows only basic contact and both authorized actions for a %s order", async (source) => {
    const onNavigate = vi.fn();
    const id = source === "legacy" ? "legacy:78" : "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    vi.mocked(getOrderClientDetail).mockResolvedValue({ ...detail, leadIdentity: { source, id: "canonical-client" } });
    render(<FormalizationOrderDrawer {...props} item={{ ...item, source, id }} onNavigate={onNavigate} />);
    await screen.findByText("cliente@example.com");
    expect(screen.getByText("Nombre completo")).toBeInTheDocument();
    expect(screen.getByText("88887777")).toBeInTheDocument();
    expect(screen.queryByText("Información comercial")).not.toBeInTheDocument();
    expect(screen.queryByText("No mostrar en resumen")).not.toBeInTheDocument();
    const profile = screen.getByRole("link", { name: "Ver perfil del cliente" });
    expect(profile).toHaveAttribute("href", `/home/formalization/perfil?source=${source}&id=canonical-client`);
    fireEvent.click(profile);
    expect(onNavigate).toHaveBeenCalledWith(`/home/formalization/perfil?source=${source}&id=canonical-client`);
    expect(await screen.findByRole("button", { name: "Agendar evento" })).toBeInTheDocument();
    expect(getOrderClientDetail).toHaveBeenCalledExactlyOnceWith({ source, id });
    expect(screen.getByRole("link", { name: "Abrir Outlook" })).toHaveAttribute("href", expect.stringContaining("contrato%40example.com"));
    expect(screen.getByText("Seguimiento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver orden completa" })).toBeInTheDocument();
});
it("keeps contact visible but suppresses actions on explicit effective denies", async () => {
    render(<FormalizationOrderDrawer {...props} stagePermissions={[...permissions, { code: "lead.profile.read", effect: "deny" }, { code: "formalizacion.calendar.assign_lead", effect: "deny" }]} />);
    await screen.findByText("cliente@example.com");
    expect(screen.queryByRole("link", { name: "Ver perfil del cliente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agendar evento" })).not.toBeInTheDocument();
    expect(getCalendars).not.toHaveBeenCalled();
});
it("discards a late client response when arrows select another order", async () => {
    let resolve: (value: OrderClientDetail) => void = () => {};
    vi.mocked(getOrderClientDetail).mockReturnValueOnce(
        new Promise((done) => {
            resolve = done;
        }),
    );
    const view = render(<FormalizationOrderDrawer {...props} />);
    vi.mocked(getOrderClientDetail).mockResolvedValueOnce({ ...detail, groups: [{ title: "Contacto", fields: [{ label: "Correo", value: "otra@example.com" }] }] });
    view.rerender(<FormalizationOrderDrawer {...props} item={{ ...item, id: "legacy:79", number: "LV209" }} />);
    await screen.findByText("otra@example.com");
    await act(async () => {
        resolve(detail);
        await Promise.resolve();
    });
    expect(screen.queryByText("cliente@example.com")).not.toBeInTheDocument();
    expect(getOrderClientDetail).toHaveBeenLastCalledWith({ source: "legacy", id: "legacy:79" });
});
it("does not invent contact or actions when the canonical relation is ambiguous", async () => {
    vi.mocked(getOrderClientDetail).mockResolvedValue({ ...detail, warnings: ["lead:ambiguous"] });
    render(<FormalizationOrderDrawer {...props} />);
    await screen.findByText(/relación con el cliente no está disponible o es ambigua/);
    expect(screen.queryByText("cliente@example.com")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver perfil del cliente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Agendar evento" })).not.toBeInTheDocument();
});
it("keeps order arrows working but ignores arrow events from the nested calendar portal", async () => {
    render(<FormalizationOrderDrawer {...props} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Ver orden completa" }), { key: "ArrowDown" });
    expect(props.onSelectNext).toHaveBeenCalledTimes(1);
    fireEvent.click(await screen.findByRole("button", { name: "Agendar evento" }));
    const event = await screen.findByRole("button", { name: "Formulario del evento" });
    fireEvent.keyDown(event, { key: "ArrowDown" });
    expect(props.onSelectNext).toHaveBeenCalledTimes(1);
});
