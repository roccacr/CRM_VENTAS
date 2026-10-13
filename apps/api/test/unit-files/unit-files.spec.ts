import { ValidationPipe } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { decodeUnitCursor, encodeUnitCursor, UNIT_FIELDS, unitFilterKey } from "../../src/modules/crm/unit-files/unit-files.contract.js";
import { UnitFilesQueryDto } from "../../src/modules/crm/unit-files/unit-files.dto.js";

const projectIds = ["01M4RCK911NS2ZNCRYPBD40B9W"];
describe("Unit Files criteria and cursor", () => {
    it("binds multi-pane criteria to cursors independently of selection order", () => {
        const base = { projectIds, moduleCode: "administration", limit: 50 };
        const key = unitFilterKey({ ...base, codes: ["FF001", "FF002"] });
        expect(key).not.toBe(unitFilterKey(base));
        expect(key).toBe(unitFilterKey({ ...base, codes: ["FF002", "FF001"] }));
    });
    it("validates JSON multi-pane selections without splitting values containing commas", async () => {
        const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
        await expect(pipe.transform({ moduleCode: "administration", projectIds, codes: '["FF,001","FF002"]' }, { type: "query", metatype: UnitFilesQueryDto })).resolves.toMatchObject({ codes: ["FF,001", "FF002"] });
        await expect(pipe.transform({ moduleCode: "administration", projectIds, codes: '["FF",1]' }, { type: "query", metatype: UnitFilesQueryDto })).rejects.toThrow();
    });
    it("rejects an unfiltered request before querying", async () => {
        const pipe = new ValidationPipe({ transform: true, whitelist: true });
        await expect(pipe.transform({ moduleCode: "administration" }, { type: "query", metatype: UnitFilesQueryDto })).rejects.toThrow();
    });
    it("accepts any selected canonical projects and rejects huge batches", async () => {
        const pipe = new ValidationPipe({ transform: true, whitelist: true });
        await expect(pipe.transform({ moduleCode: "administration", projectIds: projectIds.join(","), limit: "50" }, { type: "query", metatype: UnitFilesQueryDto })).resolves.toMatchObject({ projectIds, limit: 50 });
        await expect(pipe.transform({ moduleCode: "administration", projectIds, limit: 200 }, { type: "query", metatype: UnitFilesQueryDto })).rejects.toThrow();
        const manyProjects = Array.from({ length: 10 }, (_, index) => "01M4RCK911NS2ZNCRYPBD40B9" + String(index));
        await expect(pipe.transform({ moduleCode: "administration", projectIds: manyProjects.join(",") }, { type: "query", metatype: UnitFilesQueryDto })).resolves.toMatchObject({ projectIds: manyProjects });
    });
    it("binds a cursor to the complete query and validates source and position", () => {
        const key = unitFilterKey({ projectIds, moduleCode: "administration", limit: 50 });
        const cursor = encodeUnitCursor({ key, phase: "legacy", after: 40 });
        expect(decodeUnitCursor(cursor, key)).toEqual({ key, phase: "legacy", after: 40 });
        expect(() => decodeUnitCursor(cursor, "other")).toThrow();
        expect(() => decodeUnitCursor(cursor, unitFilterKey({ projectIds, moduleCode: "administration", limit: 50, codeMatch: "ff03" }))).toThrow();
        expect(() => decodeUnitCursor("not-json", key)).toThrow();
    });
    it("retains all 27 source business fields separately from identities and relationship", () => {
        expect(Object.keys(UNIT_FIELDS)).toHaveLength(27);
        expect(Object.keys(UNIT_FIELDS).some((key) => key.toLowerCase().includes("netsuite"))).toBe(false);
        expect(UNIT_FIELDS.unitPlans).toEqual({ source: "planosDeUnidad_exp", length: "TEXT" });
    });
});
