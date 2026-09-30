import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Configuracion Vite para el stub frontend.
 *
 * Mantener la configuracion minima hasta que se apruebe el corte visual de
 * identidad. Nuevos plugins deben justificar el problema que resuelven y
 * quedarse dentro de este proyecto frontend.
 */
export default defineConfig({
    plugins: [react()],
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
        environment: "jsdom",
    },
});
