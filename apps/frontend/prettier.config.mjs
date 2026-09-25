// ============================================================================
// Prettier config local del frontend.
//
// Se mantiene dentro de apps/frontend para que el proyecto pueda moverse o
// desplegarse solo sin depender de una configuracion raiz.
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
    requirePragma: false,
    tabWidth: 4,
    useTabs: false,
    embeddedLanguageFormatting: "auto",
};
