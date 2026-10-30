/**
 * Validacion de entrada compartida por todos los modulos (propiedades propias e ID interno).
 * No hace: no consulta NetSuite ni decide el enrutamiento; solo dice si un valor es aceptable.
 *
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(["./SS2_1_LIB_CRM_Respuestas"], (responses) => {
    "use strict";

    const { fail } = responses;

    // Maximo 15 digitos: es el limite del receptor de eventos y cabe siempre en un entero seguro.
    const CANONICAL_ID = /^[1-9]\d{0,14}$/;

    /**
     * Evita leer propiedades heredadas del prototipo (proteccion ante prototype pollution).
     * @param {object} obj Objeto a inspeccionar.
     * @param {string} key Propiedad buscada.
     * @returns {boolean} true solo si la propiedad es propia.
     */
    function hasOwn(obj, key) {
        return Object.prototype.hasOwnProperty.call(obj, key);
    }

    /**
     * ID interno positivo, como string decimal canonico de hasta 15 digitos.
     * @param {object} request Solicitud ya validada como objeto.
     * @returns {boolean} true si `request.id` es un ID interno valido.
     */
    function isValidId(request) {
        const id = hasOwn(request, "id") ? request.id : undefined;
        return typeof id === "string" && CANONICAL_ID.test(id);
    }

    /**
     * Respuesta estandar para un ID invalido.
     * @param {object} request Solicitud ya validada como objeto.
     * @returns {?{status: number, error: object}} 400 INVALID_ID, o null si el ID es valido.
     */
    function invalidIdResponse(request) {
        return isValidId(request) ? null : fail(400, "INVALID_ID", "Indica un ID interno positivo de NetSuite.");
    }

    return Object.freeze({ hasOwn, isValidId, invalidIdResponse });
});
