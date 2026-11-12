import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { CaptureColumnsChart } from "../../src/modules/marketing/CaptureColumnsChart";
import { EMPTY_VALUES, type PathRow } from "../../src/modules/marketing/lead-capture-report";
afterEach(cleanup);
const row = (key: string, value: number, leads = value): PathRow => ({ key, path: [key], value, detail: { ...EMPTY_VALUES, leads } });

it("keeps each dimension's color when catalog order changes", () => {
    const groups = [row("Proyecto Uno", 2), row("Proyecto Dos", 4)];
    const view = render(<CaptureColumnsChart groups={groups} label="Leads por proyecto" />);
    const color = screen.getByTitle("Proyecto Uno: 2").style.backgroundColor;
    view.rerender(<CaptureColumnsChart groups={[...groups].reverse()} label="Leads por proyecto" />);
    expect(screen.getByTitle("Proyecto Uno: 2").style.backgroundColor).toBe(color);
});
it("draws one total column per dimension with no seller segments or avatars", () => {
    const view = render(<CaptureColumnsChart groups={[row("Proyecto", 6)]} label="Leads por proyecto" />);
    expect(view.container.querySelectorAll(".capture-columns-chart__segment")).toHaveLength(1);
    expect(view.container.querySelector(".capture-columns-chart__stack-wrap > strong")).toHaveTextContent("6");
    expect(view.container.querySelector("img")).toBeNull();
});
it("uses the group's captured leads as the denominator for lost leads", async () => {
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
    const view = render(<CaptureColumnsChart groups={[row("Campaña", 5, 20)]} label="Perdidos por campaña" measure="lost" />);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Mostrar en el gráfico" }));
    fireEvent.click(await screen.findByTitle("% de los leads"));
    expect(view.container.querySelector(".capture-columns-chart__stack-wrap > strong")).toHaveTextContent("25 %");
});
it("orders totals from biggest to smallest and preserves relative heights", () => {
    const view = render(<CaptureColumnsChart groups={[row("Pequeño", 6), row("Grande", 16)]} label="Leads por proyecto" />);
    expect([...view.container.querySelectorAll(".capture-columns-chart__label")].map((x) => x.textContent)).toEqual(["Grande", "Pequeño"]);
    const [big, small] = [...view.container.querySelectorAll<HTMLElement>(".capture-columns-chart__stack-wrap")];
    expect(Number.parseFloat(big?.style.height ?? "0")).toBeGreaterThan(Number.parseFloat(small?.style.height ?? "0"));
});
it("calculates total percentages before applying the top limit and can reveal all groups", async () => {
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
    const view = render(<CaptureColumnsChart groups={[row("A", 3), row("B", 1)]} label="Leads por proyecto" defaultLimit={1} />);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Mostrar en el gráfico" }));
    fireEvent.click(await screen.findByTitle("% del total"));
    expect(view.container.querySelector(".capture-columns-chart__stack-wrap > strong")).toHaveTextContent("75 %");
    fireEvent.click(screen.getByRole("button", { name: "Ver las 1 columnas restantes" }));
    expect(view.container.querySelectorAll(".capture-columns-chart__group")).toHaveLength(2);
});

it("shows each loss reason's percentage of all lost leads", async () => {
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    );
    const view = render(<CaptureColumnsChart groups={[row("Presupuesto", 3), row("Sin motivo registrado", 1)]} label="Motivos de pérdida" measure="lossReasons" />);
    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Mostrar en el gráfico" }));
    fireEvent.click(await screen.findByTitle("% de los perdidos"));
    expect([...view.container.querySelectorAll(".capture-columns-chart__stack-wrap > strong")].map((x) => x.textContent)).toEqual(["75 %", "25 %"]);
});

it("keeps calendar order and zero intervals while using one project color", () => {
    const first = { ...row("jan", 2), path: ["ene 2026", "Proyecto"], colorKey: "project" };
    const empty = { ...row("feb", 0), path: ["feb 2026", "Proyecto"], colorKey: "project" };
    const last = { ...row("mar", 8), path: ["mar 2026", "Proyecto"], colorKey: "project" };
    const view = render(<CaptureColumnsChart groups={[first, empty, last]} label="Leads por mes" chronological />);
    expect([...view.container.querySelectorAll(".capture-columns-chart__stack-wrap > strong")].map((x) => x.textContent)).toEqual(["2", "0", "8"]);
    expect(view.container.querySelectorAll(".capture-columns-chart__segment")).toHaveLength(2);
    expect(view.container.querySelector(".capture-columns-chart__legend")).toBeNull();
    expect(screen.getByRole("heading", { name: "Proyecto" })).toBeInTheDocument();
});

it("keeps all periods together under one project heading", () => {
    const groups = [
        { ...row("jan-a", 2), path: ["ene 2026", "Proyecto A"], colorKey: "a" },
        { ...row("jan-b", 4), path: ["ene 2026", "Proyecto B"], colorKey: "b" },
        { ...row("feb-a", 3), path: ["feb 2026", "Proyecto A"], colorKey: "a" },
        { ...row("feb-b", 0), path: ["feb 2026", "Proyecto B"], colorKey: "b" },
    ];
    render(<CaptureColumnsChart groups={groups} label="Comparación" chronological />);
    const project = screen.getByRole("group", { name: "Proyecto A" });
    expect(project.querySelectorAll(".capture-columns-chart__group")).toHaveLength(2);
    expect(project).toHaveTextContent("ene 2026");
    expect(project).toHaveTextContent("feb 2026");
});
