import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const apiRoot = process.cwd();
const fixturePath = join(apiRoot, "src/modules/crm/identity/prohibited-import.fixture.ts");

/**
 * Ejecuta ESLint contra un fixture real bajo `src/modules`.
 *
 * El typed linting usa project service de TypeScript; por eso el archivo debe
 * existir temporalmente para que ESLint llegue a la regla de frontera.
 */
const lintModuleSource = async (source: string) => {
    const eslint = new ESLint({ cwd: apiRoot });
    await writeFile(fixturePath, source, "utf8");

    try {
        return await eslint.lintFiles([fixturePath]);
    } finally {
        await rm(fixturePath, { force: true });
    }
};

describe("module import boundary", () => {
    it("bloquea imports directos desde modulos core hacia integrations", async () => {
        const [result] = await lintModuleSource(`
            import { LegacyCrmDatabaseService } from "../../../integrations/legacy-crm/legacy-crm-database.service.js";

            export const prohibited = LegacyCrmDatabaseService;
        `);

        expect(result?.messages.some((message) => message.ruleId === "no-restricted-imports")).toBe(true);
    }, 15_000);
});
