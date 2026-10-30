/**
 * Formas de respuesta del RESTlet. Una sola forma de exito y una sola de error,
 * para que el CRM interprete cualquier modulo igual.
 *
 * @NApiVersion 2.1
 */
define([], () => {
    "use strict";

    /** Error de aplicacion. `status` es el JSON de aplicacion, no el HTTP del transporte. */
    function fail(status, code, message) {
        return { status, error: { code, message } };
    }

    /** Exito de aplicacion (status 200). */
    function ok(data) {
        return { status: 200, data };
    }

    /** Respuesta de los modulos reservados que aun no tienen operaciones. */
    function notImplemented() {
        return fail(501, "NOT_IMPLEMENTED", "Estructura creada. Operacion pendiente de implementar.");
    }

    return Object.freeze({ fail, ok, notImplemented });
});
