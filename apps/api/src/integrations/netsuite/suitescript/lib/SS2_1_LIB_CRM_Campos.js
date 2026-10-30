/**
 * Mapeo de campos de un record a JSON escalar. No conoce ningun modulo concreto:
 * recibe el esquema (que leer) desde quien lo invoca.
 *
 * @NApiVersion 2.1
 */
define([], () => {
    "use strict";

    /** Convierte "a b c" en { a: "a", b: "b", c: "c" } ({ campoRespuesta: campoNetSuite }). */
    function fieldMap(list) {
        return Object.fromEntries(
            list
                .trim()
                .split(/\s+/)
                .map((id) => [id, id]),
        );
    }

    /**
     * Normaliza a escalar serializable. Objetos, fechas, arrays y numeros no finitos -> null,
     * para que nunca se filtre la estructura interna del record.
     */
    function scalar(value) {
        if (typeof value === "string" || typeof value === "boolean") return value;
        return typeof value === "number" && Number.isFinite(value) ? String(value) : null;
    }

    /** Aplica un lector a cada campo del mapa y devuelve { campoRespuesta: escalar }. */
    function mapFields(map, read) {
        return Object.fromEntries(Object.entries(map).map(([key, fieldId]) => [key, scalar(read(fieldId))]));
    }

    /** Lector de cuerpo con valor crudo (getValue): montos, IDs y banderas. */
    function bodyValue(rec) {
        return (fieldId) => rec.getValue({ fieldId });
    }

    /** Lector de cuerpo con valor formateado (getText): fechas, porcentajes y listas. */
    function bodyText(rec) {
        return (fieldId) => rec.getText({ fieldId });
    }

    /**
     * Lee una sublista como { "line 1": {...}, "line 2": {...} } (formato que consume el CRM).
     * Devuelve null si supera maxLines, para que cada modulo decida su respuesta.
     */
    function readSublist(rec, sublistId, { texts = {}, values = {} }, maxLines) {
        const count = rec.getLineCount({ sublistId });
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

    return Object.freeze({ fieldMap, scalar, mapFields, bodyValue, bodyText, readSublist });
});
