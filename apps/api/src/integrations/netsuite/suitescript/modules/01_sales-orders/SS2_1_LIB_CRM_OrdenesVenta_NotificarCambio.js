/**
 * Orden guardada: reutiliza la extraccion completa, incluso para xedit (datos parciales).
 * Archivador: /SuiteScripts/CRM TINK/modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta_NotificarCambio.js
 * @NApiVersion 2.1
 */
define(["../../lib/SS2_1_LIB_CRM_EnviarEvento", "./SS2_1_LIB_CRM_OrdenesVenta_ConsultarPorId"], (delivery, queries) => {
    "use strict";
    function afterSubmit(event) {
        return delivery.sendRecordEvent(event, queries.getSalesOrderById);
    }
    return Object.freeze({ afterSubmit });
});
