/**
 * Orden guardada: reutiliza la lectura completa (incluso para xedit, con datos parciales) y la entrega al
 * receptor de ordenes del API en la forma que ese receptor exige.
 * Vive aparte de OrdenesVenta.js a proposito: el RESTlet no debe cargar N/https.
 * No hace: no escribe records ni reintenta; el transporte lo hace EnviarEvento.
 * Archivador: /SuiteScripts/CRM TINK/modules/01_sales-orders/SS2_1_LIB_CRM_OrdenesVenta_NotificarCambio.js
 *
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define(["../../lib/SS2_1_LIB_CRM_EnviarEvento", "./SS2_1_LIB_CRM_OrdenesVenta"], (delivery, salesOrders) => {
    "use strict";

    // Receptor propio de esta entidad. Un modulo nuevo (leads...) declara el suyo, p. ej. "lead-events".
    const ENDPOINT = "order-events";

    /**
     * @param {{recordType: string, netsuiteId: string, eventType: string}} event Evento ya validado.
     * @returns {{status: string, delivered: boolean}} Resultado del envio; nunca lanza.
     */
    function afterSubmit(event) {
        return delivery.sendRecordEvent(event, readEventSnapshot, ENDPOINT);
    }

    /**
     * El GET entrega las lineas como { "line 1": {...} } (contrato del CRM) pero el receptor de eventos espera
     * un arreglo; solo el envio adapta la forma, el GET conserva la suya.
     *
     * @param {string} id ID interno ya validado.
     * @returns {object} Snapshot con `sublists.item` como arreglo, o la respuesta de error del GET sin cambios.
     * @throws {SuiteScriptError} Errores del proveedor; EnviarEvento los convierte en delivery_failed.
     */
    function readEventSnapshot(id) {
        const snapshot = salesOrders.getSalesOrderById(id);
        if (snapshot.status !== 200) return snapshot;
        const { sublists } = snapshot.data;
        return {
            ...snapshot,
            data: { ...snapshot.data, sublists: { ...sublists, item: Object.values(sublists.item) } },
        };
    }

    return Object.freeze({ afterSubmit });
});
