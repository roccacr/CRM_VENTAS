import { beforeEach, expect, it, vi } from "vitest";

import { type DatabaseOrderResult, getDatabaseOrder } from "../../src/services/formalization/database-order-service";
import { getOrderUnitDetail } from "../../src/services/formalization/order-unit-service";

vi.mock("../../src/services/formalization/database-order-service", () => ({ getDatabaseOrder: vi.fn() }));
const snapshot = (source: "native" | "legacy", sourceFields: Record<string, unknown>): DatabaseOrderResult => ({ schemaVersion: 1, observedAt: "2026-10-27T00:00:00Z", source, order: {}, contact: null, lead: null, unitFile: { id: "unit", code: "A-1", sourceFields }, references: [], warnings: [] });
beforeEach(() => vi.resetAllMocks());
it.each(["native", "legacy"] as const)("maps the %s allowlist without inventing currency, area units or status meaning", async (source) => {
    const values = source === "native" ? { project_name_snapshot_unit_file: "Proyecto real", source_status_unit_file: 2, advertised_sale_price_unit_file: "00123.4500", lot_area_unit_file: "90.00", unit_plans_unit_file: "<iframe src='https://example.com' />" } : { proyectoPrincipal_exp: "Proyecto real", estado_exp: 2, precioVentaUncio_exp: "00123.4500", loteM2_exp: "90.00", planosDeUnidad_exp: "<iframe src='https://example.com' />" };
    vi.mocked(getDatabaseOrder).mockResolvedValue(snapshot(source, values));
    const result = await getOrderUnitDetail({ source, id: "order" });
    const fields = result.groups.flatMap((group) => group.fields);
    expect(fields).toContainEqual({ label: "Proyecto", value: "Proyecto real" });
    expect(fields).toContainEqual({ label: "Estado en origen (sin equivalencia confirmada)", value: "2" });
    expect(fields).toContainEqual({ label: "Precio de venta anunciado (moneda no informada)", value: "00123.4500" });
    expect(fields).toContainEqual({ label: "Área del lote (unidad no informada)", value: "90.00" });
    expect(fields.some((field) => field.value.includes("USD"))).toBe(false);
    expect(fields).toHaveLength(source === "native" ? 35 : 30);
});
it("does not use a project id as its name and ignores unapproved fields", async () => {
    vi.mocked(getDatabaseOrder).mockResolvedValue(snapshot("native", { project_id_unit_file: "123", secret: "hidden" }));
    const result = await getOrderUnitDetail({ source: "native", id: "order" });
    expect(result.groups.flatMap((group) => group.fields)).toContainEqual({ label: "Proyecto", value: "Sin dato" });
    expect(JSON.stringify(result)).not.toContain("hidden");
});
it.each(["unitFile:missing", "unitFile:ambiguous"])("suppresses details for %s even with a contradictory payload", async (warning) => {
    vi.mocked(getDatabaseOrder).mockResolvedValue({ ...snapshot("native", {}), warnings: [warning, "contact:missing"] });
    expect(await getOrderUnitDetail({ source: "native", id: "order" })).toMatchObject({ groups: [], warnings: [warning] });
});
it("handles a missing relationship without warnings", async () => {
    vi.mocked(getDatabaseOrder).mockResolvedValue({ ...snapshot("legacy", {}), unitFile: null });
    expect(await getOrderUnitDetail({ source: "legacy", id: "order" })).toMatchObject({ groups: [], warnings: ["unitFile:missing"] });
});
it("propagates authorized read failures", async () => {
    vi.mocked(getDatabaseOrder).mockRejectedValue(new Error("Denied"));
    await expect(getOrderUnitDetail({ source: "legacy", id: "208" })).rejects.toThrow("Denied");
});

it("preserves zero and decimal formatting, shows missing values and never borrows fields from the other source", async () => {
    vi.mocked(getDatabaseOrder).mockResolvedValue(snapshot("native", { lot_area_unit_file: 0, advertised_sale_price_unit_file: "1.2300", codigo_exp: "WRONG", project_id_unit_file: "42", unit_plans_unit_file: { html: "untrusted" } }));
    const result = await getOrderUnitDetail({ source: "native", id: "order" });
    const fields = result.groups.flatMap((group) => group.fields);
    expect(fields).toContainEqual({ label: "Área del lote (unidad no informada)", value: "0" });
    expect(fields).toContainEqual({ label: "Proyecto", value: "Sin dato" });
    expect(fields).toContainEqual({ label: "Código", value: "A-1" });
    expect(fields).toContainEqual({ label: "Precio de venta anunciado (moneda no informada)", value: "1.2300" });
    expect(fields).toContainEqual({ label: "Planos de la unidad (referencia de origen)", value: "Sin dato", kind: "expediente" });
    expect(JSON.stringify(result)).not.toContain("WRONG");
});

it.each(["native", "legacy"] as const)("marks the expediente field from %s without changing its value", async (source) => {
    for (const value of ["  https://rocca.box.com/s/example  ", "invalid", null]) {
        vi.mocked(getDatabaseOrder).mockResolvedValue(snapshot(source, { [source === "native" ? "unit_plans_unit_file" : "planosDeUnidad_exp"]: value }));
        const result = await getOrderUnitDetail({ source, id: "order" });
        expect(result.groups.flatMap((group) => group.fields)).toContainEqual({ label: "Planos de la unidad (referencia de origen)", value: value ?? "Sin dato", kind: "expediente" });
    }
});
