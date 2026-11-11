import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

import CiSequencer from "../../deploy/habita/ci-sequencer.mjs";

/**
 * Configuracion Vite para el stub frontend.
 *
 * Mantener la configuracion minima hasta que se apruebe el corte visual de
 * identidad. Nuevos plugins deben justificar el problema que resuelven y
 * quedarse dentro de este proyecto frontend.
 */
export default defineConfig({
    plugins: [react()],
    resolve: {
        dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
        // Keep the lazy report's loader in the initial React dependency graph.
        include: ["antd/es/skeleton"],
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: (id) => {
                    if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) {
                        return "vendor-react";
                    }

                    if (id.includes("node_modules/antd") || id.includes("node_modules/@ant-design")) {
                        return "vendor-antd";
                    }

                    return undefined;
                },
            },
        },
    },
    test: {
        sequence: process.env.CI_TEST_PLAN ? { sequencer: CiSequencer } : {},
        environment: "jsdom",
        // Bound jsdom memory pressure consistently with the coverage command.
        maxWorkers: 2,
        setupFiles: ["./test/setup.ts"],
        // jsdom + antd con 2 workers hace que tests de formularios largos superen los 5 s por defecto bajo carga (SystemUsersPage). 20 s evita falsos rojos sin ocultar cuelgues reales.
        testTimeout: 20_000,
        hookTimeout: 20_000,
        coverage: {
            provider: "v8",
            include: ["src/**/*.{ts,tsx}"],
            exclude: ["src/main.tsx", "src/**/*.d.ts"],
            reporter: ["text-summary", "json-summary", "lcov"],
        },
    },
});
