import "reflect-metadata";

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it, vi } from "vitest";

import { CreateBankAdvisorDto, ListBanksQueryDto, UpdateBankDto } from "../../src/modules/crm/banks/banks.dto.js";
import type { BanksRepository } from "../../src/modules/crm/banks/banks.repository.js";
import { BanksService } from "../../src/modules/crm/banks/banks.service.js";
import type { IdentityService } from "../../src/modules/crm/identity/identity.service.js";

describe("Banks boundary", () => {
    it("rejects blank contact values, invalid email and missing version", async () => {
        expect((await validate(plainToInstance(CreateBankAdvisorDto, { moduleCode: "formalizacion", name: " ", email: "bad", phone: " ", area: " ", reason: "Motivo requerido" }))).map((e) => e.property)).toEqual(expect.arrayContaining(["name", "email", "phone", "area"]));
        expect((await validate(plainToInstance(UpdateBankDto, { moduleCode: "formalizacion", name: "Banco", reason: "Motivo requerido" }))).map((e) => e.property)).toContain("expectedVersion");
    });
    it("normalizes contacts and bounds pagination", async () => {
        const dto = plainToInstance(CreateBankAdvisorDto, { moduleCode: "formalizacion", name: " Ejecutivo ", email: " TEST@EXAMPLE.COM ", phone: " 123 ", area: " Crédito ", reason: " Motivo requerido " });
        expect(dto.email).toBe("test@example.com");
        expect(await validate(dto)).toEqual([]);
        expect(await validate(plainToInstance(ListBanksQueryDto, { moduleCode: "formalizacion", limit: 500, offset: 500 }))).toEqual([]);
        expect((await validate(plainToInstance(ListBanksQueryDto, { moduleCode: "formalizacion", limit: 501 }))).map((e) => e.property)).toContain("limit");
    });
    it("matches physical contact widths before persistence", async () => {
        const input = { moduleCode: "formalizacion", name: "Ejecutivo", email: "a@example.test", phone: "1".repeat(40), area: "A".repeat(120), reason: "Motivo requerido" };
        expect(await validate(plainToInstance(CreateBankAdvisorDto, input))).toEqual([]);
        expect((await validate(plainToInstance(CreateBankAdvisorDto, { ...input, phone: "1".repeat(41), area: "A".repeat(121) }))).map((error) => error.property)).toEqual(expect.arrayContaining(["phone", "area"]));
    });
    it("rejects reasons exceeding the security audit physical width", async () => {
        expect((await validate(plainToInstance(UpdateBankDto, { moduleCode: "formalizacion", name: "Banco", reason: "x".repeat(256), expectedVersion: 1 }))).map((error) => error.property)).toContain("reason");
    });
    it.each([{ roles: [] }, { roles: [{ code: "owner", status: "inactive" }] }, { roles: [{ code: "formalizacion", status: "active" }] }])("accepts an effective grant without a privileged role %j", async ({ roles }) => {
        const repository = { listBanks: vi.fn().mockResolvedValue({ items: [], total: 0 }) };
        const identity = { getCurrentUser: vi.fn().mockResolvedValue({ roles, orgUnits: [{ code: "formalizacion", status: "active" }], permissions: [{ code: "formalizacion.catalog_bank.read", effect: "allow" }], user: { publicId: "actor", status: "active" } }) };
        const service = new BanksService(identity as unknown as IdentityService, repository as unknown as BanksRepository);
        await expect(service.listBanks("session", { moduleCode: "formalizacion" })).resolves.toEqual({ items: [], total: 0 });
        expect(repository.listBanks).toHaveBeenCalledTimes(1);
    });
});
