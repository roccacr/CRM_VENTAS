import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Configuracion Vite para el stub frontend.
 *
 * Mantener la configuracion minima hasta que se apruebe el corte visual de
 * identidad. Nuevos plugins deben justificar el problema que resuelven y
 * quedarse dentro de este proyecto frontend.
 */
export default defineConfig({
    plugins: [react()],
});
