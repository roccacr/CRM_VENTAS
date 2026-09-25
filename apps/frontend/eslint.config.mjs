// ============================================================================
// ESLint flat config para el frontend CRM TINK.
//
// Objetivo: validar TypeScript/React/Vite sin duplicar reglas de formato.
// React Hooks y React Refresh quedan activos porque protegen patrones reales
// del runtime React; Prettier queda al final para evitar conflictos.
// ============================================================================

import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import { defineConfig } from "eslint/config";
import globals from "globals";
import jsdoc from "eslint-plugin-jsdoc";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

export default defineConfig([
    {
        ignores: ["dist/**", "node_modules/**", "coverage/**", ".codex/**", ".agents/**", "pnpm-lock.yaml"],
    },
    {
        files: ["**/*.{ts,tsx}"],
        extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
        languageOptions: {
            globals: {
                ...globals.browser,
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            jsdoc,
            "react-hooks": reactHooks,
            "react-refresh": reactRefresh,
            "simple-import-sort": simpleImportSort,
            sonarjs,
        },
        rules: {
            ...reactHooks.configs.recommended.rules,
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    fixStyle: "inline-type-imports",
                    prefer: "type-imports",
                },
            ],
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-floating-promises": "error",
            "@typescript-eslint/no-misused-promises": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    caughtErrorsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
            "@typescript-eslint/no-unnecessary-type-assertion": "error",
            complexity: ["error", 8],
            "jsdoc/require-jsdoc": [
                "error",
                {
                    publicOnly: true,
                    require: {
                        ClassDeclaration: true,
                        FunctionDeclaration: true,
                        MethodDefinition: true,
                    },
                },
            ],
            "max-depth": ["error", 3],
            "max-params": ["error", 4],
            "react-refresh/only-export-components": [
                "warn",
                {
                    allowConstantExport: true,
                },
            ],
            "simple-import-sort/exports": "error",
            "simple-import-sort/imports": "error",
            "sonarjs/cognitive-complexity": ["error", 12],
            "sonarjs/no-identical-functions": "error",
        },
    },
    {
        files: ["*.config.mjs", "scripts/**/*.mjs"],
        extends: [js.configs.recommended],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    eslintConfigPrettier,
]);
