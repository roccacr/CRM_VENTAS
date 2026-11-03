import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { filledFields, formatAmount, formatStamp, historyKind, infoBlocks, initials, labelTone, latestOrder, matchesHistory, profileOrders } from "../../src/modules/leads/lead-profile-model";
import { LeadProfilePage } from "../../src/modules/leads/LeadProfilePage";
import { apiRequest } from "../../src/services/api/api-client";
import type { LeadProfileResult } from "../../src/services/leads/lead-profile-service";
import { installBrowserApiDoubles } from "../support/browser";

vi.mock("../../src/services/api/api-client", () => ({
    apiRequest: vi.fn(),
    ApiClientError: class extends Error {
        constructor(
            message: string,
            readonly status: number,
        ) {
            super(message);
        }
    },
}));
beforeEach(installBrowserApiDoubles);
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

const field = (code: string, label: string, value: string | null) => ({ code, label, value, source: value ? ("legacy" as const) : null, legacyValue: null });
const entry = (id: string, action: string, detail: string) => ({ id, source: "legacy", action, detail, reason: null, actorName: "Marlon Masis", actorCoverage: "known", occurredAt: null, sourceDate: "2024-02-16 10:06:49", recordedAt: null, evidence: "legacy", fromStatus: null, toStatus: null });
const profile: LeadProfileResult = {
    schemaVersion: 1,
    observedAt: "2026-11-02T12:00:00Z",
    id: "20519",
    source: "legacy",
    sources: ["legacy"],
    sections: [
        { title: "Datos generales", fields: [field("fullName", "Nombre completo", "Ivonne Miranda Lewis"), field("status", "Estado operativo", "Inactivo"), field("company", "Empresa", "--"), field("project", "Proyecto", "LV Flats21")] },
        { title: "Contacto", fields: [field("email", "Correo", "ivonne@example.com"), field("alternatePhone", "Teléfono alternativo", "Sin dato")] },
        { title: "Captación y seguimiento", fields: [field("campaign", "Campaña", "22 Facebook Orgánico")] },
        { title: "Perfil y calificación", fields: [field("profession", "Profesión", "Gerente Administrativa")] },
    ],
    history: { items: [entry("1", "Se envio la RESERVA", "Se envio la RESERVA"), entry("2", "Estimacion", "Se creo una estimacion a este Lead"), entry("3", "oportunidad", "Oportunidad #LV214 inactivada")], hasMore: false, nextCursor: null },
    events: {
        native: { items: [{ id: "ev-1", source: "native", title: "Visita al proyecto", type: "Cita", status: "Programado", date: "2026-11-05", startTime: "09:00", endTime: "10:00" }], hasMore: false, page: 1 },
        legacy: { items: [{ id: "9", source: "legacy", title: "Llamada de seguimiento", type: "Seguimiento", status: "Pendiente", date: "2024-02-20", startTime: "10:00", endTime: null }], hasMore: false, page: 1 },
    },
    opportunities: {
        items: [
            {
                id: "120",
                source: "legacy",
                fields: [
                    { code: "tranid_oport", label: "Número", value: "LV214" },
                    { code: "memo_oport", label: "Observación", value: "Registro real de oportunidad" },
                    { code: "chek_oport", label: "Indicador de control", value: "1" },
                    { code: "Motico_Condicion", label: "Motivo de condición", value: "LEAD_RESERVA" },
                ],
            },
        ],
        total: 1,
        page: 1,
        hasMore: false,
        available: true,
    },
    estimates: {
        items: [
            {
                id: "150",
                source: "legacy",
                fields: [
                    { code: "tranid_est", label: "Número", value: "EST-150" },
                    { code: "montoTotal_est", label: "Monto total", value: "575000.00" },
                ],
            },
        ],
        total: 1,
        page: 1,
        hasMore: false,
        available: true,
    },
    orders: { native: { items: [], hasMore: false, page: 1 }, legacy: { items: [{ id: "78", source: "legacy", number: "LV208", status: "1", date: "2024-02-20", currency: null, amount: "575000.00" }], hasMore: false, page: 1 } },
};
const permissions = [
    { code: "formalizacion.orders.whatsapp", effect: "allow", scope: "self", source: "role" },
    { code: "lead.profile.read", effect: "allow", scope: "self", source: "role" },
] as const;
const open = async () => {
    window.history.replaceState(null, "", "/perfil?source=legacy&id=20519");
    vi.mocked(apiRequest).mockResolvedValue(profile);
    render(<LeadProfilePage effectivePermissions={permissions} />);
    await screen.findByRole("heading", { name: "Ivonne Miranda Lewis" });
};

describe("client profile model", () => {
    it("regroups the API sections into the consolidated view and never drops an unknown field", () => {
        const blocks = infoBlocks([...profile.sections, { title: "Nueva", fields: [field("brandNew", "Campo nuevo", "x")] }]);
        expect(blocks.map((block) => block.title)).toEqual(["Información base del lead", "Información complementaria", "Estado y seguimiento del registro"]);
        expect(blocks[0]?.fields.map((item) => item.label)).toEqual(["Nombre completo", "Proyecto", "Campaña", "Correo"]);
        expect(blocks[2]?.fields.map((item) => item.code)).toContain("brandNew");
    });
    it("treats the legacy placeholders as empty", () => {
        expect(filledFields([field("a", "A", "--"), field("b", "B", "Sin dato"), field("c", "C", "x"), field("d", "D", null)]).map((item) => item.code)).toEqual(["c"]);
    });
    it("formats legacy stamps without moving their hour, and amounts with thousands", () => {
        expect(formatStamp("2024-02-16 09:52:59")).toBe("16 feb 2024 · 09:52");
        expect(formatStamp("2024-02-21")).toBe("21 feb 2024");
        expect(formatStamp("no es fecha")).toBe("no es fecha");
        expect(formatAmount("575000.00")).toMatch(/575\D?000[.,]00/u);
    });
    it("groups history by its wording and searches ignoring accents", () => {
        const kinds = ["Se creo una oportuindad", "Oportunidad", "Estimacion", "Se envio la PRE-RESERVA", "lead", "Otra cosa"].map((action) => historyKind(entry("x", action, "")));
        expect(kinds).toEqual(["opportunity", "opportunity", "estimate", "reservation", "lead", "other"]);
        expect(matchesHistory(entry("x", "Estimación", "Se creó"), "estimacion")).toBe(true);
    });
    it("builds initials and merges the order sources", () => {
        expect(initials("Ivonne Miranda Lewis")).toBe("IM");
        expect(profileOrders(profile.orders, "all")).toHaveLength(1);
        expect(profileOrders(profile.orders, "native")).toHaveLength(0);
    });
});

describe("client profile sections", () => {
    it("opens on the follow-up log with every section of the client file as a tab", async () => {
        await open();
        const names = screen.getAllByRole("tab").map((tab) => tab.textContent);
        expect(names.join("|")).toMatch(/Bitácora de seguimiento.*Lista de eventos.*Oportunidades.*Estimaciones.*Información completa.*Órdenes de venta.*OneDrive/u);
        expect(screen.getByRole("tab", { name: /Bitácora de seguimiento/, selected: true })).toBeInTheDocument();
        expect(screen.getByText("Se creo una estimacion a este Lead")).toBeInTheDocument();
    });
    it("shows the consolidated view with its three blocks and every field, folding the empty ones on request", async () => {
        await open();
        fireEvent.click(screen.getByRole("tab", { name: "Información completa" }));
        expect(screen.getByRole("heading", { name: "Información completa del lead" })).toBeInTheDocument();
        const base = screen.getByRole("region", { name: "Información base del lead" });
        expect(within(base).getByText("ivonne@example.com")).toBeInTheDocument();
        const context = screen.getByRole("region", { name: "Información complementaria" });
        expect(within(context).getByText("Teléfono alternativo")).toBeInTheDocument();
        fireEvent.click(within(context).getByRole("button", { name: "Ocultar campos sin dato" }));
        expect(within(context).queryByText("Teléfono alternativo")).not.toBeInTheDocument();
        expect(within(context).getByText("Gerente Administrativa")).toBeInTheDocument();
    });
    it("lists actual opportunities and estimates instead of log entries", async () => {
        await open();
        fireEvent.click(screen.getByRole("tab", { name: /Estimaciones/ }));
        expect(screen.getByRole("heading", { name: "EST-150" })).toBeInTheDocument();
        expect(screen.getByText("575 000,00")).toBeInTheDocument();
        expect(screen.queryByText("Se creo una estimacion a este Lead")).not.toBeInTheDocument();
        expect(screen.queryByText("Oportunidad #LV214 inactivada")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("tab", { name: /Oportunidades/ }));
        expect(screen.getByRole("heading", { name: "LV214" })).toBeInTheDocument();
        expect(screen.queryByText("Registro real de oportunidad")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /Ver todos los datos/ }));
        expect(screen.getByText("Registro real de oportunidad")).toBeInTheDocument();
        expect(screen.queryByText("Oportunidad #LV214 inactivada")).not.toBeInTheDocument();
        expect(apiRequest).toHaveBeenCalledTimes(1);
    });
    it("cuenta oportunidades reales aunque la bitácora contenga varias anotaciones", async () => {
        window.history.replaceState(null, "", "/perfil?source=legacy&id=20519");
        vi.mocked(apiRequest).mockResolvedValue({ ...profile, history: { ...profile.history, items: [entry("a", "Oportunidad", "Creada"), entry("b", "Oportunidad", "Actualizada"), entry("c", "Oportunidad", "Inactivada")] } });
        render(<LeadProfilePage effectivePermissions={permissions} />);
        await screen.findByRole("heading", { name: "Ivonne Miranda Lewis" });
        const stats = screen.getByRole("list", { name: "Resumen del expediente" });
        expect(within(stats).getByRole("button", { name: /Oportunidades/ })).toHaveTextContent("1");
        expect(within(stats).getByRole("button", { name: /Registros en bitácora/ })).toHaveTextContent("3");
    });
    it("keeps events and OneDrive as prepared sections without inventing rows", async () => {
        window.history.replaceState(null, "", "/perfil?source=legacy&id=20519");
        // An API that does not send events yet keeps the section prepared instead of showing an empty table as if nothing existed.
        vi.mocked(apiRequest).mockResolvedValue({ ...profile, events: undefined });
        render(<LeadProfilePage effectivePermissions={permissions} />);
        await screen.findByRole("heading", { name: "Ivonne Miranda Lewis" });
        fireEvent.click(screen.getByRole("tab", { name: "Lista de eventos" }));
        expect(within(screen.getByRole("tabpanel")).getByText("En preparación")).toBeInTheDocument();
        expect(screen.getByText("Sin registros para mostrar todavía.")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("tab", { name: "OneDrive" }));
        expect(screen.getByRole("columnheader", { name: "Modificado" })).toBeInTheDocument();
    });
    it("moves between sections with the keyboard and keeps the choice in the address", async () => {
        await open();
        fireEvent.keyDown(screen.getByRole("tab", { name: /Bitácora de seguimiento/ }), { key: "ArrowRight" });
        expect(screen.getByRole("tab", { name: "Lista de eventos", selected: true })).toBeInTheDocument();
        expect(window.location.search).toContain("tab=events");
    });
    it("filters the log by kind without another request", async () => {
        await open();
        const group = screen.getByRole("group", { name: "Tipo de registro" });
        fireEvent.click(within(group).getByRole("button", { name: /Reservas/ }));
        expect(screen.getByRole("heading", { name: "Se envio la RESERVA" })).toBeInTheDocument();
        expect(screen.queryByText("Oportunidad #LV214 inactivada")).not.toBeInTheDocument();
        expect(apiRequest).toHaveBeenCalledTimes(1);
    });
    it("keeps contact, commercial data and the figures of the file at hand in every section", async () => {
        await open();
        const side = screen.getByRole("complementary", { name: "Datos del cliente" });
        expect(within(side).getByText("ivonne@example.com")).toBeInTheDocument();
        expect(within(side).getByText("LV Flats21")).toBeInTheDocument();
        const figures = screen.getByRole("list", { name: "Resumen del expediente" });
        expect(within(figures).getByRole("button", { name: /Estimaciones/ })).toHaveTextContent("1");
        fireEvent.click(within(figures).getByRole("button", { name: /Órdenes vinculadas/ }));
        expect(screen.getByRole("tab", { name: /Órdenes de venta/, selected: true })).toBeInTheDocument();
    });
    it("offers WhatsApp from the profile only with the permission and a valid phone, and never repeats the profile link", async () => {
        window.history.replaceState(null, "", "/perfil?source=legacy&id=20519");
        vi.mocked(apiRequest).mockResolvedValue({ ...profile, sections: profile.sections.map((section) => ({ ...section, fields: [...section.fields, ...(section.title === "Contacto" ? [field("phone", "Teléfono", "84398049")] : [])] })) });
        render(<LeadProfilePage effectivePermissions={permissions} />);
        await screen.findByRole("heading", { name: "Ivonne Miranda Lewis" });
        expect(screen.getByRole("link", { name: /Ir a WhatsApp/ })).toHaveAttribute("href", "https://web.whatsapp.com/send?phone=50684398049");
        expect(screen.queryByText("Ver perfil del cliente")).not.toBeInTheDocument();
    });
    it("tints labels by meaning", () => {
        expect(["07-LEAD-PERDIDO", "Inactivo", "05-LEAD-CONTRATO", "Reserva Ov", "Otra cosa"].map(labelTone)).toEqual(["danger", "warn", "ok", "info", "neutral"]);
    });
    it("schedules on the newest linked order", () => {
        expect(latestOrder(profile.orders)?.number).toBe("LV208");
        expect(latestOrder({ native: { items: [], hasMore: false, page: 1 }, legacy: { items: [], hasMore: false, page: 1 } })).toBeNull();
    });
    it("lists the orders in one table with a source filter", async () => {
        await open();
        fireEvent.click(screen.getByRole("tab", { name: /Órdenes de venta/ }));
        expect(within(screen.getByRole("table")).getByRole("rowheader", { name: "LV208" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Ver orden LV208" })).toHaveAttribute("href", "/home/formalization/orders?orderSource=legacy&orderId=78");
        expect(screen.getByText("Código 1")).toBeInTheDocument();
        expect(screen.queryByRole("columnheader", { name: "Moneda" })).not.toBeInTheDocument();
        fireEvent.click(within(screen.getByRole("group", { name: "Origen de las órdenes" })).getByRole("button", { name: /Nativas/ }));
        expect(screen.getByText("Sin órdenes en esta página.")).toBeInTheDocument();
    });
    it("lists the events of both databases in one table, newest first, with a source filter", async () => {
        await open();
        fireEvent.click(screen.getByRole("tab", { name: "Lista de eventos" }));
        const table = screen.getByRole("table");
        const titles = within(table)
            .getAllByRole("rowheader")
            .map((row) => row.textContent);
        expect(titles).toEqual(["Visita al proyecto", "Llamada de seguimiento"]);
        expect(within(table).getByText("09:00 – 10:00")).toBeInTheDocument();
        fireEvent.click(within(screen.getByRole("group", { name: "Origen de los eventos" })).getByRole("button", { name: /Anteriores/ }));
        expect(within(screen.getByRole("table")).getAllByRole("rowheader")).toHaveLength(1);
        expect(within(screen.getByRole("list", { name: "Resumen del expediente" })).getByRole("button", { name: /Eventos/ })).toHaveTextContent("2");
    });
    it("shows an opportunity as more or less likely the way the previous system does, with its condition reason", async () => {
        await open();
        fireEvent.click(screen.getByRole("tab", { name: /Oportunidades/ }));
        expect(screen.getByText("Más probable")).toHaveAttribute("data-tone", "ok");
        expect(screen.getByText("LEAD_RESERVA")).toBeInTheDocument();
    });
    it("explains a client that only exists in the new system has no opportunities yet, without borrowing them from the log", async () => {
        window.history.replaceState(null, "", "/perfil?source=legacy&id=20519");
        vi.mocked(apiRequest).mockResolvedValue({ ...profile, opportunities: { items: [], total: 0, page: 1, hasMore: false, available: false } });
        render(<LeadProfilePage effectivePermissions={permissions} />);
        await screen.findByRole("heading", { name: "Ivonne Miranda Lewis" });
        fireEvent.click(screen.getByRole("tab", { name: /Oportunidades/ }));
        expect(screen.getByText(/Todavía no hay oportunidades en el sistema nuevo/)).toBeInTheDocument();
        expect(screen.queryByText("Oportunidad #LV214 inactivada")).not.toBeInTheDocument();
    });
});
