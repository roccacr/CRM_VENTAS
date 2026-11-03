import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, expect, it } from "vitest";

import { CatalogBanners } from "../../src/modules/administration/catalogs/CatalogSummary";
import { buildOrderCards } from "../../src/modules/home/formalization-order-cards";
import { installBrowserApiDoubles } from "../support/browser";

beforeEach(installBrowserApiDoubles);
afterEach(cleanup);
const counts = { all: 189, approvals: 3, contracts: 186, send: 185, signature: 1, bank: 2, balance: 4, transfer: 5, signed: 6, closed: 7 };

it("explains each order card on focus using the same conditions as Home", async () => {
    const cards = buildOrderCards(counts);
    render(createElement(CatalogBanners, { cards, label: "Resumen de órdenes" }));
    for (const card of cards) expect(screen.getByRole("button", { name: `Condiciones de ${card.title}` })).toBeTruthy();
    fireEvent.focus(screen.getByRole("button", { name: "Condiciones de Formalizaciones cerradas este año" }));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("Unidad entregada y contrato firmado: sí");
    expect(tooltip.textContent).toContain("Cierre registrado este año");
    expect(tooltip.textContent).toContain("Cuotas, traspaso y llaves no condicionan el cierre");
    expect(cards.find((card) => card.id === "transfer")?.helpText).toContain("Llaves: cualquiera");
    expect(cards.find((card) => card.id === "signed")?.helpText).toContain("Entrega de llaves y Unidad entregada: no");
});
it("groups the contract subcounts once without duplicating their aggregate as another figure", () => {
    const cards = buildOrderCards(counts);
    expect(cards.map((card) => card.id)).toEqual(["all", "approvals", "addendum", "contracts", "bank", "balance", "transfer", "signed", "closed"]);
    expect(cards.find((card) => card.id === "contracts")?.metrics).toEqual([
        { label: "Por enviar", value: "185" },
        { label: "Pendientes de firma", value: "1" },
    ]);
    render(createElement(CatalogBanners, { cards, label: "Resumen de órdenes" }));
    expect(screen.getAllByRole("article")).toHaveLength(9);
    const contract = screen.getByRole("heading", { name: "Contratos pendientes" }).closest("article");
    if (!contract) throw new Error("Missing contract card");
    expect(within(contract).getByLabelText("Por enviar: 185")).toBeTruthy();
    expect(within(contract).getByLabelText("Pendientes de firma: 1")).toBeTruthy();
    expect(screen.queryByLabelText("Contratos pendientes: 186")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Por enviar" })).toBeNull();
});
it("keeps each figure unknown while loading rather than inventing zeroes", () => {
    const cards = buildOrderCards(null);
    expect(cards).toHaveLength(9);
    expect(cards.every((card) => card.value === "—")).toBe(true);
    expect(cards.find((card) => card.id === "contracts")?.metrics?.every((metric) => metric.value === "—")).toBe(true);
});
it("does not expose unauthorized stages or contract subcounts", () => {
    expect(buildOrderCards(counts, ["all", "bank"]).map((card) => card.id)).toEqual(["all", "bank"]);
    expect(buildOrderCards(counts, ["signature"])[0]?.metrics).toEqual([{ label: "Pendientes de firma", value: "1" }]);
});
it("shows the independently authorized addendum count without changing the other figures", () => {
    const cards = buildOrderCards({ ...counts, addendum: 5 }, ["all", "addendum"]);
    expect(cards.map((card) => [card.id, card.value])).toEqual([
        ["all", "189"],
        ["addendum", "5"],
    ]);
});

it("splits the bank queue into actual unstarted and in-progress counts", () => {
    expect(buildOrderCards({ ...counts, bank: 9, bankInProgress: 4 }).find((card) => card.id === "bank")?.metrics).toEqual([
        { label: "Sin iniciar", value: "5" },
        { label: "En proceso", value: "4" },
    ]);
});
