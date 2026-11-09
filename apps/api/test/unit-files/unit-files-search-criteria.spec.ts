import { DummyDriver, Kysely, MysqlAdapter, MysqlIntrospector, MysqlQueryCompiler, sql } from "kysely";
import { describe, expect, it } from "vitest";

import type { UnitFacetKind, UnitFilter } from "../../src/modules/crm/unit-files/unit-files.contract.js";
import { unitFileCriteria } from "../../src/modules/crm/unit-files/unit-files-search.js";

const db = new Kysely<Record<string, never>>({ dialect: { createAdapter: () => new MysqlAdapter(), createDriver: () => new DummyDriver(), createIntrospector: (k) => new MysqlIntrospector(k), createQueryCompiler: () => new MysqlQueryCompiler() } });
const fields: Record<UnitFacetKind, string> = { code: "u.code", housingType: "u.housing_type", status: "u.status", projectIds: "u.project_id" };
const base: UnitFilter = { projectIds: ["p1"], moduleCode: "m", limit: 10 };
const compile = (filter: Partial<UnitFilter>, omit?: UnitFacetKind) => sql`SELECT 1 WHERE 1=1 ${unitFileCriteria({ ...base, ...filter }, fields, omit)}`.compile(db);

describe("unitFileCriteria", () => {
    it("adds no clauses for an empty filter", () => {
        const { sql: text, parameters } = compile({});
        expect(text.replace(/\s+/g, " ").trim()).toBe("SELECT 1 WHERE 1=1");
        expect(parameters).toEqual([]);
    });

    it("binds exact filters as parameters and quotes field names as identifiers", () => {
        const { sql: text, parameters } = compile({ status: "available", housingType: "casa", code: "A-1" });
        expect(text).toContain("AND `u`.`status`=?");
        expect(text).toContain("AND `u`.`housing_type`=?");
        expect(text).toContain("AND `u`.`code`=?");
        expect(parameters).toEqual(["available", "casa", "A-1"]);
    });

    it.each(["' OR 1=1--", "x'; DROP TABLE units;--", "\\", "`", "%", "_", "\u0000"])("never interpolates hostile values into SQL text: %j", (hostile) => {
        const { sql: text, parameters } = compile({ status: hostile, codeMatch: hostile, codes: [hostile], statuses: [hostile] });
        if (hostile.length > 1) expect(text).not.toContain(hostile);
        expect(parameters.filter((p) => p === hostile).length).toBeGreaterThanOrEqual(4);
    });

    it("builds a case-insensitive LOCATE for codeMatch with a bound value", () => {
        const { sql: text, parameters } = compile({ codeMatch: "AbC" });
        expect(text).toContain("LOCATE(LOWER(?),LOWER(`u`.`code`))>0");
        expect(parameters).toEqual(["AbC"]);
    });

    it("ORs values inside a pane with COALESCE and ANDs across panes", () => {
        const { sql: text, parameters } = compile({ codes: ["A", "B"], statuses: ["x"], housingTypes: ["h1", "h2"], paneProjectIds: ["p9"] });
        expect(text).toContain("COALESCE(`u`.`code`,'') IN (?, ?)");
        expect(text).toContain("COALESCE(`u`.`status`,'') IN (?)");
        expect(text).toContain("COALESCE(`u`.`housing_type`,'') IN (?, ?)");
        expect(text).toContain("COALESCE(`u`.`project_id`,'') IN (?)");
        expect(parameters).toHaveLength(6);
        expect(parameters).toEqual(expect.arrayContaining(["A", "B", "h1", "h2", "x", "p9"]));
    });

    it("ignores empty or undefined pane selections (an empty IN () would be invalid SQL)", () => {
        const { sql: text } = compile({ codes: [] });
        expect(text).not.toContain(" IN ");
    });

    it("omits only the pane's own selection for cascading facets", () => {
        const { sql: text } = compile({ codes: ["A"], statuses: ["x"] }, "status");
        expect(text).toContain("COALESCE(`u`.`code`,'') IN (?)");
        expect(text).not.toContain("COALESCE(`u`.`status`,'')");
    });
});
