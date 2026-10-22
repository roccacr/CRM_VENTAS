import { join } from "node:path";

import { ESLint, type Linter } from "eslint";
import { describe, expect, it } from "vitest";

const apiRoot = process.cwd();
const fixturePath = join(apiRoot, "src/modules/crm/identity/prohibited-import.fixture.ts");

/**
 * Resuelve la regla real del proyecto y la ejecuta sin iniciar TypeScript.
 *
 * La frontera solo necesita sintaxis de imports. El lint tipado completo sigue
 * ejecutandose en pnpm lint; no se crean fixtures temporales dentro de src.
 */
const lintModuleSource = async (source: string) => {
    const configured = new ESLint({ cwd: apiRoot });
    const config = (await configured.calculateConfigForFile(fixturePath)) as Linter.Config | undefined;
    const rule = config?.rules?.["no-restricted-imports"];
    if (!rule) throw new Error("La frontera core/integrations no esta configurada.");
    const isolated = new ESLint({
        cwd: apiRoot,
        overrideConfigFile: true,
        overrideConfig: [{ files: ["**/*.ts"], rules: { "no-restricted-imports": rule } }],
    });
    return isolated.lintText(source, { filePath: fixturePath });
};

describe("module import boundary", () => {
    it("bloquea imports directos desde modulos core hacia integrations", async () => {
        const [result] = await lintModuleSource(`
            import { LegacyCrmDatabaseService } from "../../../integrations/legacy-crm/legacy-crm-database.service.js";

            export const prohibited = LegacyCrmDatabaseService;
        `);

        expect(result?.messages.some((message) => message.ruleId === "no-restricted-imports")).toBe(true);
    }, 15_000);

    it("permite puertos del dominio sin errores de parser", async () => {
        const [result] = await lintModuleSource('import { PORT } from "../ports/domain.port.js"; export const port = PORT;');
        expect(result?.messages).toEqual([]);
    });

    it("aplica la frontera solo a core, sin impedir adapters de integracion", async () => {
        const configured = new ESLint({ cwd: apiRoot });
        const config = (await configured.calculateConfigForFile(join(apiRoot, "src/integrations/legacy-crm/legacy-catalog.reader.ts"))) as Linter.Config | undefined;
        expect(config).toBeDefined();
        expect(config?.rules?.["no-restricted-imports"]).toBeUndefined();
    });
});
