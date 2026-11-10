import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import { describe, expect, it, vi } from "vitest";

import { CreateCatalogItemDto, ListCatalogItemsQueryDto, UpdateCatalogItemDto } from "../../src/modules/crm/catalogs/dto/catalog-items.dto.js";

it("accepts batches of 500 rows and rejects a larger catalog page", () => {
    const query = { moduleCode: "administration", offset: 500 };
    expect(validateSync(plainToInstance(ListCatalogItemsQueryDto, { ...query, limit: 500 }))).toEqual([]);
    expect(validateSync(plainToInstance(ListCatalogItemsQueryDto, { ...query, limit: 501 })).map((error) => error.property)).toContain("limit");
});

describe.each([CreateCatalogItemDto, UpdateCatalogItemDto])("catalog detail validation: %s", (Dto) => {
    const body = { moduleCode: "administration", name: "Catalog item", reason: "Approved change" };

    it.each([123, {}, [], ["text"], false].map((detail) => ({ detail })))("rejects invalid detail $detail before persistence", async ({ detail }) => {
        const dto = plainToInstance(Dto, { ...body, detail });
        expect(validateSync(dto).some((error) => error.property === "detail" && error.constraints?.isString)).toBe(true);
        const persist = vi.fn();
        const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
        await expect(pipe.transform({ ...body, detail }, { type: "body", metatype: Dto }).then(persist)).rejects.toBeInstanceOf(BadRequestException);
        expect(persist).not.toHaveBeenCalled();
    });

    it.each([
        [{}, undefined],
        [{ detail: null }, undefined],
        [{ detail: "" }, undefined],
        [{ detail: "   " }, undefined],
        [{ detail: "  Description  " }, "Description"],
    ])("preserves accepted detail semantics %j", (input, expected) => {
        const dto = plainToInstance(Dto, { ...body, ...input });
        expect(validateSync(dto)).toEqual([]);
        expect(dto.detail).toBe(expected);
    });
});
