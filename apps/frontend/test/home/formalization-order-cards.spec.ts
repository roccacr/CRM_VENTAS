import { cleanup, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, expect, it } from "vitest";

import { CatalogBanners } from "../../src/modules/administration/catalogs/CatalogSummary";
import { buildOrderCards } from "../../src/modules/home/formalization-order-cards";

afterEach(cleanup);
const counts = { all: 189, approvals: 3, contracts: 186, send: 185, signature: 1, bank: 2, balance: 4, transfer: 5, signed: 6, closed: 7 };
it("groups the contract subcounts once without duplicating their aggregate as another figure", () => {
    const cards = buildOrderCards(counts);
    expect(cards.map((card) => card.id)).toEqual(["all", "approvals", "contracts", "bank", "balance", "transfer", "signed", "closed"]);
    expect(cards.find((card) => card.id === "contracts")?.metrics).toEqual([
        { label: "Por enviar", value: "185" },
        { label: "Pendientes de firma", value: "1" },
    ]);
    render(createElement(CatalogBanners, { cards, label: "Resumen de órdenes" }));
    expect(screen.getAllByRole("article")).toHaveLength(8);
    const contract = screen.getByRole("heading", { name: "Contratos pendientes" }).closest("article");
    if (!contract) throw new Error("Missing contract card");
    expect(within(contract).getByLabelText("Por enviar: 185")).toBeTruthy();
    expect(within(contract).getByLabelText("Pendientes de firma: 1")).toBeTruthy();
    expect(screen.queryByLabelText("Contratos pendientes: 186")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Por enviar" })).toBeNull();
});
it("keeps each figure unknown while loading rather than inventing zeroes", () => {
    const cards = buildOrderCards(null);
    expect(cards).toHaveLength(8);
    expect(cards.every((card) => card.value === "—")).toBe(true);
    expect(cards.find((card) => card.id === "contracts")?.metrics?.every((metric) => metric.value === "—")).toBe(true);
});
it("does not expose unauthorized stages or contract subcounts", () => {
    expect(buildOrderCards(counts, ["all", "bank"]).map((card) => card.id)).toEqual(["all", "bank"]);
    expect(buildOrderCards(counts, ["signature"])[0]?.metrics).toEqual([{ label: "Pendientes de firma", value: "1" }]);
});
