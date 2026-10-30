import { beforeEach, expect, it, vi } from "vitest";

import { getDatabaseOrder } from "../../src/services/formalization/database-order-service";
import { getOrderClientDetail } from "../../src/services/formalization/order-client-service";

vi.mock("../../src/services/formalization/database-order-service", () => ({ getDatabaseOrder: vi.fn() }));
beforeEach(() => {
    vi.resetAllMocks();
});
it.each(["native", "legacy"] as const)("projects contact and lead fields from the selected %s database snapshot", async (source) => {
    const lead = source === "native" ? { status_code_lead: "1", company_name_lead: "Empresa real", updated_at_lead: "2025-03-03T16:15:24.000Z" } : { estado_lead: "1", empresa_lead: "Empresa real", actualizado_lead: "2025-03-03T16:15:24.000Z" };
    vi.mocked(getDatabaseOrder).mockResolvedValue({ schemaVersion: 1, observedAt: "2026-10-27T00:00:00Z", source, order: { id: "order" }, contact: { name: "Cliente real", email: "real@example.com", phone: "88888888", sourceFields: null }, lead: { sourceFields: lead, status: { code: "active", label: "Activo" }, followUpReason: { code: "legacy:58", name: "Cierre Firmado" } }, unitFile: null, references: [], warnings: [] });
    const data = await getOrderClientDetail({ source, id: "order" });
    expect(data.groups.flatMap((group) => group.fields)).toContainEqual({ label: "Clasificación de seguimiento", value: "Cierre Firmado" });
    expect(data.name).toBe("Cliente real");
    const fields = data.groups.flatMap((group) => group.fields);
    expect(fields).toContainEqual({ label: "Estado del lead", value: "Activo" });
    expect(data.groups.map((group) => group.title)).toEqual(["Contacto", "Información comercial", "Captación y seguimiento"]);
    expect(fields.map((field) => field.label)).not.toEqual(expect.arrayContaining(["Empresa", "Referencia de caída", "País (código)", "Creado", "Actualizado", "Código"]));
    expect(data.groups[0]?.fields.map((field) => field.label)).toEqual(["Nombre completo", "Correo", "Teléfono"]);
    expect(fields).toContainEqual({ label: "Correo", value: "real@example.com" });
    expect(fields).not.toContainEqual(expect.objectContaining({ value: "Cliente de ejemplo" }));
});
it("propagates failures instead of using an invented client", async () => {
    vi.mocked(getDatabaseOrder).mockRejectedValue(new Error("Denied"));
    await expect(getOrderClientDetail({ source: "legacy", id: "208" })).rejects.toThrow("Denied");
});
