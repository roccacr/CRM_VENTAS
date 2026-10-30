/**
 * MODULO salesOrders: ensambla sus acciones. No contiene logica propia.
 *   GET -> SS2_1_LIB_CRM_OrdenesVenta_ConsultarPorId.js          PUT approveFormalization -> SS2_1_LIB_CRM_OrdenesVenta_AprobarFormalizacion.js
 * Para agregar una accion: crear su archivo SS2_1_LIB_CRM correspondiente y registrarla aqui.
 *
 * @NApiVersion 2.1
 */
define([
    "../../lib/SS2_1_LIB_CRM_ConsultarPorId",
    "../../lib/SS2_1_LIB_CRM_EjecutarAccion",
    "./SS2_1_LIB_CRM_OrdenesVenta_Errores",
    "./SS2_1_LIB_CRM_OrdenesVenta_ConsultarPorId",
    "./SS2_1_LIB_CRM_OrdenesVenta_AprobarFormalizacion",
], (readByIdFlow, runActionFlow, ERRORS, getById, approveFormalizationAction) => {
    "use strict";

    const { readById } = readByIdFlow;
    const { runAction } = runActionFlow;
    const { getSalesOrderById } = getById;
    const { approveFormalization } = approveFormalizationAction;

    return Object.freeze({
        get: (request) => readById(request, getSalesOrderById, ERRORS),
        put: (request) => runAction(request, { approveFormalization }),
    });
});
