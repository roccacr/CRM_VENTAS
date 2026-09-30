/// <reference types="vite/client" />

/**
 * Variables públicas de Vite.
 *
 * `VITE_API_ORIGIN` es opcional en el tipo porque desarrollo y test tienen
 * origen por defecto. Fuera de esos modos, `frontend-env.ts` lo exige.
 */
interface ImportMetaEnv {
    readonly VITE_API_ORIGIN?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
