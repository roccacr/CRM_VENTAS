/**
 * Modulo "leads": reservado. GET y PUT responden NOT_IMPLEMENTED hasta que se apruebe su alcance.
 *
 * @NApiVersion 2.1
 */
define(["../../lib/SS2_1_LIB_CRM_Respuestas"], (responses) => {
    "use strict";

    const { notImplemented } = responses;

    return Object.freeze({ get: notImplemented, put: notImplemented });
});
