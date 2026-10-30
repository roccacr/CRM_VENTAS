/**
 * Flujo comun de PUT por accion, reutilizable por cualquier modulo.
 * Responsabilidad unica: validar accion, claves y ID ANTES de tocar NetSuite y delegar en la accion.
 *
 * @NApiVersion 2.1
 */
define(["./SS2_1_LIB_CRM_Respuestas", "./SS2_1_LIB_CRM_Validacion"], (responses, validation) => {
    "use strict";

    const { fail, notImplemented } = responses;
    const { hasOwn, invalidIdResponse } = validation;

    /** Claves permitidas en el cuerpo de un PUT. Cualquier otra se rechaza. */
    const PUT_ALLOWED_KEYS = Object.freeze(["module", "action", "id"]);

    /**
     * El orden de validacion es parte del contrato con el CRM:
     * sin action -> 501; action desconocida -> 400; claves extra -> 400; ID invalido -> 400.
     *
     * @param {object} request Solicitud ya validada como objeto por el enrutador.
     * @param {Object<string, (id: string) => object>} actions Acciones del modulo por nombre.
     * @returns {object} Respuesta de aplicacion (ok o fail).
     */
    function runAction(request, actions) {
        if (!hasOwn(request, "action")) return notImplemented();
        if (typeof request.action !== "string" || !hasOwn(actions, request.action))
            return fail(400, "INVALID_ACTION", "Selecciona una accion valida.");
        if (Object.keys(request).some((key) => !PUT_ALLOWED_KEYS.includes(key)))
            return fail(400, "INVALID_REQUEST", "Solo se permiten module, action e id.");
        const invalid = invalidIdResponse(request);
        if (invalid) return invalid;
        return actions[request.action](request.id);
    }

    return Object.freeze({ runAction });
});
