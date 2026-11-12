import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { exportFileName } from "../../src/modules/marketing/capture-export";
import { apiPeriodOf, periodRange } from "../../src/modules/marketing/capture-period";
import { captureKpis, chartGroups, filterCaptureRows, generalRows, sellerSections, summaryRows } from "../../src/modules/marketing/lead-capture-report";
import { MarketingLeadCapturePage } from "../../src/modules/marketing/MarketingLeadCapturePage";
import { installBrowserApiDoubles } from "../support/browser";
import { CAPTURE_DEMO_ROWS, captureCatalogs, captureResponse, captureUser, defaultCaptureFilters } from "./fixtures/capture-report";

const exportDoubles = vi.hoisted(() => ({ downloadBlob: vi.fn(), printReport: vi.fn(), renderNodeToPng: vi.fn() }));
vi.mock("../../src/modules/marketing/capture-export", async (original) => ({ ...(await original<Record<string, unknown>>()), ...exportDoubles }));

const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: api.request }));
beforeEach(() => {
    api.request.mockReset();
    api.request.mockImplementation((url: string) => {
        const period = url.split("period=")[1] ?? "month";
        const response = captureResponse();
        const start = period === "day" ? response.today : response.range.start;
        const result = { ...response, period, range: { start, end: response.today }, rows: response.rows.filter((row) => row.date >= start) };
        return Promise.resolve({ ...result, sources: { ...result.sources, legacy: result.rows.reduce((sum, row) => sum + row.leads, 0) } });
    });
});
afterEach(cleanup);

const rows = filterCaptureRows(CAPTURE_DEMO_ROWS, defaultCaptureFilters());
const sum = (items: readonly { readonly leads?: number; readonly value?: number }[]) => items.reduce((total, item) => total + (item.leads ?? item.value ?? 0), 0);

describe("lead-capture report model", () => {
    const measures = ["leads", "appointments", "lost"] as const;

    it("keeps canonical IDs containing separators and accented labels in distinct paths", () => {
        const row = { date: "2026-10-26", sellerId: "s", projectId: "p", leads: 1, noAppointment: 1, scheduled: 0, completed: 0, lost: 0 };
        const input = [
            { ...row, campaignId: "a|b", adId: "c" },
            { ...row, campaignId: "a", adId: "b|c" },
        ];
        const catalogs = {
            sellers: [{ id: "s", name: "Vendedora", publicId: null }],
            projects: [{ id: "p", name: "Proyecto" }],
            campaigns: [
                { id: "a|b", name: "Campaña | {uno}" },
                { id: "a", name: "Campaña dos" },
            ],
            ads: [
                { id: "c", name: "Anuncio uno" },
                { id: "b|c", name: "Vídeo | {ñ}" },
            ],
        };
        const summary = summaryRows(input, 3, "leads", catalogs);
        expect(summary).toHaveLength(2);
        expect(summary.map((item) => item.path)).toContainEqual(["Proyecto", "Campaña dos", "Vídeo | {ñ}"]);
        expect(generalRows(input, 3, "leads", catalogs)).toHaveLength(2);
        expect(chartGroups(input, 3, "leads", catalogs).groups.map((item) => item.values)).toEqual([[1], [1]]);
    });

    it("adds up the same total however it is cut, for every measure and depth", () => {
        for (const measure of measures) {
            for (const depth of [1, 2, 3] as const) {
                const total = summaryRows(rows, depth, measure, captureCatalogs).reduce((all, row) => all + row.value, 0);
                expect(generalRows(rows, depth, measure, captureCatalogs).reduce((all, row) => all + row.value, 0)).toBe(total);
                expect(sellerSections(rows, depth, measure, captureCatalogs).reduce((all, section) => all + section.value, 0)).toBe(total);
                expect(
                    chartGroups(rows, depth, measure, captureCatalogs)
                        .groups.flatMap((group) => group.values)
                        .reduce((all, value) => all + value, 0),
                ).toBe(total);
            }
        }
    });

    it("keeps every level equal to the sum of what is inside it", () => {
        const check = (nodes: readonly { readonly value: number; readonly children: readonly { readonly value: number }[] }[]) => {
            for (const node of nodes) if (node.children.length > 0) expect(sum(node.children)).toBe(node.value);
        };
        for (const measure of measures) {
            for (const section of sellerSections(rows, 3, measure, captureCatalogs)) {
                check(section.projects);
                check(section.projects.flatMap((project) => project.children));
            }
        }
    });

    it("splits every lead into exactly one appointment state", () => {
        for (const row of rows) expect(row.noAppointment + row.scheduled + row.completed).toBe(row.leads);
        for (const row of summaryRows(rows, 3, "appointments", captureCatalogs)) expect(row.detail.noAppointment + row.detail.scheduled + row.detail.completed).toBe(row.detail.leads);
        expect(summaryRows(rows, 1, "appointments", captureCatalogs).reduce((all, row) => all + row.value, 0)).toBe(rows.reduce((all, row) => all + row.scheduled + row.completed, 0));
    });

    it("never reports more lost leads than leads", () => {
        for (const row of rows) expect(row.lost).toBeLessThanOrEqual(row.leads);
    });

    it("filters by period and seller", () => {
        const one = filterCaptureRows(CAPTURE_DEMO_ROWS, { ...defaultCaptureFilters(), sellers: ["ana"] });
        expect(one.every((row) => row.sellerId === "ana")).toBe(true);
        const day = filterCaptureRows(CAPTURE_DEMO_ROWS, { from: "2026-10-26", to: "2026-10-26", sellers: [] });
        expect(day.every((row) => row.date === "2026-10-26")).toBe(true);
        expect(sum(day)).toBeLessThan(sum(rows));
    });
});

describe("lead-capture report screen", () => {
    it("opens by project with every seller, and shows the chart and the breakdown table behind a button", async () => {
        installBrowserApiDoubles();
        render(<MarketingLeadCapturePage currentUser={captureUser} initialPeriod="month" />);
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        expect(screen.getByRole("heading", { level: 1, name: "Captación de leads" })).toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "Vendedor" })).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /Leads por proyecto/ })).toBeInTheDocument();
        expect(screen.queryByRole("table", { name: "Leads por proyecto" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Ver desglose en tabla" }));
        expect(await screen.findByRole("table", { name: "Leads por proyecto" })).toBeInTheDocument();
        expect(screen.getByRole("figure", { name: /Leads por proyecto/ })).toBeInTheDocument();
    });

    it("narrows the chart to the projects clicked in the table, and clears them", async () => {
        installBrowserApiDoubles();
        render(<MarketingLeadCapturePage currentUser={captureUser} initialPeriod="month" />);
        fireEvent.click(await screen.findByRole("button", { name: "Ver desglose en tabla" }));
        const summary = await screen.findByRole("table", { name: "Leads por proyecto" });
        const chart = screen.getByRole("figure", { name: /Leads por proyecto/ });
        const groups = () => chart.querySelectorAll(".capture-columns-chart__group").length;
        const all = groups();
        expect(all).toBeGreaterThan(1);
        const [first, second] = within(summary).getAllByRole("button", { pressed: false });
        fireEvent.click(first as HTMLElement);
        expect(groups()).toBe(1);
        expect(screen.getAllByText(/Mostrando/)[0]).toHaveTextContent("1 proyecto");
        fireEvent.click(second as HTMLElement);
        expect(groups()).toBe(2);
        fireEvent.click(screen.getAllByRole("button", { name: "Quitar selección" })[0] as HTMLElement);
        expect(groups()).toBe(all);
    });

    it("goes one level deeper: a table of campaigns and then one of ads, next to the projects", async () => {
        installBrowserApiDoubles();
        render(<MarketingLeadCapturePage currentUser={captureUser} initialPeriod="month" />);
        fireEvent.click(await screen.findByRole("button", { name: "Ver desglose en tabla" }));
        expect(screen.queryByRole("table", { name: "Leads por campaña" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Proyecto › Campaña" }));
        const campaigns = await screen.findByRole("table", { name: "Leads por campaña" });
        expect(within(campaigns).getByRole("columnheader", { name: "Campaña" })).toBeInTheDocument();
        expect(within(campaigns).getAllByText("Lanzamiento").length).toBeGreaterThan(0);
        expect(screen.queryByRole("table", { name: "Leads por anuncio" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Proyecto › Campaña › Anuncio" }));
        expect(within(await screen.findByRole("table", { name: "Leads por anuncio" })).getByRole("columnheader", { name: "Anuncio" })).toBeInTheDocument();
        expect(screen.getByRole("table", { name: "Leads por proyecto" })).toBeInTheDocument();
    });

    it("retains all sellers when changing to a shorter period", async () => {
        installBrowserApiDoubles();
        render(<MarketingLeadCapturePage currentUser={captureUser} initialPeriod="month" />);
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        expect(screen.queryByRole("combobox", { name: "Vendedor" })).not.toBeInTheDocument();
        expect(document.querySelector('img[src*="/vendedores/"]')).toBeNull();
        fireEvent.change(screen.getByRole("combobox", { name: "Periodo" }), { target: { value: "day" } });
        fireEvent.click(screen.getByRole("button", { name: "Aplicar filtro" }));
        expect(screen.getByRole("combobox", { name: "Periodo" })).toHaveValue("day");
    });

    it("shows no money anywhere", async () => {
        installBrowserApiDoubles();
        render(<MarketingLeadCapturePage currentUser={captureUser} initialPeriod="month" />);
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        expect(document.body.textContent).not.toMatch(/USD|\$|Valor|Inversión|Costo/);
    });

    it("keeps project headings without the repeated legend or seller photos", async () => {
        installBrowserApiDoubles();
        render(<MarketingLeadCapturePage currentUser={captureUser} initialPeriod="month" />);
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        const chart = screen.getByRole("figure");
        expect(within(chart).getByRole("heading", { name: "Proyecto Horizonte" })).toBeInTheDocument();
        expect(document.querySelector(".capture-columns-chart__legend")).toBeNull();
        expect(chart.querySelector("img")).toBeNull();
    });

    it("switches what is counted without touching the depth, and shows the appointment columns", async () => {
        installBrowserApiDoubles();
        render(<MarketingLeadCapturePage currentUser={captureUser} initialPeriod="month" />);
        fireEvent.click(await screen.findByRole("button", { name: "Ver desglose en tabla" }));
        fireEvent.click(screen.getByRole("button", { name: "Proyecto › Campaña › Anuncio" }));
        fireEvent.click(screen.getByRole("button", { name: "Leads con cita" }));
        expect(screen.getByRole("button", { name: "Proyecto › Campaña › Anuncio" })).toHaveAttribute("aria-pressed", "true");
        const table = await screen.findByRole("table", { name: "Leads con cita por proyecto" });
        for (const name of ["Con cita", "Programada", "Realizada", "Sin cita", "Total de leads"]) expect(within(table).getByRole("columnheader", { name })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Leads perdidos" }));
        expect(within(await screen.findByRole("table", { name: "Leads perdidos por proyecto" })).getByRole("columnheader", { name: "Perdidos" })).toBeInTheDocument();
    });

    it("keeps one flat table per level that adds up to the same total, and narrows campaigns and ads to the projects picked", async () => {
        installBrowserApiDoubles();
        render(<MarketingLeadCapturePage currentUser={captureUser} initialPeriod="month" />);
        fireEvent.click(await screen.findByRole("button", { name: "Ver desglose en tabla" }));
        fireEvent.click(screen.getByRole("button", { name: "Proyecto › Campaña › Anuncio" }));
        const tables = ["proyecto", "campaña", "anuncio"].map((noun) => screen.getByRole("table", { name: `Leads por ${noun}` }));
        const totals = tables.map((table) => within(table).getAllByRole("row").at(-1)?.textContent);
        expect(new Set(totals.map((text) => text?.replace(/\D+/g, "").slice(0, 6))).size).toBe(1);
        for (const table of tables) {
            expect(table.textContent).not.toMatch(/NaN|undefined/);
            expect(table.querySelectorAll("th[rowspan]")).toHaveLength(0);
        }
        const before = within(tables[1] as HTMLElement).getAllByRole("row").length;
        fireEvent.click(within(tables[0] as HTMLElement).getAllByRole("button", { pressed: false })[0] as HTMLElement);
        expect(within(screen.getByRole("table", { name: "Leads por campaña" })).getAllByRole("row").length).toBeLessThan(before);
    });

    it("offers the report as an image or a PDF from one Descargar menu", async () => {
        installBrowserApiDoubles();
        const blob = new Blob(["png"]);
        exportDoubles.renderNodeToPng.mockResolvedValue(blob);
        render(<MarketingLeadCapturePage currentUser={captureUser} initialPeriod="month" />);
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        fireEvent.click(screen.getByRole("button", { name: /Descargar/ }));
        fireEvent.click(await screen.findByText("Imagen (PNG)"));
        await vi.waitFor(() => {
            expect(exportDoubles.downloadBlob).toHaveBeenCalledWith(blob, expect.stringMatching(/^captacion_leads_proyecto_.*\.png$/));
        });
        fireEvent.click(screen.getByRole("button", { name: /Descargar/ }));
        fireEvent.click(await screen.findByText("PDF"));
        expect(exportDoubles.printReport).toHaveBeenCalledTimes(1);
    });
});

describe("export file names", () => {
    it("are lowercase, without accents or characters a file system rejects", () => {
        expect(exportFileName(["captacion", "Citas", "Campaña/Año", "2026-10-01"], "pdf")).toBe("captacion_citas_campana-ano_2026-10-01.pdf");
        expect(exportFileName(["///"], "png")).toBe("reporte.png");
    });
});

describe("lead-capture banners", () => {
    it("gives the total, the share of all leads and the average per campaign for each measure", () => {
        const row = { date: "2026-10-26", sellerId: "s", leads: 10, noAppointment: 6, scheduled: 1, completed: 1, lost: 2 };
        const input = [
            { ...row, projectId: "p1", campaignId: "c1", adId: "a" },
            { ...row, sellerId: "t", projectId: "p1", campaignId: "c1", adId: "a" },
            { ...row, projectId: "p2", campaignId: "c2", adId: "a", lost: 4 },
        ];
        expect(captureKpis(input, "lost", 2)).toEqual({ total: 8, share: (8 / 30) * 100, projects: 2, units: 2, average: 4 });
        expect(captureKpis(input, "lost", 1)).toMatchObject({ units: 2, average: 4 });
        expect(captureKpis(input, "leads", 1)).toMatchObject({ total: 30, share: null, average: 15 });
        expect(captureKpis(input, "appointments", 3)).toMatchObject({ total: 6, share: 20 });
        expect(captureKpis([], "lost", 1)).toMatchObject({ total: 0, share: null, average: 0 });
    });
});

describe("quarter and year periods", () => {
    const report = { today: "2026-11-14", range: { start: "2020-02-03", end: "2026-11-14" } };
    it("are cut from everything: calendar quarter or year up to today, never before the data begins", () => {
        expect(apiPeriodOf("quarter")).toBe("all");
        expect(apiPeriodOf("year")).toBe("all");
        expect(apiPeriodOf("week")).toBe("week");
        expect(periodRange("quarter", report)).toEqual({ from: "2026-10-01", to: "2026-11-14" });
        expect(periodRange("year", report)).toEqual({ from: "2026-01-01", to: "2026-11-14" });
        expect(periodRange("month", report)).toEqual({ from: "2020-02-03", to: "2026-11-14" });
        expect(periodRange("year", { today: "2026-11-14", range: { start: "2026-03-10", end: "2026-11-14" } }).from).toBe("2026-03-10");
    });
});

it("groups the report by the selected dimension without exposing seller names or photos", async () => {
    installBrowserApiDoubles();
    render(<MarketingLeadCapturePage currentUser={captureUser} initialPeriod="month" />);
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    for (const name of ["Ana Solís", "Carlos Vega", "Diana Mora"]) expect(screen.queryByText(name)).not.toBeInTheDocument();
    expect(document.querySelector('img[src*="/vendedores/"]')).toBeNull();
    expect(screen.getByRole("figure", { name: "Leads por proyecto · por mes" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Proyecto › Campaña" }));
    expect(screen.getByRole("figure", { name: "Leads por proyecto y campaña · por mes" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Proyecto › Campaña › Anuncio" }));
    expect(screen.getByRole("figure", { name: "Leads por proyecto, campaña y anuncio · por mes" })).toBeInTheDocument();
});

it("offers loss reasons under Qué medir with chart, table and project-scoped totals", async () => {
    installBrowserApiDoubles();
    const report = captureResponse();
    const rows = report.rows.map((row) => ({ ...row, lossReasons: row.lost > 0 ? [{ code: "budget", name: "Presupuesto", count: row.lost }] : [] }));
    api.request.mockResolvedValue({ ...report, rows });
    render(<MarketingLeadCapturePage currentUser={captureUser} initialPeriod="month" />);
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    fireEvent.click(within(screen.getByRole("group", { name: "Qué medir" })).getByRole("button", { name: "Motivos de pérdida" }));
    const chart = screen.getByRole("figure", { name: "Motivos de pérdida · por mes" });
    expect(within(chart).getAllByText("Presupuesto").length).toBeGreaterThan(0);
    expect(chart.querySelectorAll(".capture-columns-chart__group")).toHaveLength(1);
    expect(chart.querySelector(".capture-columns-chart__stack-wrap > strong")).toHaveTextContent(String(rows.reduce((sum, row) => sum + row.lost, 0)));
    fireEvent.click(screen.getByRole("button", { name: "Ver desglose en tabla" }));
    expect(await screen.findByRole("table", { name: "Leads por motivo de pérdida" })).toBeInTheDocument();
    const projects = screen.getByRole("table", { name: "Motivos de pérdida por proyecto" });
    const project = rows.find((row) => row.lost > 0)?.projectId;
    const name = report.projects.find((p) => p.id === project)?.name ?? "";
    fireEvent.click(within(projects).getByRole("button", { name }));
    expect(chart.querySelector(".capture-columns-chart__stack-wrap > strong")).toHaveTextContent(String(rows.filter((row) => row.projectId === project).reduce((sum, row) => sum + row.lost, 0)));
});

it("applies custom dates only on submit and compares the same projects by month", async () => {
    installBrowserApiDoubles();
    const fixture = captureResponse();
    api.request.mockImplementation((url: string) => Promise.resolve(url.includes("period=all") ? { ...fixture, period: "all", range: { start: "2026-09-01", end: fixture.today }, rows: CAPTURE_DEMO_ROWS, sources: { ...fixture.sources, legacy: CAPTURE_DEMO_ROWS.reduce((sum, row) => sum + row.leads, 0) } } : fixture));
    render(<MarketingLeadCapturePage currentUser={captureUser} initialPeriod="month" />);
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    const initial = document.querySelector(".capture-kpis__value")?.textContent;
    fireEvent.change(screen.getByRole("combobox", { name: "Periodo" }), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-26" } });
    expect(document.querySelector(".capture-kpis__value")?.textContent).toBe(initial);
    expect(api.request).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtro" }));
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    expect(api.request).toHaveBeenCalledWith("/marketing/leads/report?period=all");
    const chart = screen.getByRole("figure", { name: "Leads por proyecto · por mes" });
    expect(chart.querySelectorAll(".capture-columns-chart__group")).toHaveLength(30);
    expect(chart).toHaveTextContent("sept");
    expect(chart).toHaveTextContent("oct");
    fireEvent.click(screen.getByRole("button", { name: "Ver desglose en tabla" }));
    expect(await screen.findByRole("table", { name: "Comparación por mes" })).toBeInTheDocument();
});

it("rejects reversed custom dates without changing the applied results", async () => {
    installBrowserApiDoubles();
    render(<MarketingLeadCapturePage currentUser={captureUser} initialPeriod="month" />);
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    fireEvent.change(screen.getByRole("combobox", { name: "Periodo" }), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtro" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Desde debe ser anterior");
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("figure", { name: "Leads por proyecto · por mes" })).toBeInTheDocument();
});

it("uses one compact period selector without an independent chart grouping", async () => {
    installBrowserApiDoubles();
    render(<MarketingLeadCapturePage currentUser={captureUser} initialPeriod="month" />);
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    expect(screen.getByRole("combobox", { name: "Periodo" })).toHaveValue("month");
    expect(screen.getByRole("combobox", { name: "Meses" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Agrupar gráfico" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Desde")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Periodo" }), { target: { value: "custom" } });
    expect(screen.getByLabelText("Desde")).toBeInTheDocument();
    expect(screen.getByLabelText("Hasta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aplicar filtro" })).toBeInTheDocument();
});

it("selects named months and compares every project using the historical report", async () => {
    installBrowserApiDoubles();
    const fixture = captureResponse();
    api.request.mockImplementation((url: string) => Promise.resolve(url.includes("period=all") ? { ...fixture, period: "all", range: fixture.coverage, rows: CAPTURE_DEMO_ROWS, sources: { ...fixture.sources, legacy: sum(CAPTURE_DEMO_ROWS) } } : { ...fixture, period: url.split("period=")[1] }));
    render(<MarketingLeadCapturePage currentUser={captureUser} initialPeriod="month" />);
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Meses" }));
    const initialTotal = document.querySelector(".capture-kpis__value")?.textContent;
    fireEvent.click(await screen.findByText("septiembre de 2026", { selector: ".ant-select-item-option-content" }));
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".capture-kpis__value")?.textContent).toBe(initialTotal);
    expect(screen.getByRole("combobox", { name: "Meses" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtro" }));
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    expect(api.request).toHaveBeenLastCalledWith("/marketing/leads/report?period=all");
    const chart = screen.getByRole("figure", { name: "Leads por proyecto · por mes" });
    expect(chart.querySelectorAll(".capture-columns-chart__group")).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Ver desglose en tabla" }));
    const matrix = await screen.findByRole("table", { name: "Comparación por mes" });
    expect(within(matrix).queryByRole("columnheader", { name: "Período" })).not.toBeInTheDocument();
    expect(within(matrix).getAllByRole("columnheader")).toHaveLength(4);
    expect(within(matrix).getAllByRole("row")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(chart).toHaveTextContent("sept");
    expect(chart).toHaveTextContent("oct");
    expect(document.querySelector(".capture-kpis__value")?.textContent.replace(/\s/g, "")).toBe(String(sum(CAPTURE_DEMO_ROWS)));
    expect(screen.getByText(/2 períodos seleccionados/)).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Meses" }));
    fireEvent.click(await screen.findByText("octubre de 2026", { selector: ".ant-select-item-option-content" }));
    expect(screen.getByRole("figure", { name: "Leads por proyecto · por mes" }).querySelectorAll(".capture-columns-chart__group")).toHaveLength(6);
    expect(api.request).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtro" }));
    expect(screen.getByRole("figure", { name: "Leads por proyecto · por mes" }).querySelectorAll(".capture-columns-chart__group")).toHaveLength(3);
    expect(api.request).toHaveBeenCalledTimes(2);
    fireEvent.change(screen.getByRole("combobox", { name: "Periodo" }), { target: { value: "week" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtro" }));
    expect(screen.getByRole("combobox", { name: "Semanas" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Meses" })).not.toBeInTheDocument();
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    fireEvent.change(screen.getByRole("combobox", { name: "Periodo" }), { target: { value: "year" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtro" }));
    expect(screen.getByRole("combobox", { name: "Años" })).toBeInTheDocument();
});

it("preserves reserved lead totals through every depth and aggregation", () => {
    const reserved = rows.map((row) => ({ ...row, withReservation: Math.floor(row.leads / 2) }));
    const expected = reserved.reduce((sum, row) => sum + row.withReservation, 0);
    for (const depth of [1, 2, 3] as const) {
        expect(summaryRows(reserved, depth, "reservations", captureCatalogs).reduce((sum, row) => sum + row.value, 0)).toBe(expected);
        expect(generalRows(reserved, depth, "reservations", captureCatalogs).reduce((sum, row) => sum + row.value, 0)).toBe(expected);
        expect(sellerSections(reserved, depth, "reservations", captureCatalogs).reduce((sum, row) => sum + row.value, 0)).toBe(expected);
        expect(captureKpis(reserved, "reservations", depth).total).toBe(expected);
    }
});

it("opens on Hoy by default", async () => {
    installBrowserApiDoubles();
    render(<MarketingLeadCapturePage currentUser={captureUser} />);
    await screen.findByRole("combobox", { name: "Periodo" });
    expect(screen.getByRole("combobox", { name: "Periodo" })).toHaveValue("day");
    expect(api.request).toHaveBeenCalledWith("/marketing/leads/report?period=day");
});
