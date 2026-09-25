// ============================================================================
// ESLint flat config para el API CRM TINK.
//
// Objetivo: detectar errores reales de TypeScript/NestJS sin pelear con
// Prettier. La configuracion usa typed linting con `projectService` para que
// cada archivo se valide contra el tsconfig mas cercano.
// ============================================================================

import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import { defineConfig } from "eslint/config";
import globals from "globals";
import jsdoc from "eslint-plugin-jsdoc";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import sonarjs from "eslint-plugin-sonarjs";
import tseslint from "typescript-eslint";

export default defineConfig([
    {
        ignores: ["dist/**", "node_modules/**", "coverage/**", ".codex/**", ".agents/**", "pnpm-lock.yaml"],
    },
    {
        files: ["**/*.ts"],
        extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
        languageOptions: {
            globals: {
                ...globals.node,
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        plugins: {
            jsdoc,
            "simple-import-sort": simpleImportSort,
            sonarjs,
        },
        rules: {
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
            "no-console": [
                "warn",
                {
                    allow: ["warn", "error"],
                },
            ],
            "simple-import-sort/exports": "error",
            "simple-import-sort/imports": "error",
            "sonarjs/cognitive-complexity": ["error", 12],
            "sonarjs/no-identical-functions": "error",
        },
    },
    {
        files: ["scripts/**/*.ts", "test/**/*.ts"],
        rules: {
            "no-console": "off",
        },
    },
    {
        files: ["src/**/*.module.ts"],
        rules: {
            "@typescript-eslint/no-extraneous-class": "off",
        },
    },
    {
        files: ["src/modules/**/*.ts"],
        rules: {
            "no-restricted-imports": [
                "error",
                {
                    patterns: [
                        {
                            group: ["*integrations*"],
                            message: "Los modulos core no deben importar adapters externos. Use puertos del dominio o mantenga el adapter dentro de src/integrations.",
                        },
                    ],
                },
            ],
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
