import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { exportFileName } from "../../src/modules/marketing/capture-export";
import { apiPeriodOf, periodRange } from "../../src/modules/marketing/capture-period";
import { captureKpis, chartGroups, filterCaptureRows, generalRows, sellerSections, summaryRows } from "../../src/modules/marketing/lead-capture-report";
import { MarketingLeadCapturePage } from "../../src/modules/marketing/MarketingLeadCapturePage";
import { installBrowserApiDoubles } from "../support/browser";
import { CAPTURE_DEMO_ROWS, captureCatalogs, captureResponse, captureUser, defaultCaptureFilters } from "./fixtures/capture-report";
import { selectMarketing } from "./marketing-select.helpers";

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
        render(<MarketingLeadCapturePage currentUser={captureUser} />);
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        expect(screen.getByRole("heading", { level: 1, name: "Captación de leads" })).toBeInTheDocument();
        expect(screen.getByText("Todos los vendedores")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /Leads por proyecto/ })).toBeInTheDocument();
        expect(screen.queryByRole("table", { name: "Leads por proyecto" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Ver desglose en tabla" }));
        expect(await screen.findByRole("table", { name: "Leads por proyecto" })).toBeInTheDocument();
        expect(screen.getByRole("figure", { name: /Leads por proyecto y vendedor/ })).toBeInTheDocument();
    });

    it("narrows the chart to the projects clicked in the table, and clears them", async () => {
        installBrowserApiDoubles();
        render(<MarketingLeadCapturePage currentUser={captureUser} />);
        fireEvent.click(await screen.findByRole("button", { name: "Ver desglose en tabla" }));
        const summary = await screen.findByRole("table", { name: "Leads por proyecto" });
        const chart = screen.getByRole("figure", { name: /Leads por proyecto y vendedor/ });
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
        render(<MarketingLeadCapturePage currentUser={captureUser} />);
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

    it("narrows to chosen sellers and to a shorter period", async () => {
        installBrowserApiDoubles();
        render(<MarketingLeadCapturePage currentUser={captureUser} />);
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        await selectMarketing("Vendedor", "Ana Solís");
        const legend = document.querySelector(".capture-columns-chart__legend") as HTMLElement;
        expect(within(legend).getAllByRole("img", { name: "Foto de Ana Solís", hidden: true }).length).toBeGreaterThan(0);
        expect(within(legend).queryByRole("img", { name: "Foto de Carlos Vega", hidden: true })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
        expect(screen.getByRole("button", { name: "Hoy" })).toHaveAttribute("aria-pressed", "true");
    });

    it("shows no money anywhere", async () => {
        installBrowserApiDoubles();
        render(<MarketingLeadCapturePage currentUser={captureUser} />);
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        expect(document.body.textContent).not.toMatch(/USD|\$|Valor|Inversión|Costo/);
    });

    it("shows each seller in the chart legend with their photo, looked up by public id", async () => {
        installBrowserApiDoubles();
        render(<MarketingLeadCapturePage currentUser={captureUser} />);
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        const legend = document.querySelector(".capture-columns-chart__legend") as HTMLElement;
        for (const name of ["Ana Solís", "Carlos Vega", "Diana Mora"]) {
            const photos = within(legend).getAllByRole("img", { name: `Foto de ${name}`, hidden: true });
            expect(photos.every((photo) => (photo.getAttribute("src") ?? "").includes("/vendedores/"))).toBe(true);
        }
    });

    it("switches what is counted without touching the depth, and shows the appointment columns", async () => {
        installBrowserApiDoubles();
        render(<MarketingLeadCapturePage currentUser={captureUser} />);
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
        render(<MarketingLeadCapturePage currentUser={captureUser} />);
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
        render(<MarketingLeadCapturePage currentUser={captureUser} />);
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
