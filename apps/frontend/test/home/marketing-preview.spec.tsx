import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { niceMaximum, smoothPath, toPoints } from "../../src/modules/home/marketing-chart-geometry";
import {
    alertMarketingSample,
    bucketMarketingSample,
    canAdvanceMarketingSelection,
    emptyMarketingFilters,
    groupMarketingSample,
    horizonLeads as horizonLeadsForRows,
    type MarketingSelection,
    matrixMarketingSample,
    parseISODate,
    projectsForSeller as projectsForSellerForRows,
    recentWithoutAppointmentSeries as recentWithoutAppointmentSeriesForRows,
    resolveMarketingComparison,
    resolveMarketingPeriod,
    resolveMarketingView as resolveMarketingViewForRows,
    shiftMarketingSelection,
    summarizeMarketingSample,
    toISODate,
} from "../../src/modules/home/marketing-home-preview.model";
import { MarketingHomeDashboard as MarketingHomePage } from "../../src/modules/home/MarketingHomePage";
import type { IdentityUser } from "../../src/services/auth/identity-contracts";
import { MARKETING_SAMPLE } from "./fixtures/marketing-sample";
import { marketingOptions, selectedMarketingValues, selectMarketing } from "./marketing-select.helpers";

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

const resolveMarketingView = (filters: Parameters<typeof resolveMarketingViewForRows>[0], today?: Date) => resolveMarketingViewForRows(filters, today, MARKETING_SAMPLE);
const horizonLeads = (filters: Parameters<typeof horizonLeadsForRows>[0], today?: Date) => horizonLeadsForRows(filters, today, MARKETING_SAMPLE);
const recentWithoutAppointmentSeries = (filters: Parameters<typeof recentWithoutAppointmentSeriesForRows>[0], today?: Date) => recentWithoutAppointmentSeriesForRows(filters, today, MARKETING_SAMPLE);
const projectsForSeller = (seller: string) => projectsForSellerForRows(seller, MARKETING_SAMPLE);
const user = { displayName: "Vista previa", email: "preview@example.test" } as IdentityUser;
/** Friday 23 October 2026, so weeks and months in progress are exercised. */
const TODAY = new Date(2026, 9, 23);
const number = (value: number) => new Intl.NumberFormat("es-CR").format(value);
const iso = (range: { start: Date; end: Date }) => `${toISODate(range.start)}..${toISODate(range.end)}`;
const select = (mode: MarketingSelection["mode"], anchor = "2026-10-21"): MarketingSelection => ({ ...emptyMarketingFilters(TODAY).selection, mode, anchor });
const sum = (values: readonly number[]) => values.reduce((acc, value) => acc + value, 0);

describe("Marketing sample model", () => {
    it("keeps every row internally consistent", () => {
        for (const row of MARKETING_SAMPLE) {
            expect(row.withAppointment).toBeLessThanOrEqual(row.leads);
            expect(row.appointments).toBeGreaterThanOrEqual(row.withAppointment);
            expect(row.attended + row.missed).toBeLessThanOrEqual(row.appointments);
            expect(row.attended).toBeGreaterThanOrEqual(0);
        }
    });

    it("rejects impossible dates instead of rolling them over", () => {
        expect(parseISODate("2026-02-31")).toBeNull();
        expect(parseISODate("26-02-01")).toBeNull();
        expect(toISODate(parseISODate("2026-02-28") as Date)).toBe("2026-02-28");
    });

    it("assigns each seller to a subset of projects", () => {
        expect(projectsForSeller("")).toEqual(["Proyecto Centro", "Proyecto Norte", "Proyecto Parque"]);
        expect(projectsForSeller("Dayan")).toEqual(["Proyecto Norte", "Proyecto Parque"]);
        expect(projectsForSeller("Valeria")).toEqual(["Proyecto Centro", "Proyecto Norte"]);
        expect(projectsForSeller("Marlon")).toEqual(["Proyecto Centro", "Proyecto Parque"]);
    });
});

describe("Marketing period selection", () => {
    it("starts as today against yesterday", () => {
        const filters = emptyMarketingFilters(TODAY);
        const period = resolveMarketingPeriod(filters.selection, TODAY);
        expect(iso(period)).toBe("2026-10-23..2026-10-23");
        expect(iso(resolveMarketingComparison(filters.selection, period, TODAY))).toBe("2026-10-22..2026-10-22");
    });

    it("keeps a week in progress at its elapsed length and compares it with the same days of the previous week", () => {
        const selection = select("week");
        const period = resolveMarketingPeriod(selection, TODAY);
        expect(iso(period)).toBe("2026-10-19..2026-10-23");
        expect(iso(resolveMarketingComparison(selection, period, TODAY))).toBe("2026-10-12..2026-10-16");
    });

    it("compares a month in progress with the same days of the previous month and never overruns a shorter one", () => {
        const month = select("month");
        const period = resolveMarketingPeriod(month, TODAY);
        expect(iso(period)).toBe("2026-10-01..2026-10-23");
        expect(iso(resolveMarketingComparison(month, period, TODAY))).toBe("2026-09-01..2026-09-23");
        const closed = select("month", "2026-08-10");
        const august = resolveMarketingPeriod(closed, TODAY);
        expect(iso(august)).toBe("2026-08-01..2026-08-31");
        expect(iso(resolveMarketingComparison(closed, august, TODAY))).toBe("2026-07-01..2026-07-31");
        const march = select("month", "2026-03-10");
        expect(iso(resolveMarketingComparison(march, resolveMarketingPeriod(march, TODAY), TODAY))).toBe("2026-02-01..2026-02-28");
    });

    it("compares the year so far with the same days of last year", () => {
        const year = select("year");
        const period = resolveMarketingPeriod(year, TODAY);
        expect(iso(period)).toBe("2026-01-01..2026-10-23");
        expect(iso(resolveMarketingComparison(year, period, TODAY))).toBe("2025-01-01..2025-10-23");
        const closed = select("year", "2025-06-10");
        const full = resolveMarketingPeriod(closed, TODAY);
        expect(iso(full)).toBe("2025-01-01..2025-12-31");
        expect(iso(resolveMarketingComparison(closed, full, TODAY))).toBe("2024-01-01..2024-12-31");
    });

    it("orders a free range, caps it at today and compares it with the same length right before", () => {
        const selection: MarketingSelection = { ...select("range"), rangeStart: "2026-11-30", rangeEnd: "2026-10-10" };
        const period = resolveMarketingPeriod(selection, TODAY);
        expect(iso(period)).toBe("2026-10-10..2026-10-23");
        expect(iso(resolveMarketingComparison(selection, period, TODAY))).toBe("2026-09-26..2026-10-09");
    });

    it("supports same period last month, last year and custom dates", () => {
        const base = select("day", "2026-10-23");
        const period = resolveMarketingPeriod(base, TODAY);
        expect(iso(resolveMarketingComparison({ ...base, comparison: "lastMonth" }, period, TODAY))).toBe("2026-09-23..2026-09-23");
        expect(iso(resolveMarketingComparison({ ...base, comparison: "lastYear" }, period, TODAY))).toBe("2025-10-23..2025-10-23");
        expect(iso(resolveMarketingComparison({ ...base, comparison: "custom", compareStart: "2026-03-01", compareEnd: "2026-03-07" }, period, TODAY))).toBe("2026-03-01..2026-03-07");
    });

    it("has data for every comparison it offers", () => {
        for (const comparison of ["previous", "lastMonth", "lastYear"] as const) {
            const view = resolveMarketingView({ ...emptyMarketingFilters(TODAY), selection: { ...select("month"), comparison } }, TODAY);
            expect(summarizeMarketingSample(view.previousRows).leads).toBeGreaterThan(0);
        }
    });

    it("steps by the chosen unit and never moves past today", () => {
        const day = select("day", "2026-10-23");
        expect(shiftMarketingSelection(day, -1, TODAY).anchor).toBe("2026-10-22");
        expect(canAdvanceMarketingSelection(day, TODAY)).toBe(false);
        expect(shiftMarketingSelection(day, 1, TODAY).anchor).toBe("2026-10-23");
        expect(shiftMarketingSelection(select("week"), -1, TODAY).anchor).toBe("2026-10-12");
        expect(shiftMarketingSelection(select("month"), -1, TODAY).anchor).toBe("2026-09-01");
        expect(shiftMarketingSelection(select("year"), -1, TODAY).anchor).toBe("2025-01-01");
        const range: MarketingSelection = { ...select("range"), rangeStart: "2026-10-10", rangeEnd: "2026-10-16" };
        expect(shiftMarketingSelection(range, -1, TODAY)).toMatchObject({ rangeStart: "2026-10-03", rangeEnd: "2026-10-09" });
        expect(canAdvanceMarketingSelection(range, TODAY)).toBe(true);
    });

    it("reconciles groups, buckets and the seller matrix with the same totals", () => {
        const view = resolveMarketingView({ ...emptyMarketingFilters(TODAY), selection: { ...select("month"), comparison: "previous" } }, TODAY);
        const totals = summarizeMarketingSample(view.rows);
        for (const dimension of ["project", "campaign", "ad", "seller"] as const) expect(sum(groupMarketingSample(view, dimension).map((group) => group.leads))).toBe(totals.leads);
        expect(sum(bucketMarketingSample(view, view.windowRows, view.comparedRows).map((bucket) => bucket.leads))).toBe(totals.leads);
        expect(sum(matrixMarketingSample(view.rows).sellers.map((seller) => seller.total.leads))).toBe(totals.leads);
        expect(totals.pending + totals.attended + totals.missed).toBe(totals.appointments);
        expect(totals.withoutAppointment + totals.withAppointment).toBe(totals.leads);
    });

    it("draws a month day by day and a year month by month, and both add up to the cards", () => {
        const month = resolveMarketingView({ ...emptyMarketingFilters(TODAY), selection: select("month") }, TODAY);
        const days = bucketMarketingSample(month, month.windowRows, month.comparedRows);
        expect(days).toHaveLength(23);
        expect(sum(days.map((bucket) => bucket.leads))).toBe(summarizeMarketingSample(month.rows).leads);
        expect(sum(days.map((bucket) => bucket.compared))).toBe(summarizeMarketingSample(month.previousRows).leads);
        const year = resolveMarketingView({ ...emptyMarketingFilters(TODAY), selection: select("year") }, TODAY);
        const months = bucketMarketingSample(year, year.windowRows, year.comparedRows);
        expect(months).toHaveLength(10);
        expect(sum(months.map((bucket) => bucket.leads))).toBe(summarizeMarketingSample(year.rows).leads);
        expect(sum(months.map((bucket) => bucket.compared))).toBe(summarizeMarketingSample(year.previousRows).leads);
    });

    it("shows the week that ends on a single day so the chart still has a shape", () => {
        const view = resolveMarketingView(emptyMarketingFilters(TODAY), TODAY);
        expect(bucketMarketingSample(view, view.windowRows, view.comparedRows)).toHaveLength(7);
    });

    it("compares the chart with exactly the same dates the cards use", () => {
        const selection: MarketingSelection = { ...select("range"), rangeStart: "2026-10-20", rangeEnd: "2026-10-23", comparison: "custom", compareStart: "2026-10-01", compareEnd: "2026-10-01" };
        const view = resolveMarketingView({ ...emptyMarketingFilters(TODAY), selection }, TODAY);
        const compared = (source: typeof view) => sum(bucketMarketingSample(source, source.windowRows, source.comparedRows).map((bucket) => bucket.compared));
        expect(compared(view)).toBe(summarizeMarketingSample(view.previousRows).leads);
        for (const comparison of ["previous", "lastMonth", "lastYear"] as const) {
            const month = resolveMarketingView({ ...emptyMarketingFilters(TODAY), selection: { ...select("month"), comparison } }, TODAY);
            expect(compared(month)).toBe(summarizeMarketingSample(month.previousRows).leads);
        }
    });

    it("measures today, the week, the month and the year and keeps them nested", () => {
        const all = horizonLeads(emptyMarketingFilters(TODAY), TODAY);
        expect(all.day).toBeLessThanOrEqual(all.week);
        expect(all.week).toBeLessThanOrEqual(all.month);
        expect(all.month).toBeLessThanOrEqual(all.year);
        const perProject = projectsForSeller("").map((project) => horizonLeads({ ...emptyMarketingFilters(TODAY), project }, TODAY));
        expect(sum(perProject.map((item) => item.month))).toBe(all.month);
        expect(recentWithoutAppointmentSeries(emptyMarketingFilters(TODAY), TODAY)).toHaveLength(7);
    });

    it("keeps a source that fell to zero in the list and warns about it", () => {
        const base = { ...emptyMarketingFilters(TODAY), selection: { ...select("range"), rangeStart: "2026-10-01", rangeEnd: "2026-10-23", comparison: "custom" as const, compareStart: "2026-06-01", compareEnd: "2026-06-23" } };
        const view = resolveMarketingView({ ...base, ad: "Reel nuevo" }, TODAY);
        // The ad did not exist in June, so it is new; seen the other way round it disappears.
        const reversed = resolveMarketingView({ ...base, ad: "Reel nuevo", selection: { ...base.selection, rangeStart: "2026-06-01", rangeEnd: "2026-06-23", compareStart: "2026-10-01", compareEnd: "2026-10-23" } }, TODAY);
        expect(groupMarketingSample(view, "ad").find((group) => group.name === "Reel nuevo")?.previousLeads).toBe(0);
        const gone = groupMarketingSample(reversed, "ad").find((group) => group.name === "Reel nuevo");
        expect(gone).toMatchObject({ leads: 0, change: -100 });
        expect((gone?.previousLeads ?? 0) > 0).toBe(true);
    });

    it("never alarms from a single day and never repeats the dimension name", () => {
        for (let ago = 0; ago < 60; ago++) {
            const day = toISODate(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - ago));
            expect(alertMarketingSample(resolveMarketingView({ ...emptyMarketingFilters(TODAY), selection: select("day", day) }, TODAY))).toEqual([]);
        }
        const texts = [90, 120, 200, 300].flatMap((ago) => alertMarketingSample(resolveMarketingView({ ...emptyMarketingFilters(TODAY), selection: { ...select("month", toISODate(new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() - ago))), comparison: "lastYear" } }, TODAY)).map((alert) => alert.text));
        for (const text of texts) expect(text).not.toMatch(/Proyecto Proyecto/);
    });

    it("raises alerts only from sources with enough leads", () => {
        const view = resolveMarketingView({ ...emptyMarketingFilters(TODAY), selection: { ...select("month", "2026-09-10"), comparison: "previous" } }, TODAY);
        for (const alert of alertMarketingSample(view)) expect(alert.text).not.toBe("");
        expect(alertMarketingSample(view).length).toBeLessThanOrEqual(3);
        const quiet = resolveMarketingView({ ...emptyMarketingFilters(TODAY), project: "Proyecto Centro", selection: select("day", "2026-10-23") }, TODAY);
        expect(alertMarketingSample(quiet)).toEqual([]);
    });
});

describe("Marketing chart geometry", () => {
    it("rounds the top of the axis to a readable number", () => {
        expect([niceMaximum(0), niceMaximum(1), niceMaximum(7), niceMaximum(34), niceMaximum(101), niceMaximum(460)]).toEqual([1, 1, 10, 50, 200, 500]);
    });

    it("keeps the smooth curve inside its box", () => {
        const points = toPoints([0, 40, 0, 40, 0], 40, 100, 30);
        const path = smoothPath(points, 30);
        expect(path.startsWith("M0,30")).toBe(true);
        for (const value of path.match(/-?\d+(\.\d+)?/g) ?? []) expect(Number(value)).toBeGreaterThanOrEqual(0);
        expect(smoothPath([], 30)).toBe("");
    });
});

describe("Marketing Home summary", () => {
    const monthView = () => resolveMarketingView({ ...emptyMarketingFilters(), selection: { ...emptyMarketingFilters().selection, mode: "month" } });

    it("opens on the current month with explicitly supplied test rows and never fetches", () => {
        const fetch = vi.fn();
        vi.stubGlobal("fetch", fetch);
        render(<MarketingHomePage currentUser={user} rows={MARKETING_SAMPLE} />);
        expect(screen.queryByText(/Datos de demostración/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Sin conexión a API/)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Mes" })).toHaveAttribute("aria-pressed", "true");
        const totals = summarizeMarketingSample(monthView().rows);
        expect(screen.getByLabelText(`Leads: ${number(totals.leads)}`)).toBeInTheDocument();
        expect(fetch).not.toHaveBeenCalled();
    });

    it("keeps only the period and project as controls", () => {
        render(<MarketingHomePage currentUser={user} rows={MARKETING_SAMPLE} />);
        for (const label of ["Hoy", "Semana", "Mes", "Año"]) expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
        for (const label of ["Proyecto"]) expect(screen.getByRole("combobox", { name: label })).toBeInTheDocument();
        for (const label of ["Vendedor", "Campaña", "Anuncio", "Comparar con"]) expect(screen.queryByRole("combobox", { name: label })).not.toBeInTheDocument();
    });

    it("offers every authorized project without a seller restriction", () => {
        render(<MarketingHomePage currentUser={user} rows={MARKETING_SAMPLE} />);
        expect(selectedMarketingValues("Proyecto")).toEqual([]);
        expect(marketingOptions("Proyecto")).toEqual(projectsForSeller(""));
    });

    it("narrows the whole page to one project and puts it back with Todos", async () => {
        render(<MarketingHomePage currentUser={user} rows={MARKETING_SAMPLE} />);
        const filters = (project: string, seller = "") => ({ ...emptyMarketingFilters(), seller, project, selection: { ...emptyMarketingFilters().selection, mode: "month" as const } });
        const all = summarizeMarketingSample(resolveMarketingView(filters("")).rows).leads;
        const norte = summarizeMarketingSample(resolveMarketingView(filters("Proyecto Norte")).rows).leads;
        expect(norte).toBeLessThan(all);
        await selectMarketing("Proyecto", "Proyecto Norte");
        expect(screen.getByLabelText(`Leads: ${number(norte)}`)).toBeInTheDocument();
        expect(within(screen.getByRole("region", { name: "Leads por proyecto" })).getAllByRole("article")).toHaveLength(1);
        expect(screen.getByText("Captación de leads y citas · Proyecto Norte")).toBeInTheDocument();
        const ranking = screen.getByRole("region", { name: "Leads por vendedor" });
        const sellers = within(ranking).getAllByRole("listitem");
        expect(sellers.length).toBeLessThanOrEqual(4);
        await selectMarketing("Proyecto", "");
        expect(screen.getByLabelText(`Leads: ${number(all)}`)).toBeInTheDocument();
        expect(within(screen.getByRole("region", { name: "Leads por proyecto" })).getAllByRole("article")).toHaveLength(3);
    });

    it("combines projects without restricting their sellers", async () => {
        render(<MarketingHomePage currentUser={user} rows={MARKETING_SAMPLE} />);
        await selectMarketing("Proyecto", "Proyecto Parque");
        await selectMarketing("Proyecto", "Proyecto Norte", true);
        expect(selectedMarketingValues("Proyecto")).toEqual(["Proyecto Parque", "Proyecto Norte"]);
        const expected = summarizeMarketingSample(resolveMarketingView({ ...emptyMarketingFilters(), projects: ["Proyecto Parque", "Proyecto Norte"], selection: { ...emptyMarketingFilters().selection, mode: "month" } }).rows);
        expect(screen.getByLabelText(`Leads: ${number(expected.leads)}`)).toBeInTheDocument();
    });

    it("draws a trend inside each of the four cards", () => {
        render(<MarketingHomePage currentUser={user} rows={MARKETING_SAMPLE} />);
        for (const title of ["Leads", "Leads con cita", "Citas completadas", "Leads sin cita · 7 días"]) {
            const card = screen.getByRole("heading", { name: title }).closest("article") as HTMLElement;
            expect(card.querySelector("svg.marketing-spark")).not.toBeNull();
        }
        for (const title of ["Citas agendadas", "Citas pendientes", "Asistencia a citas"]) expect(screen.queryByRole("heading", { name: title })).not.toBeInTheDocument();
        const visits = screen.getByRole("heading", { name: "Citas completadas" }).closest("article") as HTMLElement;
        expect(visits).not.toHaveTextContent(/▼|▲/);
    });

    it("puts the lead card on the left and the greeting on the right, as Formalization does", () => {
        render(<MarketingHomePage currentUser={user} rows={MARKETING_SAMPLE} />);
        const leads = screen.getByRole("heading", { name: "Leads" }).closest("article") as HTMLElement;
        const greeting = screen.getByRole("region", { name: "Bienvenida a Mercadeo" });
        expect(leads.compareDocumentPosition(greeting) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("changes the whole page with the period", () => {
        render(<MarketingHomePage currentUser={user} rows={MARKETING_SAMPLE} />);
        expect(screen.getByRole("heading", { name: "Leads del mes" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
        expect(screen.getByRole("heading", { name: "Leads de los últimos 7 días" })).toBeInTheDocument();
        const today = summarizeMarketingSample(resolveMarketingView({ ...emptyMarketingFilters() }).rows);
        expect(screen.getByLabelText(`Leads: ${number(today.leads)}`)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Semana" }));
        expect(screen.getByRole("heading", { name: "Leads de la semana" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Año" }));
        expect(screen.getByRole("heading", { name: "Leads del año, mes a mes" })).toBeInTheDocument();
        expect(screen.getAllByText(/vs\. año pasado/).length).toBeGreaterThanOrEqual(1);
    });

    it("reads each point of the chart with the keyboard", () => {
        render(<MarketingHomePage currentUser={user} rows={MARKETING_SAMPLE} />);
        const plot = screen.getByRole("group", { name: /Gráfico de leads por día/ });
        expect(plot.querySelector(".marketing-area__tooltip")).toBeNull();
        fireEvent.keyDown(plot, { key: "ArrowLeft" });
        expect(plot.querySelector(".marketing-area__tooltip")).not.toBeNull();
        expect(screen.getByText(/leads, antes/)).toBeInTheDocument();
        fireEvent.blur(plot);
        expect(plot.querySelector(".marketing-area__tooltip")).toBeNull();
        expect(screen.getByRole("table", { name: "Leads por día" })).toBeInTheDocument();
    });

    it("shows one card per project with today, week, month and year", () => {
        render(<MarketingHomePage currentUser={user} rows={MARKETING_SAMPLE} />);
        const section = screen.getByRole("region", { name: "Leads por proyecto" });
        const cards = within(section).getAllByRole("article");
        expect(cards).toHaveLength(3);
        for (const card of cards) for (const label of ["Hoy", "Semana", "Mes", "Año"]) expect(within(card).getByText(label)).toBeInTheDocument();
        const total = sum(cards.map((card) => Number((card.querySelector(".marketing-project__total strong") as HTMLElement).textContent.replace(/\s/g, ""))));
        expect(total).toBe(summarizeMarketingSample(monthView().rows).leads);
    });

    it("keeps the ranking informative when a seller name is clicked", () => {
        render(<MarketingHomePage currentUser={user} rows={MARKETING_SAMPLE} />);
        const ranking = screen.getByRole("region", { name: "Leads por vendedor" });
        const total = summarizeMarketingSample(monthView().rows).leads;
        fireEvent.click(within(ranking).getByText("Marlon"));
        expect(screen.getByLabelText(`Leads: ${number(total)}`)).toBeInTheDocument();
        expect(within(ranking).queryByRole("button", { name: /Marlon/ })).not.toBeInTheDocument();
    });

    it("keeps the team illustration without hardcoded seller photos", () => {
        render(<MarketingHomePage currentUser={user} rows={MARKETING_SAMPLE} />);
        const welcome = screen.getByRole("region", { name: "Bienvenida a Mercadeo" });
        expect(welcome.querySelector("img.marketing-welcome__photo")).toBeNull();
        expect(welcome.querySelector("img.marketing-welcome__art")).toHaveAttribute("src", expect.stringContaining("rocca-marketing-generated.png"));
    });
    it("keeps the full seller ranking visible", () => {
        render(<MarketingHomePage currentUser={user} rows={MARKETING_SAMPLE} />);
        const ranking = screen.getByRole("region", { name: "Leads por vendedor" });
        expect(within(ranking).getAllByRole("listitem")).toHaveLength(4);
    });

    it("shows no alerts on a single day", () => {
        render(<MarketingHomePage currentUser={user} rows={MARKETING_SAMPLE} />);
        fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
        expect(screen.queryByRole("region", { name: "Resultados para revisar" })).not.toBeInTheDocument();
    });

    it("never triggers React list-key warnings while the period and project change", async () => {
        const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
        render(<MarketingHomePage currentUser={user} rows={MARKETING_SAMPLE} />);
        for (const mode of ["Hoy", "Semana", "Año", "Mes"]) fireEvent.click(screen.getByRole("button", { name: mode }));
        for (const project of ["Proyecto Norte", "Proyecto Parque", ""]) await selectMarketing("Proyecto", project);
        expect(errors.mock.calls.filter((call) => String(call[0]).includes('unique "key"'))).toEqual([]);
    });
});

it("prioritizes the largest absolute loss and includes both lead counts in alerts", () => {
    const today = parseISODate("2026-10-26") as Date;
    const initial = emptyMarketingFilters(today);
    const filters = { ...initial, selection: { ...initial.selection, mode: "month" as const } };
    const base = { seller: "Seller", campaign: "", ad: "", withAppointment: 0, appointments: 0, attended: 0, missed: 0 };
    const current = [134, 109, 87, 49];
    const previous = [344, 338, 218, 635];
    const rows = current.flatMap((leads, index) => [
        { ...base, project: `p${String(index)}`, projectName: `Proyecto ${String(index)}`, daysAgo: 0, leads },
        { ...base, project: `p${String(index)}`, projectName: `Proyecto ${String(index)}`, daysAgo: 30, leads: previous[index] as number },
    ]);
    const alerts = alertMarketingSample(resolveMarketingViewForRows(filters, today, rows));
    expect(alerts[0]?.key).toBe("project:p3");
    expect(alerts[0]?.text).toContain("586 leads menos");
    expect(alerts[0]?.text).toContain("49");
    expect(alerts[0]?.text).toContain("635");
});
