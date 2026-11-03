import { afterEach, describe, expect, it, vi } from "vitest";

import { createBank, listBankAdvisors, listBanks, parseBank, updateBankAdvisor } from "../../src/services/catalogs/banks-service";
vi.mock("../../src/services/api/api-client", () => ({ apiRequest: vi.fn() }));
import { apiRequest } from "../../src/services/api/api-client";
const bank = { publicId: "01JBNK00000000000000000000", name: "Banco", status: "active", version: 1, createdAt: "2026-11-03T10:00:00Z", updatedAt: "2026-11-03T10:00:00Z", advisorCount: 0 };
afterEach(() => vi.resetAllMocks());
describe("banks service", () => {
    it("requests complete server pagination and scoped search", async () => {
        vi.mocked(apiRequest).mockResolvedValue({ items: [bank], total: 71 });
        expect(await listBanks({ moduleCode: "ventas", search: "banco", status: "inactive", offset: 25, limit: 25 })).toEqual({ items: [bank], total: 71 });
        expect(apiRequest).toHaveBeenCalledWith("/catalogs/banks/items?moduleCode=ventas&search=banco&status=inactive&limit=25&offset=25");
    });
    it("keeps advisors nested in selected bank", async () => {
        vi.mocked(apiRequest).mockResolvedValue({ items: [], total: 0 });
        await listBankAdvisors("bank id", { moduleCode: "formalizacion", status: "all" });
        expect(apiRequest).toHaveBeenCalledWith("/catalogs/banks/items/bank%20id/advisors?moduleCode=formalizacion&limit=25&offset=0");
    });
    it("reads an imported advisor whose unspecified area is blank", async () => {
        const advisor = { ...bank, bankPublicId: bank.publicId, email: "contacto@example.com", phone: "72965655", area: "" };
        vi.mocked(apiRequest).mockResolvedValue({ items: [advisor], total: 1 });
        expect(await listBankAdvisors(bank.publicId, { moduleCode: "formalizacion" })).toEqual({ items: [advisor], total: 1 });
    });
    it("never replays a creation on session renewal", async () => {
        vi.mocked(apiRequest).mockResolvedValue(bank);
        await createBank({ moduleCode: "ventas", name: "Banco", reason: "Alta autorizada" });
        expect(apiRequest).toHaveBeenCalledWith("/catalogs/banks/items", expect.objectContaining({ method: "POST", retryOnUnauthorized: false }));
    });
    it("sends expected version with all advisor contacts", async () => {
        const advisor = { ...bank, bankPublicId: bank.publicId, email: "a@b.com", phone: "22222222", area: "Crédito" };
        vi.mocked(apiRequest).mockResolvedValue(advisor);
        const body = { moduleCode: "ventas" as const, name: "Ana", email: "a@b.com", phone: "22222222", area: "Crédito", reason: "Cambio contacto", expectedVersion: 3 };
        await updateBankAdvisor(bank.publicId, "advisor", body);
        expect(apiRequest).toHaveBeenCalledWith(`/catalogs/banks/items/${bank.publicId}/advisors/advisor`, { method: "PATCH", body, retryOnUnauthorized: false });
    });
    it.each([
        { ...bank, version: 0 },
        { ...bank, advisorCount: -1 },
        { ...bank, status: "deleted" },
    ])("rejects malformed native contracts", (invalid) => {
        expect(() => parseBank(invalid)).toThrow();
    });
});
