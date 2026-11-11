import { defineConfig } from "vitest/config";
import CiSequencer from "../../deploy/habita/ci-sequencer.mts";

// Opt-in persistence suites share .env MySQL and rollback-only Owner fixtures.
const realMysqlTests = [process.env.IDENTITY_ACCESS_MYSQL_TESTS, process.env.ADMINISTRATION_MYSQL_TESTS, process.env.CATALOG_MYSQL_TESTS].includes("1");

export default defineConfig({
    test: {
        sequence: process.env.CI_TEST_PLAN ? { sequencer: CiSequencer } : {},
        reporters: ["default", "./test/support/skipped-persistence-reporter.mjs"],
        fileParallelism: !realMysqlTests,
        coverage: {
            provider: "v8",
            include: ["src/**/*.ts"],
            exclude: ["src/main.ts", "src/**/*.types.ts"],
            reporter: ["text-summary", "json-summary", "lcov"],
            // Piso graduado: medicion base 2026-11-09 = 78.6% stmts / 68.9% branches / 84.5% funcs / 81.8% lines. Subir cuando la cobertura mejore.
            thresholds: { statements: 75, branches: 65, functions: 80, lines: 78 },
        },
    },
});
