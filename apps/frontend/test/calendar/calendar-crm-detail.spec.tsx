import "@testing-library/jest-dom/vitest";

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { CalendarCrmDetails } from "../../src/modules/calendar/CalendarCrmDetails";
import { apiRequest } from "../../src/services/api/api-client";
import type { CalendarCrmDetail, CalendarEvent } from "../../src/services/calendar/calendar-service";
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
afterEach(() => {
    cleanup();
    vi.mocked(apiRequest).mockReset();
});
const crm: CalendarCrmDetail = {
    loaded: true,
    version: 2,
    moduleCode: "formalizacion",
    typeLabel: "Reunión",
    typeColor: "#15803d",
    colorOverride: null,
    title: "Nombre original CRM",
    description: "Descripción registrada CRM",
    location: "Sala CRM",
    start: "2026-11-04T15:00:00Z",
    end: "2026-11-04T16:00:00Z",
    allDay: false,
    status: "scheduled",
    reference: "Orden 208",
    teamsRequested: true,
    roomAddress: "sala@example.test",
    organizerName: "Organizador CRM",
    timezone: "America/Costa_Rica",
    cancellationReason: null,
    createdAt: "2026-11-03T15:00:00Z",
    updatedAt: "2026-11-03T16:00:00Z",
    invitationVersion: 2,
    links: [
        { entityType: "lead", source: "native", id: "lead", label: "Cliente vinculado" },
        { entityType: "sales_order", source: "legacy", id: "42", label: "AVI223" },
    ],
    participants: [{ label: "Ana", email: "ana@example.test" }],
    restrictedLinks: true,
};
it("shows the CRM type color and authorized relations without replacing them with Outlook fields", () => {
    render(<CalendarCrmDetails event={{ title: "Título Outlook", description: "Descripción Outlook", version: 2, crmDetail: crm } as CalendarEvent} />);
    expect(screen.getByText("Reunión").querySelector("span")).toHaveStyle({ backgroundColor: "#15803d" });
    expect(screen.getByText("Nombre original CRM")).toBeVisible();
    expect(screen.getByText("Descripción registrada CRM")).toBeVisible();
    expect(screen.getByText(/AVI223/)).toBeVisible();
    expect(screen.getByText(/Cliente vinculado/)).toBeVisible();
    expect(screen.getByText("Hay vínculos restringidos por tus permisos.")).toBeVisible();
});
it("does not invent a CRM association for an Outlook-only event", () => {
    render(<CalendarCrmDetails event={{ source: "outlook" } as CalendarEvent} />);
    expect(screen.getByText("Sin registro CRM vinculado.")).toBeVisible();
    expect(screen.queryByText("Registros vinculados")).not.toBeInTheDocument();
});

it("loads authorized CRM relations only when the detail opens and shows a preload", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ schemaVersion: 1, crmDetail: crm });
    render(<CalendarCrmDetails event={{ id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", source: "native", version: 2, crmDetail: { ...crm, loaded: false } } as CalendarEvent} />);
    expect(screen.getByRole("status", { name: "Cargando datos CRM" })).toBeInTheDocument();
    expect(await screen.findByText(/AVI223/)).toBeVisible();
    expect(apiRequest).toHaveBeenCalledWith("/calendar/events/01ARZ3NDEKTSV4RRFFQ69G5FAV/detail");
});
it("never replaces the current event detail with a delayed response from another event", async () => {
    let first!: (value: unknown) => void;
    let second!: (value: unknown) => void;
    vi.mocked(apiRequest).mockImplementation(
        (path) =>
            new Promise((resolve) => {
                if (path.includes("5FAV")) first = resolve;
                else second = resolve;
            }),
    );
    const oldEvent = { id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", source: "native", version: 2, crmDetail: { ...crm, loaded: false } } as CalendarEvent;
    const view = render(<CalendarCrmDetails event={oldEvent} />);
    view.rerender(<CalendarCrmDetails event={{ ...oldEvent, id: "01ARZ3NDEKTSV4RRFFQ69G5FAW" }} />);
    await act(async () => {
        second({ schemaVersion: 1, crmDetail: { ...crm, title: "Evento actual" } });
        await Promise.resolve();
    });
    await act(async () => {
        first({ schemaVersion: 1, crmDetail: { ...crm, title: "Evento anterior" } });
        await Promise.resolve();
    });
    expect(screen.getByText("Evento actual")).toBeVisible();
    expect(screen.queryByText("Evento anterior")).not.toBeInTheDocument();
});

it("opens only server-authorized lead and sales-order links and acknowledges viewing", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ ok: true });
    render(<CalendarCrmDetails event={{ id: "01ARZ3NDEKTSV4RRFFQ69G5FAV", source: "native", originModule: "formalizacion", typeId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", typeCode: "reunion", title: "Mi evento", description: null, location: null, start: crm.start, end: crm.end, allDay: false, status: "scheduled", version: 2, canEdit: false, formKey: "formalizacion.general.v1", details: {}, crmDetail: { ...crm, links: crm.links.map((link) => ({ ...link, canOpen: true })) } }} />);
    expect(screen.getByRole("link", { name: /Ver Lead/ })).toHaveAttribute("href", "/home/formalization/perfil?source=native&id=lead");
    expect(screen.getByRole("link", { name: /Ver Orden/ })).toHaveAttribute("href", "/home/formalization?orderSource=legacy&orderId=42");
    await act(async () => {
        await Promise.resolve();
    });
    expect(apiRequest).toHaveBeenCalledWith("/calendar/notifications/events/01ARZ3NDEKTSV4RRFFQ69G5FAV/read", expect.objectContaining({ method: "PUT" }));
});
it("does not offer navigation when record-opening permission is absent", () => {
    render(<CalendarCrmDetails event={{ crmDetail: crm } as CalendarEvent} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
