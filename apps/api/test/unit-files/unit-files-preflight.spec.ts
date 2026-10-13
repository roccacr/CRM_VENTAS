import { describe, expect, it } from "vitest";

import { mappingConflicts, selectVerifiedProjects, validateSourceColumns } from "../../scripts/prepare-unit-files.js";
import { UNIT_FIELDS } from "../../src/modules/crm/unit-files/unit-files.contract.js";
import { mapUnitDetail } from "../../src/modules/crm/unit-files/unit-files.mapper.js";

describe("Unit Files migration safety", () => {
    it("blocks incomplete mappings and provider ownership conflicts instead of overwriting", () => {
        const project = { legacyId: 1, externalId: 43, name: "Amara", status: 1 };
        expect(mappingConflicts([project], [{ legacyId: 1, deleted: null, externalId: "43" }])).toEqual([]);
        expect(mappingConflicts([project], [{ legacyId: 1, deleted: null, externalId: null }])).toEqual([1]);
        expect(mappingConflicts([project], [{ legacyId: 2, deleted: null, externalId: "43" }])).toEqual([1]);
    });
    it("fails closed on missing or changed source schema", () => {
        expect(() => {
            validateSourceColumns([]);
        }).toThrow("schema drift");
    });
    it("excludes duplicate provider references, without matching project names or PKs", () => {
        const rows = [
            { legacyId: 1, externalId: 40, name: "A", status: 1 },
            { legacyId: 2, externalId: 40, name: "B", status: 1 },
            { legacyId: 3, externalId: 43, name: "Amara", status: 1 },
        ];
        expect(selectVerifiedProjects(rows, [40, 43, 9])).toEqual([rows[2]]);
    });
    it("keeps every business value including placeholders, plans and metadata", () => {
        const values = Object.fromEntries(Object.keys(UNIT_FIELDS).map((key) => [key, "--"]));
        const item = mapUnitDetail({ ...values, position: 1, id: "legacy:unit-files:1", nativeCode: null, legacyId: 1, projectId: "canonical", projectName: "Amara", projectReference: 43 }, [{ systemCode: "odoo", externalId: "1", status: "active" }]);
        expect(Object.keys(item.values)).toHaveLength(27);
        expect(item.values.minimumSalePrice).toBe("--");
        expect(item.sourceMetadata.projectReference).toBe("43");
        expect(item.status).toBe("unknown");
    });
});
