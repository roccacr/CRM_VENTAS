/**
 * MODULO salesOrders: lectura (GET), aprobacion de Formalizacion (PUT) y errores propios de la entidad.
 * No hace: no decide autenticacion, entorno ni enrutamiento (RL), ni transporte de eventos (NotificarCambio);
 * los IDs de campos viven en SS2_1_LIB_CRM_OrdenesVenta_Campos.js.
 *
 * Para agregar una accion PUT: escribir la funcion aqui y registrarla en `put`.
 *
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 */
define([
    "../../lib/SS2_1_LIB_CRM_Respuestas",
    "../../lib/SS2_1_LIB_CRM_Campos",
    "../../lib/SS2_1_LIB_CRM_Registros",
    "../../lib/SS2_1_LIB_CRM_ErroresProveedor",
    "../../lib/SS2_1_LIB_CRM_ConsultarPorId",
    "../../lib/SS2_1_LIB_CRM_EjecutarAccion",
    "./SS2_1_LIB_CRM_OrdenesVenta_Campos",
], (responses, fields, records, providerErrors, readByIdFlow, runActionFlow, SCHEMA) => {
    "use strict";

    const { fail, ok } = responses;
    const { mapFields, bodyValue, bodyText, readSublist } = fields;
    const { RECORD_TYPES, loadRecord, lookupFlags, writeFlag } = records;
    const { providerError } = providerErrors;
    const { readById } = readByIdFlow;
    const { runAction } = runActionFlow;

    /** Errores de esta entidad (los consume providerError). */
    const ERRORS = Object.freeze({
        notFound: Object.freeze({ code: "SALES_ORDER_NOT_FOUND", message: "La orden de venta no existe." }),
        readFailed: Object.freeze({
            code: "SALES_ORDER_READ_ERROR",
            message: "No se pudo consultar la orden de venta.",
        }),
    });

    /** Limita procesamiento y tamano de respuesta, no el costo inicial de record.load. */
    const MAX_ITEM_LINES = 1000;

    const { approvalField, cancelledField, prerequisiteFields } = SCHEMA.approval;
    const FIELDS_TO_CHECK = Object.freeze([cancelledField, ...prerequisiteFields, approvalField]);
    const UNKNOWN_OUTCOME_MESSAGE = "Resultado de aprobacion desconocido; consulta NetSuite antes de reintentar.";
    const STATE_CHANGED_MESSAGE =
        "Las aprobaciones de la orden cambiaron durante la operacion; consulta NetSuite antes de reintentar.";

    /**
     * GET: lee una orden de venta con la allowlist del esquema (1 record.load).
     *
     * @param {string} id ID interno de NetSuite ya validado.
     * @returns {object} 200 con campos y lineas, o 422 si supera el limite de lineas.
     * @throws {SuiteScriptError} Errores del proveedor (p. ej. RCRD_DSNT_EXIST); readById los traduce.
     */
    function getSalesOrderById(id, eventProjection = false) {
        const order = loadRecord(RECORD_TYPES.SALES_ORDER, id);

        // Si excede el limite de lineas se corta antes de construir el resto de la respuesta.
        const items = readSublist(order, "item", SCHEMA.itemLines, MAX_ITEM_LINES);
        if (items === null)
            return fail(422, "ITEM_LINE_LIMIT_EXCEEDED", `La orden supera el limite de ${MAX_ITEM_LINES} lineas.`);

        // Los lectores se crean una sola vez y se reutilizan en cada mapa.
        const readValue = bodyValue(order);
        const readText = bodyText(order);
        let projection = {};
        if (eventProjection) {
            // DATE representa calendario del record, no un instante UTC ni texto dependiente de preferencias.
            const date = readValue("trandate");
            if (!date || typeof date.getTime !== "function" || !Number.isFinite(date.getTime()))
                throw new Error("transaction_date_unavailable");
            // El legado usa el primer integrante de salesteam; salesrep no es su fuente de id_ov_admin.
            const team = SCHEMA.eventOwner;
            const owner =
                order.getSublists().includes(team.sublist) && order.getLineCount({ sublistId: team.sublist }) > 0
                    ? order.getSublistValue({ sublistId: team.sublist, fieldId: team.field, line: 0 })
                    : null;
            projection = {
                ...mapFields(SCHEMA.eventValues, readValue),
                crm_owner_employee: owner === null ? null : String(owner),
                crm_sync_projection: 1,
                crm_transaction_date: [
                    date.getFullYear(),
                    String(date.getMonth() + 1).padStart(2, "0"),
                    String(date.getDate()).padStart(2, "0"),
                ].join("-"),
            };
        }

        return {
            ...ok({
                type: RECORD_TYPES.SALES_ORDER,
                id,
                fields: {
                    ...mapFields(SCHEMA.bodyValues, readValue),
                    ...mapFields(SCHEMA.bodyTexts, readText),
                    ...projection,
                },
                sublists: { item: items },
            }),
            MOTIVO_COMPRA: null, // Fuente aun no confirmada por el propietario del proceso.
            ...mapFields(SCHEMA.rootTexts, readText),
        };
    }

    /**
     * PUT approveFormalization: activa la aprobacion de Formalizacion.
     * Antes de escribir un error es de lectura (404/502); desde la escritura cualquier fallo es "desconocido"
     * (502) porque submitFields o la relectura pueden fallar despues de persistir.
     *
     * @param {string} id ID interno de NetSuite ya validado.
     * @returns {object} 200 aprobada (o ya aprobada), 409 si no cumple reglas, error de lectura previa (404/502),
     *                   502 si el resultado de la escritura no se pudo confirmar.
     */
    function approveFormalization(id) {
        let flags;
        try {
            // lookupFields cuesta 1 unidad; record.load, 10 en transacciones. Con un ID inexistente se espera RCRD_DSNT_EXIST (pendiente de comprobar en Sandbox).
            flags = lookupFlags(RECORD_TYPES.SALES_ORDER, id, FIELDS_TO_CHECK);
        } catch (error) {
            return providerError(error, ERRORS);
        }

        // Comparacion estricta: solo el boolean `true` cuenta como aprobado.
        if (flags[cancelledField] === true) return fail(409, "SALES_ORDER_CANCELLED", "La orden esta caida.");
        // Idempotencia: si ya estaba aprobada no se escribe nada.
        if (flags[approvalField] === true) return approvedResponse(id, true);
        if (!prerequisiteFields.every((field) => flags[field] === true))
            return fail(
                409,
                "APPROVAL_PREREQUISITES_REQUIRED",
                "Se requieren las aprobaciones de Jefatura de Ventas y Desarrollador.",
            );

        return writeAndConfirm(id);
    }

    /**
     * Escribe la casilla y relee TODAS las casillas (1 unidad) para confirmar. NetSuite no ofrece una escritura
     * condicional, asi que no hay atomicidad: la relectura detecta que otro escritor cambio los requisitos o marco la
     * orden como caida entre la validacion y la escritura, y entonces no se confirma el exito.
     * La confirmacion exige evidencia completa: caida === false y requisitos === true; un valor omitido no basta.
     * Desde aqui un fallo puede haber persistido el cambio.
     */
    function writeAndConfirm(id) {
        try {
            writeFlag(RECORD_TYPES.SALES_ORDER, id, approvalField);
            const confirmed = lookupFlags(RECORD_TYPES.SALES_ORDER, id, FIELDS_TO_CHECK);
            if (confirmed[approvalField] !== true)
                return fail(502, "FORMALIZATION_APPROVAL_UNCONFIRMED", UNKNOWN_OUTCOME_MESSAGE);
            if (confirmed[cancelledField] !== false || !prerequisiteFields.every((field) => confirmed[field] === true))
                return fail(409, "APPROVAL_STATE_CHANGED", STATE_CHANGED_MESSAGE);
            return approvedResponse(id, false);
        } catch {
            return fail(502, "FORMALIZATION_APPROVAL_OUTCOME_UNKNOWN", UNKNOWN_OUTCOME_MESSAGE);
        }
    }

    /** Confirmacion que consume NestJS (el CRM exige exactamente esta forma). */
    function approvedResponse(id, alreadyApproved) {
        return ok({ type: RECORD_TYPES.SALES_ORDER, id, approval: "formalization", approved: true, alreadyApproved });
    }

    return Object.freeze({
        get: (request) => readById(request, getSalesOrderById, ERRORS),
        put: (request) => runAction(request, { approveFormalization }),
        // Lo consume NotificarCambio para construir el snapshot del evento.
        getSalesOrderById,
        getSalesOrderEventById: (id) => getSalesOrderById(id, true),
    });
});
