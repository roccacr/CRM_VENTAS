/**
 * Modulo "estimates": reservado. GET y PUT responden NOT_IMPLEMENTED hasta que se apruebe su alcance.
 * Cuando se implemente, cada accion va en su propio archivo numerado dentro de esta carpeta.
 *
 * @NApiVersion 2.1
 */
define(["../../lib/SS2_1_LIB_CRM_Respuestas"], (responses) => {
    "use strict";

    const { notImplemented } = responses;

    return Object.freeze({ get: notImplemented, put: notImplemented });
});
