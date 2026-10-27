import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MarketingLeadCapturePage } from "../../src/modules/marketing/MarketingLeadCapturePage";
import { installBrowserApiDoubles } from "../support/browser";
import { captureResponse, captureUser } from "./fixtures/capture-report";
import { selectMarketing } from "./marketing-select.helpers";

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

describe("connected capture report", () => {
    it("requests week and hides the previous month when returning to it before the new response", async () => {
        const week = deferred(),
            month = deferred();
        api.request.mockResolvedValueOnce(captureResponse()).mockReturnValueOnce(week.promise).mockReturnValueOnce(month.promise);
        open();
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        fireEvent.click(screen.getByRole("button", { name: "Semana" }));
        expect(api.request).toHaveBeenLastCalledWith("/marketing/leads/report?period=week");
        fireEvent.click(screen.getByRole("button", { name: "Mes" }));
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
        await act(async () => {
            week.reject(new Error("old failure"));
            await week.promise.catch(() => undefined);
        });
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toBeInTheDocument();
        await act(async () => {
            month.resolve(captureResponse());
            await month.promise;
        });
        expect(await screen.findByRole("button", { name: "Ver desglose en tabla" })).toBeInTheDocument();
    });
    it("keeps a selected seller scope empty when that seller has no rows in the next period", async () => {
        const response = captureResponse();
        const rows = response.rows.filter((row) => row.date === response.today && row.sellerId === "carlos");
        api.request.mockResolvedValueOnce(response).mockResolvedValueOnce({ ...response, period: "day", range: { start: response.today, end: response.today }, sellers: response.sellers.filter((seller) => seller.id === "carlos"), rows, sources: { ...response.sources, legacy: rows.reduce((sum, row) => sum + row.leads, 0) } });
        open();
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        await selectMarketing("Vendedor", "Ana Solís");
        fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        expect(screen.getByText("Ana Solís")).toBeInTheDocument();
        const legend = document.querySelector(".capture-columns-chart__legend") as HTMLElement;
        expect(within(legend).queryByText("Carlos Vega")).not.toBeInTheDocument();
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
        fireEvent.click(screen.getByRole("button", { name: "Año" }));
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
        expect(screen.getByRole("button", { name: "Año" })).toHaveAttribute("aria-pressed", "true");
    });
    it("clears previous counters on a failed switch and never restores them", async () => {
        const day = deferred();
        api.request.mockResolvedValueOnce(captureResponse()).mockReturnValueOnce(day.promise);
        open();
        await screen.findByRole("button", { name: "Ver desglose en tabla" });
        fireEvent.click(screen.getByRole("button", { name: "Hoy" }));
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
        const legend = document.querySelector(".capture-columns-chart__legend") as HTMLElement;
        expect(within(legend).getByText("Real ana")).toBeInTheDocument();
        expect(legend.querySelector('img[src*="/vendedores/"]')).toBeNull();
        expect(legend.querySelector('img[src*="rocca-marketing-generated.png"]')).not.toBeNull();
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
