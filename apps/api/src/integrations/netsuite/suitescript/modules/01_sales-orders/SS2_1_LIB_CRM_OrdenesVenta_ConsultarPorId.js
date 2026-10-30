/**
 * ACCION GET: consulta una orden de venta por ID interno.
 * Solo arma la respuesta; validacion de ID y traduccion de errores las hace readById.
 *
 * @NApiVersion 2.1
 */
define([
    "../../lib/SS2_1_LIB_CRM_Respuestas",
    "../../lib/SS2_1_LIB_CRM_Campos",
    "../../lib/SS2_1_LIB_CRM_Registros",
    "./SS2_1_LIB_CRM_OrdenesVenta_Campos",
], (responses, fields, records, SCHEMA) => {
    "use strict";

    const { fail, ok } = responses;
    const { mapFields, bodyValue, bodyText, readSublist } = fields;
    const { types, loadRecord } = records;

    /** Limita procesamiento y tamano de respuesta, no el costo inicial de record.load. */
    const MAX_ITEM_LINES = 1000;

    /**
     * @param {string} id ID interno de NetSuite ya validado.
     * @returns {object} 200 con campos y lineas, o 422 si supera el limite de lineas.
     */
    function getSalesOrderById(id) {
        const order = loadRecord(types.SALES_ORDER, id);

        // Si excede el limite de lineas se corta antes de construir el resto de la respuesta.
        const items = readSublist(order, "item", SCHEMA.itemLines, MAX_ITEM_LINES);
        if (items === null)
            return fail(422, "ITEM_LINE_LIMIT_EXCEEDED", `La orden supera el limite de ${MAX_ITEM_LINES} lineas.`);

        // Los lectores se crean una sola vez y se reutilizan en cada mapa.
        const readValue = bodyValue(order);
        const readText = bodyText(order);

        return {
            ...ok({
                type: "salesorder",
                id,
                fields: { ...mapFields(SCHEMA.bodyValues, readValue), ...mapFields(SCHEMA.bodyTexts, readText) },
                sublists: { item: items },
            }),
            MOTIVO_COMPRA: null, // Fuente aun no confirmada por el propietario del proceso.
            ...mapFields(SCHEMA.rootTexts, readText),
        };
    }

    return Object.freeze({ getSalesOrderById });
});
