import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { emptyMarketingFilters, parseISODate, resolveMarketingView, toISODate } from "../../src/modules/home/marketing-home-preview.model";
import { MarketingHomePage } from "../../src/modules/home/MarketingHomePage";
import { MarketingWelcomeArt } from "../../src/modules/home/MarketingWelcomeArt";
import type { IdentityUser } from "../../src/services/auth/identity-contracts";
import { getMarketingHomeSummary, type MarketingApiSummary, parseMarketingHomeSummary } from "../../src/services/marketing/home-summary-service";
import { selectedMarketingValues, selectMarketing } from "./marketing-select.helpers";
vi.mock("../../src/services/marketing/home-summary-service", async (original) => ({ ...(await original<object>()), getMarketingHomeSummary: vi.fn() }));
const request = vi.mocked(getMarketingHomeSummary);
const user = { publicId: "me", displayName: "Usuario", email: "session@example.test" } as IdentityUser;
const photoId = "01M5NC1CME889R260NYS7ASM7C";
function fixture(): MarketingApiSummary {
    return {
        schemaVersion: 1,
        observedAt: "2026-10-23T18:00:00Z",
        today: "2026-10-23",
        period: "month",
        timeZone: "America/Costa_Rica",
        selected: { start: "2026-10-01", end: "2026-10-23" },
        comparison: { start: "2026-09-01", end: "2026-09-23" },
        coverage: { start: "2026-01-01", end: "2026-10-23" },
        rows: [
            { date: "2026-10-23", sellerId: photoId, projectId: "p", leads: 3 },
            { date: "2026-10-22", sellerId: "other", projectId: "p", leads: 2 },
            { date: "2026-09-23", sellerId: photoId, projectId: "p", leads: 1 },
        ],
        sellers: [
            { id: photoId, publicId: photoId, name: "Vendedor Uno" },
            { id: "other", publicId: null, name: "Vendedor Dos" },
        ],
        projects: [{ id: "p", publicId: "p", name: "Proyecto Real" }],
        counts: { leads: 5, previousLeads: 1 },
        appointments: { available: false },
        sources: { native: 2, legacy: 3, legacyEnabled: true, duplicatesExcluded: 0, ambiguousOverlaps: 0 },
    };
}
afterEach(() => {
    cleanup();
    vi.resetAllMocks();
});
describe("connected marketing summary", () => {
    it("validates aggregate counts and rejects partial or inconsistent evidence", () => {
        expect(parseMarketingHomeSummary(fixture(), "month").counts.leads).toBe(5);
        expect(() => parseMarketingHomeSummary({ ...fixture(), counts: { leads: 4, previousLeads: 1 } }, "month")).toThrow();
        expect(() => parseMarketingHomeSummary(fixture(), "day")).toThrow();
    });
    it("shows real leads by project and leaves unavailable appointment counters pending", async () => {
        request.mockResolvedValue(fixture());
        render(<MarketingHomePage currentUser={user} />);
        expect(await screen.findByLabelText("Leads: 5")).toBeInTheDocument();
        for (const title of ["Leads con cita", "Citas completadas", "Leads sin cita · 7 días"]) expect(screen.getByLabelText(`${title}: —`)).toBeInTheDocument();
        await selectMarketing("Proyecto", "Proyecto Real");
        expect(screen.getByLabelText("Leads: 5")).toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "Vendedor" })).not.toBeInTheDocument();
    });
    it("hides old counters while changing period and ignores a superseded response", async () => {
        let resolveOld: (value: MarketingApiSummary) => void = () => undefined;
        request
            .mockImplementationOnce(
                () =>
                    new Promise((resolve) => {
                        resolveOld = resolve;
                    }),
            )
            .mockResolvedValueOnce({ ...fixture(), period: "day" });
        render(<MarketingHomePage currentUser={user} />);
        fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
        expect(await screen.findByLabelText("Leads: 3")).toBeInTheDocument();
        resolveOld({ ...fixture(), rows: [] });
        await waitFor(() => {
            expect(screen.getByLabelText("Leads: 3")).toBeInTheDocument();
        });
        expect(request).toHaveBeenCalledWith("day");
    });
    it("reports a failed source and retries without displaying invented zeros", async () => {
        request.mockRejectedValueOnce(new Error("Unavailable")).mockResolvedValueOnce(fixture());
        render(<MarketingHomePage currentUser={user} />);
        fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
        expect(await screen.findByLabelText("Leads: 5")).toBeInTheDocument();
    });
    it("preserves the illustration when no local photo matches or the image fails", () => {
        const view = render(<MarketingWelcomeArt publicId={photoId} name="Vendedor" />);
        fireEvent.error(screen.getByRole("img", { name: "Foto de Vendedor" }));
        expect(view.container.querySelector("img")).toHaveAttribute("src", expect.stringContaining("rocca-marketing-generated.png"));
        view.rerender(<MarketingWelcomeArt publicId="unknown" name="Otro" />);
        expect(view.container.querySelector("img")).toHaveAttribute("src", expect.stringContaining("rocca-marketing-generated.png"));
    });
});

it.each([
    ["month", "2026-04-30", "2026-03-01", "2026-03-31"],
    ["year", "2024-03-01", "2023-01-01", "2023-03-01"],
    ["year", "2024-02-29", "2023-01-01", "2023-02-28"],
] as const)("matches API calendar comparison for %s on %s", (period, todayString, start, end) => {
    const today = parseISODate(todayString) as Date;
    const base = emptyMarketingFilters(today);
    const view = resolveMarketingView({ ...base, selection: { ...base.selection, mode: period } }, today, []);
    expect({ start: toISODate(view.comparison.start), end: toISODate(view.comparison.end) }).toEqual({ start, end });
});

it("preserves project totals when the sellers change in a new period", async () => {
    request.mockResolvedValueOnce(fixture()).mockResolvedValueOnce({ ...fixture(), period: "day", rows: [{ date: "2026-10-23", sellerId: "other", projectId: "p", leads: 7 }] });
    render(<MarketingHomePage currentUser={user} />);
    await screen.findByLabelText("Leads: 5");
    await selectMarketing("Proyecto", "Proyecto Real");
    expect(screen.getByLabelText("Leads: 5")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
    expect(await screen.findByLabelText("Leads: 7")).toBeInTheDocument();
    expect(selectedMarketingValues("Proyecto")).toEqual(["Proyecto Real"]);
});

it("resets scope when the signed-in user changes", async () => {
    request.mockResolvedValue(fixture());
    const view = render(<MarketingHomePage currentUser={user} />);
    await screen.findByLabelText("Leads: 5");
    await selectMarketing("Proyecto", "Proyecto Real");
    view.rerender(<MarketingHomePage currentUser={{ ...user, publicId: "second-user" }} />);
    expect(await screen.findByLabelText("Leads: 5")).toBeInTheDocument();
    expect(selectedMarketingValues("Proyecto")).toEqual([]);
});

it("explains a project increase with its comparison dates and previous count", async () => {
    request.mockResolvedValue(fixture());
    render(<MarketingHomePage currentUser={user} />);
    await screen.findByLabelText("Leads: 5");
    const card = screen.getByRole("heading", { name: "Proyecto Real" }).closest("article") as HTMLElement;
    expect(within(card).getByText(/400 % m\u00e1s que el mes pasado/)).toBeInTheDocument();
    expect(within(card).getByText("Antes: 1")).toBeInTheDocument();
});
it("explains a 100 percent drop without relying only on color", async () => {
    request.mockResolvedValue({ ...fixture(), rows: [{ date: "2026-09-23", sellerId: photoId, projectId: "p", leads: 4 }] });
    render(<MarketingHomePage currentUser={user} />);
    await screen.findByLabelText("Leads: 0");
    const card = screen.getByRole("heading", { name: "Proyecto Real" }).closest("article") as HTMLElement;
    expect(within(card).getByText(/100 % menos que el mes pasado/)).toBeInTheDocument();
    expect(within(card).getByText("Antes: 4")).toBeInTheDocument();
});

it("names the previous year and its dates when switching to annual comparison", async () => {
    request.mockResolvedValueOnce(fixture()).mockResolvedValueOnce({
        ...fixture(),
        period: "year",
        rows: [
            { date: "2026-10-23", sellerId: photoId, projectId: "p", leads: 106 },
            { date: "2025-10-23", sellerId: photoId, projectId: "p", leads: 100 },
        ],
    });
    render(<MarketingHomePage currentUser={user} />);
    await screen.findByLabelText("Leads: 5");
    fireEvent.click(screen.getByRole("button", { name: "A\u00f1o" }));
    await screen.findByLabelText("Leads: 106");
    const card = screen.getByRole("heading", { name: "Proyecto Real" }).closest("article") as HTMLElement;
    expect(within(card).getByText(/6 % m\u00e1s que el a\u00f1o pasado/)).toBeInTheDocument();
    expect(within(card).getByText("Antes: 100")).toBeInTheDocument();
});
it("does not imply a growth percentage when the previous period had zero leads", async () => {
    request.mockResolvedValue({ ...fixture(), rows: fixture().rows.filter((row) => row.date.startsWith("2026-10")) });
    render(<MarketingHomePage currentUser={user} />);
    await screen.findByLabelText("Leads: 5");
    const card = screen.getByRole("heading", { name: "Proyecto Real" }).closest("article") as HTMLElement;
    expect(within(card).getByText("Sin leads antes")).toBeInTheDocument();
    expect(within(card).getByText("Antes: 0")).toBeInTheDocument();
});

it("shows a preload while loading initially and while a new period is pending", async () => {
    let finish: (value: MarketingApiSummary) => void = () => undefined;
    request.mockImplementationOnce(
        () =>
            new Promise((resolve) => {
                finish = resolve;
            }),
    );
    const view = render(<MarketingHomePage currentUser={user} />);
    expect(screen.getByRole("status", { name: "Cargando Mercadeo" })).toBeInTheDocument();
    expect(view.container.querySelector(".marketing-home")).toHaveAttribute("aria-busy", "true");
    finish(fixture());
    await screen.findByLabelText("Leads: 5");
    expect(screen.queryByRole("status", { name: "Cargando Mercadeo" })).not.toBeInTheDocument();
    request.mockImplementationOnce(() => new Promise(() => undefined));
    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
    expect(screen.getByRole("status", { name: "Cargando Mercadeo" })).toBeInTheDocument();
});
it("ends the preload on failure so retry remains available", async () => {
    request.mockRejectedValueOnce(new Error("Unavailable"));
    render(<MarketingHomePage currentUser={user} />);
    await screen.findByRole("button", { name: "Reintentar" });
    expect(screen.queryByRole("status", { name: "Cargando Mercadeo" })).not.toBeInTheDocument();
});

it("shows the preload during local project transitions without refetching", async () => {
    request.mockResolvedValue(fixture());
    const view = render(<MarketingHomePage currentUser={user} />);
    await screen.findByLabelText("Leads: 5");
    const preloads: Node[] = [];
    const observer = new MutationObserver((records) => {
        for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLElement && node.classList.contains("marketing-home__preload")) preloads.push(node);
    });
    observer.observe(view.container, { childList: true, subtree: true });
    try {
        await selectMarketing("Proyecto", "Proyecto Real");
        await waitFor(() => {
            expect(preloads.length).toBeGreaterThan(0);
        });
        expect(screen.getByLabelText("Leads: 5")).toBeInTheDocument();
        expect(request).toHaveBeenCalledTimes(1);
    } finally {
        observer.disconnect();
    }
});

it("keeps the session greeting when filtering by project", async () => {
    request.mockResolvedValue(fixture());
    render(<MarketingHomePage currentUser={user} />);
    await screen.findByLabelText("Leads: 5");
    await selectMarketing("Proyecto", "Proyecto Real");
    const welcome = screen.getByRole("region", { name: "Bienvenida a Mercadeo" });
    expect(within(welcome).getByText("Hola, Usuario")).toBeInTheDocument();
    expect(welcome.querySelector("img.marketing-welcome__photo")).toBeNull();
});

function appointmentsFixture(): MarketingApiSummary {
    return {
        ...fixture(),
        appointments: {
            available: true,
            events: [
                { id: "legacy:1", date: "2026-10-21", status: "completed", attendance: null, links: [{ sellerId: photoId, projectId: "p" }] },
                { id: "native:2", date: "2026-10-22", status: "completed", attendance: "attended", links: [{ sellerId: "other", projectId: "p" }] },
                { id: "native:3", date: "2026-10-23", status: "scheduled", attendance: null, links: [{ sellerId: photoId, projectId: "p" }] },
                { id: "native:4", date: "2026-10-23", status: "cancelled", attendance: null, links: [{ sellerId: photoId, projectId: "p" }] },
            ],
            leadsWithAppointment: [{ date: "2026-10-23", sellerId: photoId, projectId: "p", withAppointment: 1 }],
            quality: { unresolvedLinks: 0, invalidDates: 0, unknownStatuses: 0, nativeTypeConfigured: true },
        },
    };
}
it("validates appointment evidence and rejects impossible conversion and disconnected event links", () => {
    const data = appointmentsFixture();
    expect(parseMarketingHomeSummary(data, "month").appointments.available).toBe(true);
    if (!data.appointments.available) throw Error("Unavailable");
    const appointments = data.appointments;
    expect(() => parseMarketingHomeSummary({ ...data, appointments: { ...appointments, leadsWithAppointment: [{ date: "2026-10-23", sellerId: photoId, projectId: "p", withAppointment: 4 }] } }, "month")).toThrow();
    expect(() => parseMarketingHomeSummary({ ...data, appointments: { ...data.appointments, events: [{ ...appointments.events[0], links: [{ sellerId: "missing", projectId: "p" }] }] } }, "month")).toThrow();
});
it("shows unique completed events by event date, conversion by captured cohort and filters by project", async () => {
    request.mockResolvedValue(appointmentsFixture());
    render(<MarketingHomePage currentUser={user} />);
    expect(await screen.findByLabelText("Leads con cita: 20 %")).toBeInTheDocument();
    expect(screen.getByLabelText("Citas completadas: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Leads sin cita · 7 días: 4")).toBeInTheDocument();
    await selectMarketing("Proyecto", "Proyecto Real");
    expect(screen.getByLabelText("Citas completadas: 2")).toBeInTheDocument();
    expect(screen.getByText(/1 asistidas/)).toBeInTheDocument();
    expect(screen.getByLabelText("Leads con cita: 20 %")).toBeInTheDocument();
});

it("retains sellers whose appointments belong to leads captured outside coverage", async () => {
    const data = appointmentsFixture();
    if (!data.appointments.available) throw Error("Unavailable");
    const appointments = data.appointments;
    request.mockResolvedValue({ ...data, sellers: [...data.sellers, { id: "event-only", publicId: null, name: "Vendedor Histórico" }], projects: [...data.projects, { id: "old-project", publicId: null, name: "Proyecto Histórico" }], appointments: { ...appointments, quality: { ...appointments.quality, unresolvedLinks: 2 }, events: [...appointments.events, { id: "old", date: "2026-10-21", status: "completed", attendance: null, links: [{ sellerId: "event-only", projectId: "old-project" }] }] } });
    render(<MarketingHomePage currentUser={user} />);
    expect(await screen.findByText(/2 citas sin lead asociado no se cuentan/)).toBeInTheDocument();
    await selectMarketing("Proyecto", "Proyecto Histórico");
    expect(screen.getByLabelText("Leads: 0")).toBeInTheDocument();
    expect(screen.getByLabelText("Citas completadas: 1")).toBeInTheDocument();
});

it("uses readable project names in connected alerts and omits unavailable campaigns", async () => {
    const data = appointmentsFixture();
    request.mockResolvedValue({
        ...data,
        rows: [
            { date: "2026-10-23", sellerId: photoId, projectId: "p", leads: 30 },
            { date: "2026-09-23", sellerId: photoId, projectId: "p", leads: 60 },
        ],
        counts: { leads: 30, previousLeads: 60 },
    });
    render(<MarketingHomePage currentUser={user} />);
    const alerts = await screen.findByRole("region", { name: "Resultados para revisar" });
    expect(within(alerts).getByText("Proyecto Real: 30 leads menos (50 %) · 30 vs. 60")).toBeInTheDocument();
    expect(alerts).not.toHaveTextContent("Campaña");
});

it("explains comparisons, completed status, cohort counts and only nonzero quality issues", async () => {
    const data = appointmentsFixture();
    if (!data.appointments.available) throw Error("Unavailable");
    request.mockResolvedValue({ ...data, appointments: { ...data.appointments, quality: { ...data.appointments.quality, unresolvedLinks: 2 } } });
    render(<MarketingHomePage currentUser={user} />);
    expect(await screen.findByLabelText("Leads: 5")).toBeInTheDocument();
    expect(screen.getByLabelText("Citas completadas: 2")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Periodo y proyecto" })).getByText(/ · vs\. /)).toBeInTheDocument();
    expect(screen.getByText(/2 citas sin lead asociado no se cuentan/)).toBeInTheDocument();
    expect(screen.queryByText(/0 con fecha inválida/)).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Qué significa: Leads" }));
    expect(await screen.findByText(/Una persona puede tener varios registros/)).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Qué significa: Leads con cita" }));
    expect(await screen.findByText(/Una cita futura cuenta/)).toBeInTheDocument();
});

it("offers only project filtering while retaining the seller breakdown", async () => {
    request.mockResolvedValue(fixture());
    render(<MarketingHomePage currentUser={user} />);
    await screen.findByLabelText("Leads: 5");
    expect(screen.queryByRole("combobox", { name: "Vendedor" })).not.toBeInTheDocument();
    const ranking = screen.getByRole("region", { name: "Leads por vendedor" });
    expect(within(ranking).getByText("Vendedor Uno")).toBeInTheDocument();
    expect(within(ranking).getByText("Vendedor Dos")).toBeInTheDocument();
    expect(within(ranking).queryByRole("button", { name: /Vendedor Uno/ })).not.toBeInTheDocument();
    await selectMarketing("Proyecto", "Proyecto Real");
    expect(screen.getByLabelText("Leads: 5")).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
});

it.each(["mercadeo", "jefe_mercadeo"])("shows other sellers' authorized totals for a %s identity", async (roleCode) => {
    request.mockResolvedValue(fixture());
    render(<MarketingHomePage currentUser={{ ...user, publicId: `${roleCode}-user` }} />);
    expect(await screen.findByLabelText("Leads: 5")).toBeInTheDocument();
    const ranking = screen.getByRole("region", { name: "Leads por vendedor" });
    expect(within(ranking).getByText("Vendedor Uno")).toBeInTheDocument();
    expect(within(ranking).getByText("Vendedor Dos")).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith("month");
    expect(screen.queryByRole("combobox", { name: "Vendedor" })).not.toBeInTheDocument();
});

it("shows reserved leads next to Leads even when appointments are unavailable", async () => {
    const value = { ...fixture(), reservationsAvailable: true, rows: fixture().rows.map((row) => ({ ...row, withReservation: 1 })) };
    request.mockResolvedValue(value);
    render(<MarketingHomePage currentUser={user} />);
    expect(await screen.findByLabelText("Leads con reserva: 2")).toBeInTheDocument();
    const banners = screen.getAllByRole("article");
    expect(within(banners[0] as HTMLElement).getByText("Leads")).toBeInTheDocument();
    expect(within(banners[1] as HTMLElement).getByText("Leads con reserva")).toBeInTheDocument();
    expect(() => parseMarketingHomeSummary({ ...value, rows: [{ ...value.rows[0], withReservation: 99 }] }, "month")).toThrow();
});

it("filters reserved leads by project and hides them while changing period", async () => {
    const value = { ...fixture(), reservationsAvailable: true, rows: fixture().rows.map((row) => ({ ...row, withReservation: 1 })) };
    value.projects = [...value.projects, { id: "q", publicId: "q", name: "Proyecto Otro" }];
    value.rows = [...value.rows, { date: "2026-10-23", sellerId: photoId, projectId: "q", leads: 1, withReservation: 1 }];
    request.mockResolvedValueOnce(value).mockReturnValueOnce(new Promise(() => {}));
    render(<MarketingHomePage currentUser={user} />);
    expect(await screen.findByLabelText("Leads con reserva: 3")).toBeInTheDocument();
    await selectMarketing("Proyecto", "Proyecto Real");
    expect(await screen.findByLabelText("Leads con reserva: 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
    expect(screen.getByLabelText("Leads con reserva: —")).toBeInTheDocument();
});

it.each([-1, 1.5, "2", null, {}, Number.MAX_SAFE_INTEGER + 1])("rejects malformed reservation evidence: %j", (withReservation) => {
    const value = fixture();
    expect(() => parseMarketingHomeSummary({ ...value, reservationsAvailable: true, rows: value.rows.map((row) => ({ ...row, withReservation })) }, "month")).toThrow();
});
