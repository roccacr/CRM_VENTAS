/**
 * Traduccion de errores de NetSuite a respuestas saneadas (regla 4 de seguridad).
 * No hace: no registra ni expone el mensaje del proveedor; solo se inspecciona `error.name`.
 *
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(["./SS2_1_LIB_CRM_Respuestas"], (responses) => {
    "use strict";

    const { fail } = responses;

    /** Codigos de SuiteScriptError (error.name) que significan "no existe" en lugar de "fallo". */
    const NOT_FOUND_ERRORS = Object.freeze(["RCRD_DSNT_EXIST"]);

    /**
     * @param {*} error Excepcion capturada (cualquier valor).
     * @param {{notFound: {code: string, message: string}, readFailed: {code: string, message: string}}} errors
     *        Errores propios del modulo.
     * @returns {{status: number, error: {code: string, message: string}}} 404 si el registro no existe; 502 en
     *          cualquier otro caso.
     */
    function providerError(error, errors) {
        const notFound = Boolean(error) && NOT_FOUND_ERRORS.includes(error.name);
        const { code, message } = notFound ? errors.notFound : errors.readFailed;
        return fail(notFound ? 404 : 502, code, message);
    }

    return Object.freeze({ providerError });
});
