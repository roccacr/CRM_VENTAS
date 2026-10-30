/**
 * Validacion de entrada compartida por todos los modulos.
 *
 * @NApiVersion 2.1
 */
define(["./SS2_1_LIB_CRM_Respuestas"], (responses) => {
    "use strict";

    const { fail } = responses;

    /** Evita leer propiedades heredadas del prototipo (proteccion ante prototype pollution). */
    function hasOwn(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    }

    /** ID interno positivo, como string y sin perdida de precision. */
    function isValidId(request) {
        const id = hasOwn(request, "id") ? request.id : undefined;
        return typeof id === "string" && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
    }

    /** Respuesta estandar para un ID invalido; null si el ID es valido. */
    function invalidIdResponse(request) {
        return isValidId(request) ? null : fail(400, "INVALID_ID", "Indica un ID interno positivo de NetSuite.");
    }

    return Object.freeze({ hasOwn, isValidId, invalidIdResponse });
});
