import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarketingLeadCapturePage } from "../../src/modules/marketing/MarketingLeadCapturePage";
import { installBrowserApiDoubles } from "../support/browser";
import { captureResponse, captureUser } from "./fixtures/capture-report";

const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: api.request }));
beforeEach(() => {
    installBrowserApiDoubles();
    api.request.mockReset();
});
afterEach(cleanup);
const deferred = () => {
    let resolve!: (value: unknown) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<unknown>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
};
const open = () => render(<MarketingLeadCapturePage currentUser={captureUser} />);

it.each(["mercadeo", "jefe_mercadeo"])("keeps all returned sellers for a %s identity", async (roleCode) => {
    const response = captureResponse();
    api.request.mockResolvedValue(response);
    render(<MarketingLeadCapturePage currentUser={{ ...captureUser, publicId: `${roleCode}-user` }} />);
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    const total = response.rows.filter((row) => row.date >= "2026-10-01" && row.date <= response.today).reduce((sum, row) => sum + row.leads, 0);
    expect(document.querySelector(".capture-block__aside")).toHaveTextContent(`${new Intl.NumberFormat("es-CR").format(total).replace(/\s/gu, " ")} leads`);
    expect(api.request).toHaveBeenCalledWith("/marketing/leads/report?period=month");
    expect(screen.queryByRole("combobox", { name: "Vendedor" })).not.toBeInTheDocument();
});

describe("connected capture report", () => {
    it("applies week and keeps it visible while editing a return to month", async () => {
        const week = deferred(),
            month = deferred();
        api.request.mockResolvedValueOnce(captureResponse()).mockReturnValueOnce(week.promise).mockReturnValueOnce(month.promise);
        open();
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        fireEvent.change(screen.getByRole("combobox", { name: "Periodo" }), { target: { value: "week" } });
        fireEvent.click(screen.getByRole("button", { name: "Aplicar filtro" }));
        expect(api.request).toHaveBeenLastCalledWith("/marketing/leads/report?period=week");
        await act(async () => {
            week.resolve({ ...captureResponse(), period: "week" });
            await week.promise;
        });
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        fireEvent.change(screen.getByRole("combobox", { name: "Periodo" }), { target: { value: "month" } });
        expect(screen.getByRole("figure", { name: "Leads por proyecto · por semana" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Aplicar filtro" }));
        expect(screen.queryByRole("figure")).not.toBeInTheDocument();
        await act(async () => {
            month.resolve(captureResponse());
            await month.promise;
        });
        expect(await screen.findByRole("figure", { name: "Leads por proyecto · por mes" })).toBeInTheDocument();
    });
    it("shows the authorized sellers returned for the next period without a seller filter", async () => {
        const response = captureResponse();
        const rows = response.rows.filter((row) => row.date === response.today && row.sellerId === "carlos");
        api.request.mockResolvedValueOnce(response).mockResolvedValueOnce({ ...response, period: "day", range: { start: response.today, end: response.today }, sellers: response.sellers.filter((seller) => seller.id === "carlos"), rows, sources: { ...response.sources, legacy: rows.reduce((sum, row) => sum + row.leads, 0) } });
        open();
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        expect(screen.queryByRole("combobox", { name: "Vendedor" })).not.toBeInTheDocument();
        fireEvent.change(screen.getByRole("combobox", { name: "Periodo" }), { target: { value: "day" } });
        fireEvent.click(screen.getByRole("button", { name: "Aplicar filtro" }));
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        expect(screen.queryByRole("combobox", { name: "Vendedor" })).not.toBeInTheDocument();
        expect(document.querySelector(".capture-columns-chart__legend")).toBeNull();
        expect(screen.getByRole("figure").querySelector("img")).toBeNull();
    });
    it("starts on month and keeps counters and downloads hidden while loading", () => {
        api.request.mockReturnValue(new Promise(() => {}));
        open();
        expect(screen.getByRole("status")).toHaveTextContent("Cargando reporte");
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Descargar/ })).toBeDisabled();
        expect(api.request).toHaveBeenCalledWith("/marketing/leads/report?period=month");
        expect(screen.queryByText(/demostración/)).not.toBeInTheDocument();
    });
    it("shows error and retries without presenting zero or fixture counters", async () => {
        api.request.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(captureResponse());
        open();
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar");
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
        expect(await screen.findByRole("button", { name: "Ver desglose en tabla" })).toBeInTheDocument();
    });
    it("uses the API range and coverage for all, and ignores an older period response", async () => {
        const month = deferred(),
            all = deferred();
        api.request.mockReturnValueOnce(month.promise).mockReturnValueOnce(all.promise);
        open();
        await act(async () => {
            month.resolve(captureResponse());
            await month.promise;
        });
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        fireEvent.change(screen.getByRole("combobox", { name: "Periodo" }), { target: { value: "year" } });
        fireEvent.click(screen.getByRole("button", { name: "Aplicar filtro" }));
        expect(api.request).toHaveBeenLastCalledWith("/marketing/leads/report?period=all");
        const response = { ...captureResponse(), period: "all", today: "2027-01-05", range: { start: "2020-02-03", end: "2027-01-05" }, coverage: { start: "2020-02-03", end: "2027-01-05" } };
        await act(async () => {
            all.resolve(response);
            await all.promise;
        });
        expect(await screen.findByRole("button", { name: "Ver desglose en tabla" })).toBeInTheDocument();
        expect(screen.getByText(/1 ene/)).toBeInTheDocument();
        await act(async () => {
            month.resolve(captureResponse());
            await month.promise;
        });
        expect(screen.getByText(/1 ene/)).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "Periodo" })).toHaveValue("year");
    });
    it("clears previous counters on a failed switch and never restores them", async () => {
        const day = deferred();
        api.request.mockResolvedValueOnce(captureResponse()).mockReturnValueOnce(day.promise);
        open();
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        fireEvent.change(screen.getByRole("combobox", { name: "Periodo" }), { target: { value: "day" } });
        fireEvent.click(screen.getByRole("button", { name: "Aplicar filtro" }));
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        await act(async () => {
            day.reject(new Error("failed"));
            await day.promise.catch(() => undefined);
        });
        expect(await screen.findByRole("alert")).toBeInTheDocument();
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
    it("shows API catalogs, preserves nullable publicIds and explains incomplete source data", async () => {
        const response = captureResponse();
        api.request.mockResolvedValue({ ...response, sellers: response.sellers.map((s) => ({ ...s, name: `Real ${s.id}`, publicId: null })), projects: response.projects.map((p) => ({ ...p, name: `Real ${p.id}` })), quality: { ...response.quality, unresolvedSellers: 3, unclassifiedAppointments: 2 } });
        open();
        fireEvent.click(await screen.findByRole("button", { name: "Ver desglose en tabla" }));
        const table = await screen.findByRole("table", { name: "Leads por proyecto" });
        expect(within(table).getAllByText("Real horizonte")[0]).toBeInTheDocument();
        const chart = screen.getByRole("figure");
        expect(within(chart).getByRole("heading", { name: "Real horizonte" })).toBeInTheDocument();
        expect(document.querySelector(".capture-columns-chart__legend")).toBeNull();
        expect(chart.querySelector("img")).toBeNull();
        expect(screen.getByRole("note")).toHaveTextContent("3");
        expect(screen.queryByText("Ana Solís")).not.toBeInTheDocument();
    });
    it("invalidates report data when the signed-in identity changes", async () => {
        const next = deferred();
        api.request.mockResolvedValueOnce(captureResponse()).mockReturnValueOnce(next.promise);
        const view = open();
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        view.rerender(<MarketingLeadCapturePage currentUser={{ ...captureUser, publicId: "another-user" }} />);
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toBeInTheDocument();
    });
    it("invalidates the same user's report when permissions are refreshed", async () => {
        api.request.mockResolvedValueOnce(captureResponse()).mockReturnValueOnce(new Promise(() => {}));
        const view = open();
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        view.rerender(<MarketingLeadCapturePage currentUser={{ ...captureUser, permissionVersion: 2 }} />);
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toBeInTheDocument();
    });
});

it("keeps a period change in draft until Apply is pressed", async () => {
    api.request.mockResolvedValue(captureResponse());
    open();
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    fireEvent.change(screen.getByRole("combobox", { name: "Periodo" }), { target: { value: "week" } });
    expect(api.request).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("figure", { name: "Leads por proyecto · por mes" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtro" }));
    expect(api.request).toHaveBeenLastCalledWith("/marketing/leads/report?period=week");
});
it("keeps the newest qualification response and preserves measure and depth", async () => {
    const qualified = deferred(),
        unqualified = deferred();
    api.request.mockResolvedValueOnce(captureResponse()).mockReturnValueOnce(qualified.promise).mockReturnValueOnce(unqualified.promise);
    open();
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    fireEvent.click(screen.getByRole("button", { name: "Leads con cita" }));
    fireEvent.click(screen.getByRole("button", { name: "Proyecto › Campaña" }));
    const choose = async (name: string) => {
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Filtrar por calificación" }));
        fireEvent.click(await screen.findByRole("option", { name }));
    };
    await choose("Calificado");
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
    await choose("No calificado");
    await act(async () => {
        unqualified.resolve({ ...captureResponse(), qualification: "unqualified" });
        await unqualified.promise;
    });
    expect(await screen.findByRole("figure", { name: "Leads con cita por proyecto y campaña · por mes" })).toBeInTheDocument();
    await act(async () => {
        qualified.resolve({ ...captureResponse(), qualification: "qualified" });
        await qualified.promise;
    });
    expect(screen.getByRole("combobox", { name: "Filtrar por calificación" })).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "Leads con cita por proyecto y campaña · por mes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leads con cita" })).toHaveAttribute("aria-pressed", "true");
});

it.each(["Leads con cita", "Leads perdidos", "Motivos de p\u00e9rdida"])("preserves projects and period when filtering %s", async (measure) => {
    api.request.mockResolvedValueOnce(captureResponse()).mockResolvedValueOnce({ ...captureResponse(), qualification: "qualified" });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Ver desglose en tabla" }));
    const table = await screen.findByRole("table", { name: "Leads por proyecto" });
    fireEvent.click(within(table).getByRole("button", { name: "Proyecto Roble" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Qu\u00e9 medir" })).getByRole("button", { name: measure }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Filtrar por calificaci\u00f3n" }));
    fireEvent.click(await screen.findByRole("option", { name: "Calificado" }));
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    expect(screen.getByRole("combobox", { name: "Periodo" })).toHaveValue("month");
    expect(within(screen.getByRole("group", { name: "Qu\u00e9 medir" })).getByRole("button", { name: measure })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1 proyecto")).toBeInTheDocument();
    expect(api.request).toHaveBeenLastCalledWith("/marketing/leads/report?period=month&qualification=qualified");
});
it("keeps an empty project intersection instead of widening to other projects", async () => {
    const response = captureResponse();
    const rows = response.rows.filter((row) => row.projectId !== "roble");
    api.request.mockResolvedValueOnce(response).mockResolvedValueOnce({ ...response, qualification: "qualified", rows, sources: { ...response.sources, legacy: rows.reduce((sum, row) => sum + row.leads, 0) } });
    open();
    fireEvent.click(await screen.findByRole("button", { name: "Ver desglose en tabla" }));
    fireEvent.click(within(await screen.findByRole("table", { name: "Leads por proyecto" })).getByRole("button", { name: "Proyecto Roble" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Filtrar por calificaci\u00f3n" }));
    fireEvent.click(await screen.findByRole("option", { name: "Calificado" }));
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    expect(screen.getByText("1 proyecto")).toBeInTheDocument();
    expect(document.querySelector(".capture-block__aside")).toHaveTextContent("0 leads");
    fireEvent.click(screen.getByRole("button", { name: "Quitar selecci\u00f3n" }));
    expect(document.querySelector(".capture-block__aside")).not.toHaveTextContent(/^0 leads$/);
});

it("adds Reserva o pre-reserva and uses its count in charts and tables", async () => {
    const response = captureResponse();
    const rows = response.rows.map((row) => ({ ...row, withReservation: Math.min(1, row.leads) }));
    api.request.mockResolvedValue({ ...response, rows });
    open();
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    fireEvent.click(screen.getByRole("button", { name: "Reserva o pre-reserva" }));
    expect(screen.getByRole("button", { name: "Reserva o pre-reserva" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("heading", { name: /Reserva o pre-reserva por proyecto/ })).toBeInTheDocument();
    const expected = rows.filter((row) => row.date >= response.range.start && row.date <= response.today).reduce((sum, row) => sum + row.withReservation, 0);
    const indicators = within(screen.getByRole("list", { name: "Indicadores del periodo" })).getAllByRole("listitem");
    expect(within(indicators[0] as HTMLElement).getByText(String(expected))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver desglose en tabla" }));
    expect(await screen.findByRole("columnheader", { name: "Con reserva o pre-reserva" })).toBeInTheDocument();
    expect(api.request).toHaveBeenCalledTimes(1);
});

it("keeps reservations unavailable when an older API omits the metric", async () => {
    api.request.mockResolvedValue(captureResponse());
    open();
    await screen.findByRole("button", { name: "Ver desglose en tabla" });
    expect(screen.getByRole("button", { name: "Reserva o pre-reserva" })).toBeDisabled();
});
