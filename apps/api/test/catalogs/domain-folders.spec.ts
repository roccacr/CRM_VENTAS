import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("table-owned feature folders", () => {
    it("keeps the complete Projects vertical outside shared catalog persistence", () => {
        for (const file of ["projects.controller.ts", "projects.service.ts", "projects.repository.ts", "projects.module.ts"]) {
            expect(existsSync(`src/modules/crm/projects/${file}`), file).toBe(true);
        }
        const repository = readFileSync("src/modules/crm/catalogs/catalogs.repository.ts", "utf8");
        expect(repository).not.toContain("ProjectsRepository");
        expect(existsSync("src/modules/crm/catalogs/projects.repository.ts")).toBe(false);
    });

    it("keeps legacy table queries and mappers inside their domain folder", () => {
        for (const domain of ["projects", "campaigns"]) {
            expect(existsSync(`src/integrations/legacy-crm/${domain}/legacy-${domain}.reader.ts`)).toBe(true);
            expect(existsSync(`src/integrations/legacy-crm/${domain}/legacy-${domain}.mapper.ts`)).toBe(true);
        }
        const bridge = readFileSync("src/integrations/legacy-crm/legacy-catalog.reader.ts", "utf8");
        expect(bridge).not.toContain("SELECT");
        expect(bridge).not.toContain("SOURCES");
    });
});
