/**
 * Mapeo de campos de un record a JSON escalar. Recibe el esquema (que leer) desde quien lo invoca.
 * No hace: no conoce ningun modulo concreto, no carga records ni decide la respuesta ante un limite excedido.
 *
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define([], () => {
    "use strict";

    /**
     * Convierte "a b c" en { a: "a", b: "b", c: "c" } ({ campoRespuesta: campoNetSuite }).
     * @param {string} list IDs de campo separados por espacios o saltos de linea.
     * @returns {Object<string, string>} Mapa congelado.
     */
    function fieldMap(list) {
        return Object.freeze(
            Object.fromEntries(
                list
                    .trim()
                    .split(/\s+/)
                    .map((id) => [id, id]),
            ),
        );
    }

    /**
     * Aplica un lector a cada campo del mapa.
     * @param {Object<string, string>} map { campoRespuesta: campoNetSuite }.
     * @param {function(string): *} read Lector de un campo por ID.
     * @returns {Object<string, (string|boolean|null)>} { campoRespuesta: escalar }.
     */
    function mapFields(map, read) {
        return Object.fromEntries(Object.entries(map).map(([key, fieldId]) => [key, scalar(read(fieldId))]));
    }

    /**
     * Lector de cuerpo con valor crudo (getValue): montos, IDs y banderas.
     * @param {object} rec Record de NetSuite.
     * @returns {function(string): *} Lector por ID de campo.
     */
    function bodyValue(rec) {
        return (fieldId) => rec.getValue({ fieldId });
    }

    /**
     * Lector de cuerpo con valor formateado (getText): fechas, porcentajes y listas.
     * @param {object} rec Record de NetSuite.
     * @returns {function(string): *} Lector por ID de campo.
     */
    function bodyText(rec) {
        return (fieldId) => rec.getText({ fieldId });
    }

    /**
     * Lee una sublista como { "line 1": {...}, "line 2": {...} } (formato que consume el CRM).
     * @param {object} rec Record de NetSuite.
     * @param {string} sublistId ID de la sublista.
     * @param {{texts?: Object<string, string>, values?: Object<string, string>}} schema Campos por lectura getSublistText/Value.
     * @param {number} maxLines Tope de lineas; cada modulo decide su respuesta si se supera.
     * @returns {?Object<string, object>} Lineas, o null si supera maxLines (sin leer ninguna).
     * @throws {Error} "Invalid line count" si NetSuite devuelve un conteo que no es entero >= 0.
     */
    function readSublist(rec, sublistId, { texts = {}, values = {} }, maxLines) {
        const count = rec.getLineCount({ sublistId });
        // NetSuite devuelve -1 si la sublista no existe; cualquier valor no entero tambien es invalido.
        if (!Number.isInteger(count) || count < 0) throw new Error("Invalid line count");
        if (count > maxLines) return null;

        const lines = {};
        for (let line = 0; line < count; line++) {
            lines[`line ${line + 1}`] = {
                ...mapFields(texts, (fieldId) => rec.getSublistText({ sublistId, fieldId, line })),
                ...mapFields(values, (fieldId) => rec.getSublistValue({ sublistId, fieldId, line })),
            };
        }
        return lines;
    }

    /**
     * Normaliza a escalar serializable. Objetos, fechas, arrays y numeros no finitos -> null,
     * para que nunca se filtre la estructura interna del record. Los numeros salen como string (conversion del Number ya recibido).
     */
    function scalar(value) {
        if (typeof value === "string" || typeof value === "boolean") return value;
        return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
    }

    return Object.freeze({ fieldMap, mapFields, bodyValue, bodyText, readSublist });
});
