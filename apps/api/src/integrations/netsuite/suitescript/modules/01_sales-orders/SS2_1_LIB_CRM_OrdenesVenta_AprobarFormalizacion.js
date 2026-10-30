/**
 * ACCION PUT approveFormalization: activa la aprobacion de Formalizacion de una orden de venta.
 * Toda la logica de esta accion vive aqui; solo usa piezas globales de lib/ (respuestas y acceso a NetSuite).
 *
 * Flujo (carga y lector compartidos con GET; submitFields y relectura solo al escribir):
 *   1. Acredita existencia y lee banderas -> si falla, error de lectura (404/502): NO hubo escritura.
 *   2. Rechaza (409) si la orden esta caida.
 *   3. Si ya estaba aprobada responde 200 sin escribir; si no, exige las aprobaciones previas.
 *   4. Escribe SOLO custbodyid_firma_rc y relee para confirmar lo persistido.
 *   5. Cualquier fallo desde la escritura -> 502 "resultado desconocido",
 *      porque submitFields o la relectura pueden fallar despues de persistir.
 *
 * @NApiVersion 2.1
 */
define([
    "../../lib/SS2_1_LIB_CRM_Respuestas",
    "../../lib/SS2_1_LIB_CRM_Registros",
    "../../lib/SS2_1_LIB_CRM_ErroresProveedor",
    "./SS2_1_LIB_CRM_OrdenesVenta_Errores",
    "../../lib/SS2_1_LIB_CRM_Campos",
], (responses, records, providerErrors, ERRORS, fields) => {
    "use strict";

    const { fail, ok } = responses;
    const { types, loadRecord, lookupFlags, writeFlag } = records;
    const { providerError } = providerErrors;
    const { bodyValue } = fields;

    // ---- Campos de NetSuite involucrados --------------------------------
    const APPROVAL_FIELD = "custbodyid_firma_rc"; // Aprobacion de Formalizacion (la unica que se escribe).
    const CANCELLED_FIELD = "custbody43"; // Orden caida.
    const PREREQUISITE_FIELDS = ["custbody_aprueba_jefe_ventas", "custbodyid_firma_rocca"]; // Jefatura de Ventas y Desarrollador.
    const FIELDS_TO_CHECK = [CANCELLED_FIELD, ...PREREQUISITE_FIELDS, APPROVAL_FIELD];

    // ---- Respuestas propias de esta accion ------------------------------
    const UNKNOWN_OUTCOME_MESSAGE = "Resultado de aprobacion desconocido; consulta NetSuite antes de reintentar.";

    /**
     * @param {string} id ID interno de NetSuite ya validado.
     * @returns {object} 200 aprobada (o ya aprobada), 409 si no cumple reglas, 404/502 si falla la lectura previa,
     *                   502 si el resultado de la escritura no se pudo confirmar.
     */
    function approveFormalization(id) {
        // 1. Lectura previa: aun no se escribio nada, el error es de lectura y no "desconocido".
        let flags;
        try {
            // Misma carga y lector que GET: acredita existencia y reutiliza el record, sin otra consulta inicial.
            const order = loadRecord(types.SALES_ORDER, id);
            const readValue = bodyValue(order);
            flags = Object.fromEntries(FIELDS_TO_CHECK.map((fieldId) => [fieldId, readValue(fieldId)]));
        } catch (error) {
            return providerError(error, ERRORS);
        }

        // 2. Reglas de negocio. Comparacion estricta: solo el boolean `true` cuenta como aprobado.
        if (flags[CANCELLED_FIELD] === true) return fail(409, "SALES_ORDER_CANCELLED", "La orden esta caida.");
        // 3. Idempotencia: si ya estaba aprobada no se escribe nada.
        const alreadyApproved = flags[APPROVAL_FIELD] === true;
        const result = ok({ type: "salesorder", id, approval: "formalization", approved: true, alreadyApproved });
        if (alreadyApproved) return result;

        if (!PREREQUISITE_FIELDS.every((field) => flags[field] === true))
            return fail(
                409,
                "APPROVAL_PREREQUISITES_REQUIRED",
                "Se requieren las aprobaciones de Jefatura de Ventas y Desarrollador.",
            );

        // 4-5. Escritura y confirmacion. Desde aqui un fallo puede haber persistido el cambio.
        try {
            writeFlag(types.SALES_ORDER, id, APPROVAL_FIELD);
            const confirmed = lookupFlags(types.SALES_ORDER, id, [APPROVAL_FIELD]);
            if (confirmed[APPROVAL_FIELD] !== true)
                return fail(502, "FORMALIZATION_APPROVAL_UNCONFIRMED", UNKNOWN_OUTCOME_MESSAGE);
            return result;
        } catch {
            return fail(502, "FORMALIZATION_APPROVAL_OUTCOME_UNKNOWN", UNKNOWN_OUTCOME_MESSAGE);
        }
    }

    return Object.freeze({ approveFormalization });
});
