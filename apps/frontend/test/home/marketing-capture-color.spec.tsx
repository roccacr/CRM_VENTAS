import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { CaptureColumnsChart } from "../../src/modules/marketing/CaptureColumnsChart";
import { captureCatalogs } from "./fixtures/capture-report";
afterEach(cleanup);

it("keeps each seller's color when filters or catalog order change", () => {
    const all = captureCatalogs.sellers;
    const group = { key: "p", label: "Proyecto", path: ["Proyecto"], values: [2, 3, 4] };
    const groups = [group];
    const view = render(<CaptureColumnsChart sellers={all} groups={groups} label="Comparación" />);
    const bar = screen.getByTitle("Ana Solís: 2").querySelector("i");
    const color = bar?.style.backgroundColor;
    expect(color).toBeTruthy();
    const second = screen.getByTitle("Carlos Vega: 3").querySelector("i")?.style.backgroundColor;
    expect(second).not.toBe(color);
    view.rerender(<CaptureColumnsChart sellers={[...all].reverse()} groups={[{ ...group, values: [4, 3, 2] }]} label="Comparación" />);
    expect(screen.getByTitle("Ana Solís: 2").querySelector("i")?.style.backgroundColor).toBe(color);
    view.rerender(<CaptureColumnsChart sellers={all.filter((seller) => seller.id === "carlos")} groups={[{ ...group, values: [3] }]} label="Comparación" />);
    expect(screen.getByTitle("Carlos Vega: 3").querySelector("i")?.style.backgroundColor).toBe(second);
});

it("stacks the sellers of a project into one column with the total above, and keeps them side by side otherwise", () => {
    const groups = [{ key: "p", label: "Proyecto", path: ["Proyecto"], values: [2, 0, 4] }];
    const view = render(<CaptureColumnsChart sellers={captureCatalogs.sellers} groups={groups} label="Comparación" stacked />);
    expect(view.container.querySelectorAll(".capture-columns-chart__stack")).toHaveLength(1);
    expect(view.container.querySelectorAll(".capture-columns-chart__segment")).toHaveLength(2);
    expect(screen.getByText("6")).toBeInTheDocument();
    view.rerender(<CaptureColumnsChart sellers={captureCatalogs.sellers} groups={groups} label="Comparación" />);
    expect(view.container.querySelectorAll(".capture-columns-chart__stack")).toHaveLength(0);
    expect(view.container.querySelectorAll(".capture-columns-chart__bar")).toHaveLength(2);
});

it("switches the chart between counts and the share of each group's leads", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
    const groups = [{ key: "p", label: "Proyecto", path: ["Proyecto"], values: [2, 0, 3], leads: [10, 0, 10] }];
    const view = render(<CaptureColumnsChart sellers={captureCatalogs.sellers} groups={groups} label="Comparación" measure="lost" stacked />);
    expect(view.container.querySelector(".capture-columns-chart__stack-wrap > strong")).toHaveTextContent("5");
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Mostrar en el gráfico" }));
    fireEvent.click(await screen.findByTitle("% de los leads"));
    expect(view.container.querySelector(".capture-columns-chart__stack-wrap > strong")).toHaveTextContent("25 %");
    const parts = [...view.container.querySelectorAll(".capture-columns-chart__segment")].map((node) => node.textContent);
    expect(parts).toEqual(["10 %", "15 %"]);
});

it("orders the columns from biggest to smallest and never draws a bigger figure shorter than a smaller one", () => {
    const sellers = captureCatalogs.sellers;
    const groups = [
        { key: "small", label: "Pequeño", path: ["Pequeño"], values: [2, 1, 3] },
        { key: "big", label: "Grande", path: ["Grande"], values: [9, 7, 0] },
    ];
    const view = render(<CaptureColumnsChart sellers={sellers} groups={groups} label="Comparación" stacked />);
    const names = [...view.container.querySelectorAll(".capture-columns-chart__label")].map((node) => node.textContent);
    expect(names).toEqual(["Grande", "Pequeño"]);
    const ratio = (node: Element) => Number.parseFloat((node as HTMLElement).style.height);
    const [big, small] = [...view.container.querySelectorAll(".capture-columns-chart__stack-wrap")];
    expect(ratio(big as Element)).toBeGreaterThan(ratio(small as Element));
});

it("keeps the biggest sellers apart and sums the rest into one 'Otros' series when there are too many to tell apart", () => {
    const many = Array.from({ length: 12 }, (_, index) => ({ id: `s${String(index)}`, name: `Vendedor ${String(index)}`, publicId: null }));
    const groups = [{ key: "p", label: "P", path: ["P"], values: many.map((_, index) => index + 1) }];
    const view = render(<CaptureColumnsChart sellers={many} groups={groups} label="Comparación" stacked />);
    expect(view.container.querySelectorAll(".capture-columns-chart__legend li")).toHaveLength(8);
    expect(screen.getByText("Otros (5)")).toBeInTheDocument();
    expect(view.container.querySelector(".capture-columns-chart__stack-wrap > strong")).toHaveTextContent("78");
});
