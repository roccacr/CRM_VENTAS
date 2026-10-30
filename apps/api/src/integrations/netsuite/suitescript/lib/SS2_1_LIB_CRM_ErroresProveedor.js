/**
 * Traduccion de errores de NetSuite a respuestas saneadas (regla 4 de seguridad).
 *
 * @NApiVersion 2.1
 */
define(["./SS2_1_LIB_CRM_Respuestas"], (responses) => {
    "use strict";

    const { fail } = responses;

    /** Codigos de SuiteScriptError (error.name) que significan "no existe" en lugar de "fallo". */
    const NOT_FOUND_ERRORS = Object.freeze(["RCRD_DSNT_EXIST"]);

    /**
     * Solo se inspecciona error.name (codigo fijo de NetSuite), nunca error.message.
     * `errors` = { notFound, readFailed }, cada uno { code, message } propio del modulo.
     */
    function providerError(error, errors) {
        const notFound = Boolean(error) && NOT_FOUND_ERRORS.includes(error.name);
        const { code, message } = notFound ? errors.notFound : errors.readFailed;
        return fail(notFound ? 404 : 502, code, message);
    }

    return Object.freeze({ providerError });
});
