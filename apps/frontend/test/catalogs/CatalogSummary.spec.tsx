import "@testing-library/jest-dom/vitest";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildCatalogItemCards, buildUnitFileCards, buildUserCards } from "../../src/modules/administration/catalogs/catalog-summary";
import { CatalogBanners } from "../../src/modules/administration/catalogs/CatalogSummary";
import type { CatalogItem } from "../../src/services/catalogs/catalog-service";

afterEach(cleanup);

const item = (publicId: string, status: CatalogItem["status"], externalIds: readonly string[] = []): CatalogItem => ({
    publicId,
    nativeCode: `native_${publicId}`,
    name: publicId,
    detail: null,
    status,
    updatedAt: "2026-10-08T12:00:00.000Z",
    externalReferences: externalIds.map((externalId) => ({ externalId, status: "active", systemCode: "netsuite", systemName: "NetSuite" })),
});
const values = (cards: ReturnType<typeof buildCatalogItemCards>) => Object.fromEntries(cards.map((card) => [card.id, card.value]));

describe("Catalog summary cards", () => {
    const items = [item("a", "active", ["1"]), item("b", "active"), item("c", "inactive", ["3"]), item("d", "active", ["  "])];

    it("counts active, inactive and integrated rows against the API total", () => {
        const cards = buildCatalogItemCards({ label: "Proyectos", items, total: 4, ready: true });
        expect(values(cards)).toEqual({ total: "4", active: "3", inactive: "1", linked: "2" });
        expect(cards[0]?.title).toBe("Total de proyectos");
        expect(cards.map((card) => card.caption).join(" ")).not.toMatch(/En esta página/);
    });

    it("says so when only part of the list is loaded, and keeps the real total", () => {
        const cards = buildCatalogItemCards({ label: "Clases", items, total: 250, ready: true });
        expect(values(cards).total).toBe("250");
        for (const card of cards.slice(1)) expect(card.caption).toBe("En esta página (4 de 250)");
    });

    it("shows a dash, never zero, while loading or after a failed load", () => {
        const cards = buildCatalogItemCards({ label: "Clases", items: [], total: 0, ready: false });
        expect(Object.values(values(cards))).toEqual(["—", "—", "—", "—"]);
    });

    it("shows a real zero for an empty catalog that loaded fine", () => {
        expect(Object.values(values(buildCatalogItemCards({ label: "Clases", items: [], total: 0, ready: true })))).toEqual(["0", "0", "0", "0"]);
    });

    it("uses the label of whichever catalog opens it, not a fixed area", () => {
        for (const label of ["Campañas", "Corredores", "Subsidiarias", "Ubicaciones"]) expect(buildCatalogItemCards({ label, items, total: 4, ready: true })[0]?.title).toBe(`Total de ${label.toLocaleLowerCase("es-CR")}`);
    });

    it("describes the unit-file search before and after a search", () => {
        const before = buildUnitFileCards({ projects: 12, loaded: 0, selected: 0, hasSearched: false });
        expect(before.map((card) => card.value)).toEqual(["12", "—", "0"]);
        const after = buildUnitFileCards({ projects: 12, loaded: 50, selected: 3, hasSearched: true });
        expect(after.map((card) => card.value)).toEqual(["12", "50", "3"]);
    });
});

describe("User directory cards", () => {
    const summary = { all: 5, active: 3, pending: 1, blocked: 1, inactive: 0 };

    it("shows the directory-wide counts from the API by status", () => {
        const cards = buildUserCards({ summary, ready: true });
        expect(cards.map((card) => [card.id, card.value])).toEqual([
            ["all", "5"],
            ["active", "3"],
            ["pending", "1"],
            ["blocked", "1"],
            ["inactive", "0"],
        ]);
        expect(cards.find((card) => card.id === "blocked")?.tone).toBe("danger");
    });

    it("shows a dash instead of zero until the directory has answered", () => {
        expect(buildUserCards({ summary: { all: 0, active: 0, pending: 0, blocked: 0, inactive: 0 }, ready: false }).every((card) => card.value === "—")).toBe(true);
    });
});

describe("CatalogBanners", () => {
    it("renders one labelled card per figure with an accessible name", () => {
        render(<CatalogBanners label="Resumen de Proyectos" cards={buildCatalogItemCards({ label: "Proyectos", items: [item("a", "active")], total: 1, ready: true })} />);
        expect(screen.getByRole("region", { name: "Resumen de Proyectos" })).toBeInTheDocument();
        expect(screen.getAllByRole("article")).toHaveLength(4);
        expect(screen.getByLabelText("Total de proyectos: 1")).toBeInTheDocument();
        expect(screen.getByLabelText("Activos: 1")).toBeInTheDocument();
        expect(screen.getByLabelText("Inactivos: 0")).toBeInTheDocument();
    });
});
