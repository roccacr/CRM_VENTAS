/**
 * Formas de respuesta del RESTlet: una sola forma de exito y una sola de error,
 * para que el CRM interprete cualquier modulo igual.
 * No hace: no conoce HTTP, modulos ni NetSuite; `status` es el JSON de aplicacion, no el HTTP del transporte.
 *
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define([], () => {
    "use strict";

    /**
     * Error de aplicacion.
     * @param {number} status Codigo de aplicacion (400, 404, 409, 502...).
     * @param {string} code Codigo estable y legible por maquina.
     * @param {string} message Mensaje saneado, sin texto del proveedor.
     * @returns {{status: number, error: {code: string, message: string}}}
     */
    function fail(status, code, message) {
        return { status, error: { code, message } };
    }

    /**
     * Exito de aplicacion (status 200).
     * @param {object} data Carga util serializable.
     * @returns {{status: number, data: object}}
     */
    function ok(data) {
        return { status: 200, data };
    }

    /**
     * Respuesta de los modulos reservados que aun no tienen operaciones.
     * @returns {{status: number, error: {code: string, message: string}}} 501 NOT_IMPLEMENTED.
     */
    function notImplemented() {
        return fail(501, "NOT_IMPLEMENTED", "Estructura creada. Operacion pendiente de implementar.");
    }

    return Object.freeze({ fail, ok, notImplemented });
});
