// ============================================================================
// Prettier config local del API.
//
// Prettier se encarga solo del formato. ESLint se encarga de errores de codigo.
// ============================================================================

export default {
    arrowParens: "always",
    bracketSameLine: false,
    bracketSpacing: true,
    semi: true,
    experimentalTernaries: false,
    singleQuote: false,
    jsxSingleQuote: false,
    quoteProps: "as-needed",
    trailingComma: "all",
    singleAttributePerLine: false,
    htmlWhitespaceSensitivity: "css",
    vueIndentScriptAndStyle: false,
    proseWrap: "preserve",
    insertPragma: false,
    printWidth: 500,
    // El RESTlet tambien se lee en el editor de NetSuite: evitar lineas extensas.
    overrides: [
        {
            files: "src/integrations/netsuite/suitescript/**/*.js",
            options: { printWidth: 120 },
        },
    ],
    requirePragma: false,
    tabWidth: 4,
    useTabs: false,
    embeddedLanguageFormatting: "auto",
};
