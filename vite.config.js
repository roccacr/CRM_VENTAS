import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { NodeGlobalsPolyfillPlugin } from "@esbuild-plugins/node-globals-polyfill";

export default defineConfig({
    base: "/",
    plugins: [react()],
    build: {
        sourcemap: true, // Habilitar source maps para la compilación en producción
        outDir: "dist", // Directorio de salida para los archivos de producción
        manifest: true, // Generar un manifiesto para integraciones
        rollupOptions: {
            output: {
                entryFileNames: "assets/[name].[hash].js",
                chunkFileNames: "assets/[name].[hash].js",
                assetFileNames: "assets/[name].[hash].[ext]",
            },
        },
    },
    optimizeDeps: {
        esbuildOptions: {
            define: {
                global: "globalThis", // Definir 'global' para compatibilidad con Node.js
            },
            plugins: [
                NodeGlobalsPolyfillPlugin({
                    buffer: true, // Polyfill para buffer
                    crypto: true, // Polyfill para crypto
                }),
            ],
        },
    },
    resolve: {
        alias: {
            crypto: "crypto-browserify", // Alias para utilizar 'crypto-browserify' en lugar de la API de navegador
        },
    },
});
