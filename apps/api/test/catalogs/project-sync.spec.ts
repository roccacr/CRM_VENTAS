import { describe, expect, it } from "vitest";

import { mapProjects } from "../../scripts/sync-legacy-projects.js";

describe("legacy project mapping", () => {
    it("merges identical NetSuite duplicates and preserves source identities", () => {
        expect(
            mapProjects([
                { id_proyecto: 29, id_ProNetsuite: 40, Nombre_proyecto: " Lean Homes Liberia ", estado_proyecto: 1 },
                { id_proyecto: 35, id_ProNetsuite: 40, Nombre_proyecto: "Lean Homes Liberia", estado_proyecto: 1 },
            ]),
        ).toEqual([{ externalId: "40", name: "Lean Homes Liberia", status: "active", legacyIds: [29, 35] }]);
    });
    it("rejects ambiguous duplicates before writing", () => {
        expect(() =>
            mapProjects([
                { id_proyecto: 1, id_ProNetsuite: 40, Nombre_proyecto: "First", estado_proyecto: 1 },
                { id_proyecto: 2, id_ProNetsuite: 40, Nombre_proyecto: "Other", estado_proyecto: 1 },
            ]),
        ).toThrow("Conflicting");
    });
    it.each([null, "", "x", "x".repeat(181)])("rejects invalid names", (name) => {
        expect(() => mapProjects([{ id_proyecto: 1, id_ProNetsuite: 1, Nombre_proyecto: name, estado_proyecto: 1 }])).toThrow();
    });
    it("maps inactive status and rejects unknown status or invalid identifiers", () => {
        expect(mapProjects([{ id_proyecto: 1, id_ProNetsuite: 1, Nombre_proyecto: "Project", estado_proyecto: 0 }])[0]?.status).toBe("inactive");
        for (const row of [
            { id_proyecto: 1, id_ProNetsuite: 0, Nombre_proyecto: "Project", estado_proyecto: 1 },
            { id_proyecto: 1, id_ProNetsuite: 1, Nombre_proyecto: "Project", estado_proyecto: 2 },
        ])
            expect(() => mapProjects([row])).toThrow();
    });
});
