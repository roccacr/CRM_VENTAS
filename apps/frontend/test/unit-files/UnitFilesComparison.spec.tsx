import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { UnitDetail } from "../../src/modules/administration/unit-files/unit-files.api";
import { UnitFilesComparison } from "../../src/modules/administration/unit-files/UnitFilesComparison";

const makeUnit = (id: string, price: string | null, area: string | null): UnitDetail => ({
    id,
    code: id,
    nativeCode: null,
    legacyId: null,
    project: { id: "project", name: "Amara" },
    housingType: "A",
    status: "available",
    sourceStatus: "Disponible",
    advertisedSalePrice: price,
    habitableArea: null,
    estimatedDelivery: null,
    totalArea: area,
    lotArea: null,
    approximateParkingArea: null,
    updatedAt: null,
    sourceMetadata: { projectReference: null },
    externalReferences: [],
    values: { advertisedSalePrice: price, totalArea: area, housingType: "A", minimumSalePrice: "invalid", code: id },
});
const labels = { advertisedSalePrice: "Precio anunciado", totalArea: "Área total", housingType: "Tipo de vivienda", minimumSalePrice: "Precio mínimo", code: "Unidad" };
const groups = [
    { title: "Información", fields: ["code", "housingType"] },
    { title: "Precios", fields: ["advertisedSalePrice", "minimumSalePrice"] },
    { title: "Áreas", fields: ["totalArea"] },
];

describe("Unit Files visual comparison", () => {
    afterEach(cleanup);
    beforeEach(() => {
        vi.stubGlobal(
            "ResizeObserver",
            class {
                observe() {}
                unobserve() {}
                disconnect() {}
            },
        );
    });
    it("shows numeric ranking and reference deltas without inventing currency", () => {
        render(<UnitFilesComparison items={[makeUnit("AM-1", "352,750.00", "167.0"), makeUnit("AM-2", "351,000.00", "184.0")]} labels={labels} groups={groups} />);
        const row = screen.getByRole("rowheader", { name: "Precio anunciado" }).closest("tr");
        if (!row) throw new Error("Missing price comparison row");
        expect(within(row).getByText("352,750.00").closest("td")).toHaveAttribute("data-rank", "worst");
        expect(within(row).getByText("351,000.00").closest("td")).toHaveAttribute("data-rank", "best");
        expect(within(row).getByLabelText("Valor mayor")).toBeInTheDocument();
        expect(within(row).getByLabelText("Valor menor")).toBeInTheDocument();
        expect(screen.getByText("184.0").closest("td")).toHaveAttribute("data-rank", "best");
        expect(within(row).getByText(/−1.*750/)).toBeInTheDocument();
        expect(row.textContent).not.toContain("$");
        expect(screen.getAllByRole("rowheader")).toHaveLength(Object.keys(labels).length);
    });
    it("keeps absent and ambiguous numeric values out of ranking, and can hide matching fields", () => {
        render(<UnitFilesComparison items={[makeUnit("AM-1", null, "1,5"), makeUnit("AM-2", "100", "1.5")]} labels={labels} groups={groups} />);
        const row = screen.getByRole("rowheader", { name: "Precio anunciado" }).closest("tr");
        if (!row) throw new Error("Missing price comparison row");
        expect(within(row).getByText("Sin asignar")).toBeInTheDocument();
        expect(row.querySelector("[data-rank]")).toBeNull();
        expect(within(row).queryByRole("img")).not.toBeInTheDocument();
        const areaRow = screen.getByRole("rowheader", { name: "Área total" }).closest("tr");
        if (!areaRow) throw new Error("Missing area comparison row");
        expect(areaRow.querySelector("[data-rank]")).toBeNull();
        expect(within(areaRow).queryByRole("img")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("switch", { name: "Solo diferencias" }));
        expect(screen.queryByRole("rowheader", { name: "Tipo de vivienda" })).not.toBeInTheDocument();
        expect(screen.getByRole("rowheader", { name: "Área total" })).toBeInTheDocument();
    });
    it("changes the reference and recalculates signed differences without fetching", async () => {
        render(<UnitFilesComparison items={[makeUnit("AM-1", "352,750.00", "167.0"), makeUnit("AM-2", "351,000.00", "184.0")]} labels={labels} groups={groups} />);
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Unidad de referencia" }));
        fireEvent.click(await screen.findByText("AM-2", { selector: ".ant-select-item-option-content" }));
        expect(await screen.findByText(/\+1.*750.*vs\. referencia/)).toBeInTheDocument();
    });
    it("never rounds a nonzero numeric difference to zero", () => {
        render(<UnitFilesComparison items={[makeUnit("AM-1", "1.000", "0"), makeUnit("AM-2", "1.001", "0.00000001")]} labels={labels} groups={groups} />);
        expect(screen.getByText("+0,001 vs. referencia")).toBeInTheDocument();
        expect(screen.getByText("+<0,000001 vs. referencia")).toBeInTheDocument();
    });
    it("ranks intermediate values and gives tied values the same preference", () => {
        render(<UnitFilesComparison items={[makeUnit("AM-1", "100", "10"), makeUnit("AM-2", "200", "20"), makeUnit("AM-3", "300", "30"), makeUnit("AM-4", "100", null)]} labels={labels} groups={groups} />);
        const row = screen.getByRole("rowheader", { name: "Precio anunciado" }).closest("tr");
        if (!row) throw new Error("Missing price comparison row");
        for (const value of within(row).getAllByText("100")) expect(value.closest("td")).toHaveAttribute("data-rank", "best");
        expect(within(row).getByText("200").closest("td")).toHaveAttribute("data-rank", "middle");
        expect(within(row).getByText("300").closest("td")).toHaveAttribute("data-rank", "worst");
        expect(screen.getByText("10").closest("td")).toHaveAttribute("data-rank", "worst");
        expect(screen.getByText("30").closest("td")).toHaveAttribute("data-rank", "best");
    });
    it("leaves equal metrics neutral", () => {
        const { container } = render(<UnitFilesComparison items={[makeUnit("AM-1", "100", "0"), makeUnit("AM-2", "100.0", "0")]} labels={labels} groups={groups} />);
        expect(container.querySelector("[data-rank]")).toBeNull();
    });
});
