import { describe, expect, it, vi } from "vitest";

import { LEAD_PROFILE_PERMISSION, type LeadProfileSource } from "../../src/modules/crm/leads/lead-profile.contract.js";
import { buildLeadProfile } from "../../src/modules/crm/leads/lead-profile.mapper.js";
import { LeadProfileService } from "../../src/modules/crm/leads/lead-profile.service.js";

const source = (origin: "native" | "legacy", values: Record<string, string | null>): LeadProfileSource => ({ source: origin, id: origin === "native" ? "01ARZ3NDEKTSV4RRFFQ69G5FAV" : "12", internalId: "12", reference: "400", values });
describe("perfil completo del lead", () => {
    it("conserva los datos legacy sin crear un registro nativo", () => {
        const result = buildLeadProfile(null, source("legacy", { fullName: "Ana", nationality: "CR" }));
        expect(result.source).toBe("legacy");
        expect(result.sections.flatMap((section) => section.fields)).toContainEqual(expect.objectContaining({ code: "nationality", value: "CR", source: "legacy" }));
    });
    it("prefiere el valor nativo y conserva la discrepancia legacy", () => {
        const result = buildLeadProfile(source("native", { fullName: "Ana nueva", email: null }), source("legacy", { fullName: "Ana anterior", email: "ana@example.test" }));
        const fields = result.sections.flatMap((section) => section.fields);
        expect(result.sources).toEqual(["native", "legacy"]);
        expect(fields).toContainEqual(expect.objectContaining({ code: "fullName", value: "Ana nueva", source: "native", legacyValue: "Ana anterior" }));
        expect(fields).toContainEqual(expect.objectContaining({ code: "email", value: "ana@example.test", source: "legacy" }));
    });
    it.each([
        { permissions: [] },
        { permissions: [{ code: LEAD_PROFILE_PERMISSION, effect: "deny", scope: "all_areas" }] },
        {
            permissions: [
                { code: LEAD_PROFILE_PERMISSION, effect: "allow", scope: "all_areas" },
                { code: LEAD_PROFILE_PERMISSION, effect: "deny", scope: "all_areas" },
            ],
        },
    ])("deniega antes de consultar cualquiera de las bases: %j", async ({ permissions }) => {
        const identity = { getCurrentUser: vi.fn().mockResolvedValue({ permissions }) };
        const repository = { read: vi.fn() };
        const service = new LeadProfileService(identity as never, repository as never);
        await expect(service.read("session", { source: "legacy", id: "12" })).rejects.toMatchObject({ status: 403 });
        expect(repository.read).not.toHaveBeenCalled();
    });
    it("revalida el permiso global sin exigir un rol específico", async () => {
        const repository = { read: vi.fn().mockResolvedValue({ source: "legacy" }) };
        const identity = { getCurrentUser: vi.fn().mockResolvedValue({ permissions: [{ code: LEAD_PROFILE_PERMISSION, effect: "allow", scope: "self" }] }) };
        const service = new LeadProfileService(identity as never, repository as never);
        await service.read("session", { source: "legacy", id: "12" });
        expect(repository.read).toHaveBeenCalledWith(expect.objectContaining({ source: "legacy", id: "12" }));
    });
});
