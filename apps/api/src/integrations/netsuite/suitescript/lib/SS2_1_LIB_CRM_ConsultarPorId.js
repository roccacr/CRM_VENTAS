/**
 * Flujo comun de GET por ID, reutilizable por cualquier modulo (ordenes, estimaciones...).
 * Responsabilidad unica: validar el ID, ejecutar la lectura del modulo y traducir errores.
 *
 * @NApiVersion 2.1
 */
define(["./SS2_1_LIB_CRM_Validacion", "./SS2_1_LIB_CRM_ErroresProveedor"], (validation, providerErrors) => {
    "use strict";

    const { invalidIdResponse } = validation;
    const { providerError } = providerErrors;

    /**
     * @param {object} request Solicitud ya validada como objeto por el enrutador.
     * @param {(id: string) => object} read Lectura propia del modulo; puede lanzar errores del proveedor.
     * @param {{notFound: object, readFailed: object}} errors Errores de lectura propios del modulo.
     * @returns {object} Respuesta de aplicacion (ok o fail).
     */
    function readById(request, read, errors) {
        const invalid = invalidIdResponse(request);
        if (invalid) return invalid;
        try {
            return read(request.id);
        } catch (error) {
            return providerError(error, errors);
        }
    }

    return Object.freeze({ readById });
});
