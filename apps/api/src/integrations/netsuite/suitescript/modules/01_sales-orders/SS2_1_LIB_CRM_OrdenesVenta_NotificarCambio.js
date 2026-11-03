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
define(["N/search", "N/format", "../../lib/SS2_1_LIB_CRM_EnviarEvento", "./SS2_1_LIB_CRM_OrdenesVenta"], (
    search,
    format,
    delivery,
    salesOrders,
) => {
    "use strict";

    // Receptor propio de esta entidad. Un modulo nuevo (leads...) declara el suyo, p. ej. "lead-events".
    const ENDPOINT = "order-events";
    const FLAGS = [
        "custbody90",
        "custbody51",
        "custbody91",
        "custbody105",
        "custbody43",
        "custbody103",
        "custbody_ix_comision_pagada",
        "custbody_entrega_de_llaves",
        "custbody274",
        "custbody_cuotas_pagadas",
    ];

    /** La fecha es columna de busqueda Transaction, no campo documentado de record.load(SalesOrder). */
    function sourceVersion(id) {
        const values = search.lookupFields({ type: "salesorder", id, columns: ["lastmodifieddate", ...FLAGS] });
        // parse respeta las preferencias del mismo usuario/contexto que produjo el texto; no imponer UTC.
        const date = format.parse({ value: values.lastmodifieddate, type: format.Type.DATETIME });
        if (!date || typeof date.getTime !== "function" || !Number.isFinite(date.getTime()))
            throw new Error("source_version_unavailable");
        if (!FLAGS.every((field) => typeof values[field] === "boolean")) throw new Error("source_flags_unavailable");
        return { modifiedAt: date.toISOString(), flags: FLAGS.map((field) => values[field]) };
    }

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
        const snapshotReadStartedAt = new Date().toISOString();
        const before = sourceVersion(id);
        const snapshot = salesOrders.getSalesOrderEventById(id);
        if (snapshot.status !== 200) return snapshot;
        // La marca del proveedor pierde segundos en esta cuenta: cotejar tambien todos los valores y lineas.
        const confirmed = salesOrders.getSalesOrderEventById(id);
        const after = sourceVersion(id);
        const snapshotFlags = FLAGS.map((field) => snapshot.data.fields[field]);
        if (
            JSON.stringify(snapshot) !== JSON.stringify(confirmed) ||
            before.modifiedAt !== after.modifiedAt ||
            JSON.stringify(before.flags) !== JSON.stringify(after.flags) ||
            JSON.stringify(snapshotFlags) !== JSON.stringify(after.flags)
        )
            throw new Error("snapshot_changed");
        const { sublists } = snapshot.data;
        return {
            ...snapshot,
            sourceModifiedAt: after.modifiedAt,
            snapshotReadStartedAt,
            snapshotReadCompletedAt: new Date().toISOString(),
            data: { ...snapshot.data, sublists: { ...sublists, item: Object.values(sublists.item) } },
        };
    }

    return Object.freeze({ afterSubmit });
});
