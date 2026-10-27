import { beforeEach, expect, it, vi } from "vitest";

import { getDatabaseOrder } from "../../src/services/formalization/database-order-service";
import { getOrderClientDetail } from "../../src/services/formalization/order-client-service";

vi.mock("../../src/services/formalization/database-order-service", () => ({ getDatabaseOrder: vi.fn() }));
beforeEach(() => {
    vi.resetAllMocks();
});
it.each(["native", "legacy"] as const)("projects contact and lead fields from the selected %s database snapshot", async (source) => {
    const lead = source === "native" ? { company_name_lead: "Empresa real", initial_comment_lead: "Comentario real" } : { empresa_lead: "Empresa real", comentario_lead: "Comentario real" };
    vi.mocked(getDatabaseOrder).mockResolvedValue({ schemaVersion: 1, observedAt: "2026-10-27T00:00:00Z", source, order: { id: "order" }, contact: { name: "Cliente real", email: "real@example.com", phone: "88888888", sourceFields: null }, lead: { sourceFields: lead }, unitFile: null, references: [], warnings: [] });
    const data = await getOrderClientDetail({ source, id: "order" });
    expect(data.name).toBe("Cliente real");
    const fields = data.groups.flatMap((group) => group.fields);
    expect(fields).toContainEqual({ label: "Empresa", value: "Empresa real" });
    expect(fields).toContainEqual({ label: "Comentario inicial", value: "Comentario real" });
    expect(fields).toContainEqual({ label: "Correo", value: "real@example.com" });
    expect(fields).not.toContainEqual(expect.objectContaining({ value: "Cliente de ejemplo" }));
});
it("propagates failures instead of using an invented client", async () => {
    vi.mocked(getDatabaseOrder).mockRejectedValue(new Error("Denied"));
    await expect(getOrderClientDetail({ source: "legacy", id: "208" })).rejects.toThrow("Denied");
});
