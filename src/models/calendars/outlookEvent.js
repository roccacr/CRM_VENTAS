const { executeQuery } = require("../conectionPool/conectionPool");
const { validateCrmCalendarOwnership } = require("./outlookEventOwnership");

const outlookEvent = {};
const DEFAULT_OUTLOOK_EVENT_COLOR = "#2a5f79";
const OUTLOOK_EVENT_COLOR_BY_TYPE = {
    Llamada: "#808080",
    Whatsapp: "#808080",
    Correo: "#808080",
    Tarea: "#343a40",
    Reunion: "#34c38f",
    Seguimientos: "#f46a6a",
    Cita: "#f1b44c",
};

const normalizeIntegerValue = (value, fallback = 0) => {
    const parsedValue = Number(value);

    return Number.isFinite(parsedValue) ? parsedValue : fallback;
};

const normalizeStringValue = (value, fallback = "") => (
    typeof value === "string" && value.trim() ? value.trim() : fallback
);

const normalizeNullableStringValue = (value) => (
    typeof value === "string" && value.trim() ? value.trim() : null
);

const resolveEventColor = (tipoEvento, colorEvento) => {
    const explicitColor = normalizeStringValue(colorEvento);

    if (explicitColor) {
        return explicitColor;
    }

    return OUTLOOK_EVENT_COLOR_BY_TYPE[tipoEvento] || DEFAULT_OUTLOOK_EVENT_COLOR;
};

/**
 * Obtiene eventos activos con accion `Pendiente` y agrega datos basicos del lead y admin relacionados.
 *
 * @param {Object} dataParams - Parametros de ejecucion.
 * @param {string} dataParams.database - Base de datos objetivo.
 * @param {number|string} dataParams.rol_admin - Rol del admin autenticado.
 * @param {number|string} dataParams.idnetsuite_admin - ID NetSuite del admin autenticado.
 * @returns {Promise<Object>} Resultado de la consulta.
 */
outlookEvent.getPendingActionCalendarEvents = async (dataParams) => {

    const rolAdmin = dataParams.rol_admin ?? null;
    const idNetsuiteAdmin = dataParams.idnetsuite_admin ?? null;

    const query = `
        SELECT
            c.*,
            l.idnetsuite_lead,
            l.idinterno_lead,
            l.nombre_lead,
            l.email_lead,
            l.telefono_lead,
            a.id_admin AS admin_id_admin,
            a.idnetsuite_admin,
            a.id_rol_admin,
            a.name_admin,
            a.email_admin
        FROM calendars AS c
        LEFT JOIN leads AS l
            ON l.idinterno_lead = c.id_lead
        LEFT JOIN admins AS a
            ON a.idnetsuite_admin = c.id_admin
        WHERE c.accion_calendar = ?
          AND c.estado_calendar = ?
          AND (
                ? = 1
                OR c.id_admin = ?
              )
          AND (
                CASE
                    WHEN c.fechaIni_calendar LIKE '%:%:%'
                        THEN STR_TO_DATE(c.fechaIni_calendar, '%Y-%m-%dT%H:%i:%s')
                    ELSE STR_TO_DATE(c.fechaIni_calendar, '%Y-%m-%dT%H:%i')
                END
              ) >= STR_TO_DATE(?, '%Y-%m-%d')
          AND (
                CASE
                    WHEN c.fechaIni_calendar LIKE '%:%:%'
                        THEN STR_TO_DATE(c.fechaIni_calendar, '%Y-%m-%dT%H:%i:%s')
                    ELSE STR_TO_DATE(c.fechaIni_calendar, '%Y-%m-%dT%H:%i')
                END
              ) < DATE_ADD(STR_TO_DATE(?, '%Y-%m-%d'), INTERVAL 1 DAY)
        ORDER BY
            CASE
                WHEN c.fechaIni_calendar LIKE '%:%:%'
                    THEN STR_TO_DATE(c.fechaIni_calendar, '%Y-%m-%dT%H:%i:%s')
                ELSE STR_TO_DATE(c.fechaIni_calendar, '%Y-%m-%dT%H:%i')
            END ASC,
            c.id_calendar ASC
    `;

    const result = await executeQuery(
        query,
        [
            "Pendiente",
            1,
            rolAdmin,
            idNetsuiteAdmin,
            dataParams.dateStart,
            dataParams.dateEnd,
        ],
        dataParams.database,
    );




    if (result?.ok) {
        const totalEventos = Array.isArray(result.data) ? result.data.length : 0;
        console.log(`[calendars] eventos pendientes cargados: ${totalEventos}`);
    }

    return result;
};

/**
 * Crea registro local de calendario para un evento ya creado en Outlook.
 *
 * Mantiene contrato de CRM sin tocar el SP legado `01_CREAR_EVENTO`,
 * porque ese flujo no soporta `outlook_event_id`.
 *
 * @param {Object} dataParams - Parametros de insercion.
 * @param {string} dataParams.database - Base objetivo.
 * @returns {Promise<Object>} Resultado del INSERT.
 */
outlookEvent.createOutlookEvent = async (dataParams) => {
    const tipoEvento = normalizeStringValue(dataParams.tipoEvento);
    const nombreEvento = normalizeStringValue(dataParams.nombreEvento);
    const descripcionEvento = normalizeStringValue(dataParams.descripcionEvento);
    const fechaInicio = normalizeStringValue(dataParams.formatdateIni);
    const fechaFin = normalizeStringValue(dataParams.formatdateFin);
    const horaInicio = normalizeStringValue(dataParams.horaInicio);
    const horaFinal = normalizeStringValue(dataParams.horaFinal);
    const nombreProyecto = normalizeStringValue(dataParams.nombre_proyecto, "0");
    const outlookEventId = normalizeStringValue(dataParams.outlook_event_id);
    const citaValue = tipoEvento === "Cita"
        ? 1
        : normalizeIntegerValue(dataParams.citaValue, 0);

    const query = `
        INSERT INTO calendars (
            nombre_calendar,
            color_calendar,
            id_lead,
            id_admin,
            id_oportunidad,
            fechaIni_calendar,
            fechaFin_calendar,
            horaInicio_calendar,
            horaFinal_calendar,
            estado_calendar,
            accion_calendar,
            noticia_calendar,
            decrip_calendar,
            mostrar_calendar,
            fechCcomprador_calendar,
            tipo_calendar,
            cita_lead,
            citas_chek,
            supervisor_chek,
            progreso_calendar,
            hora_calendar,
            cancelado,
            masDeUnaCita_calendar,
            id_proyecto,
            nombre_proyecto,
            copiaJefe,
            NotificarCliente,
            idEventoProgramado,
            outlook_event_id,
            correoEnviado
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
        nombreEvento,
        resolveEventColor(tipoEvento, dataParams.colorEvento),
        normalizeIntegerValue(dataParams.leadId, 0),
        normalizeIntegerValue(dataParams.idnetsuite_admin, 0),
        normalizeIntegerValue(dataParams.id_oportunidad, 0),
        fechaInicio,
        fechaFin,
        horaInicio,
        horaFinal,
        1,
        "Pendiente",
        normalizeIntegerValue(dataParams.noticia_calendar, 4),
        descripcionEvento,
        normalizeIntegerValue(dataParams.mostrar_calendar, 0),
        normalizeNullableStringValue(dataParams.fechCcomprador_calendar),
        tipoEvento,
        citaValue,
        citaValue,
        normalizeIntegerValue(dataParams.supervisor_chek, 0),
        normalizeIntegerValue(dataParams.progreso_calendar, 0),
        normalizeStringValue(dataParams.hora_calendar, "00"),
        normalizeStringValue(dataParams.cancelado, "--"),
        citaValue,
        normalizeIntegerValue(dataParams.id_proyecto, 0),
        nombreProyecto,
        normalizeIntegerValue(dataParams.copiaJefe, 1),
        normalizeIntegerValue(dataParams.NotificarCliente, 1),
        normalizeStringValue(dataParams.idEventoProgramado, "0"),
        outlookEventId,
        normalizeIntegerValue(dataParams.correoEnviado, 0),
    ];

    return executeQuery(query, params, dataParams.database);
};

/**
 * Actualiza rango fecha/hora del evento local CRM.
 *
 * @param {Object} dataParams - Datos de actualización.
 * @param {number|string} dataParams.id_calendar - ID interno CRM.
 * @param {string} dataParams.formatdateIni - Nuevo inicio ISO local.
 * @param {string} dataParams.formatdateFin - Nuevo fin ISO local.
 * @param {string} dataParams.horaInicio - Nueva hora inicio HH:mm.
 * @param {string} dataParams.horaFinal - Nueva hora fin HH:mm.
 * @returns {Promise<Object>} Resultado del UPDATE.
 */
outlookEvent.updateOutlookEventSchedule = async (dataParams) => {
    const eventLookupQuery = `
        SELECT
            c.id_calendar,
            c.id_admin,
            a.name_admin,
            a.email_admin
        FROM calendars AS c
        LEFT JOIN admins AS a
            ON a.idnetsuite_admin = c.id_admin
        WHERE c.id_calendar = ?
        LIMIT 1
    `;
    const eventLookupResult = await executeQuery(
        eventLookupQuery,
        [normalizeIntegerValue(dataParams.id_calendar, 0)],
        dataParams.database,
    );

    if (!eventLookupResult?.ok) {
        return eventLookupResult;
    }

    const eventRecord = Array.isArray(eventLookupResult.data) ? eventLookupResult.data[0] : null;
    const ownershipValidation = validateCrmCalendarOwnership(
        eventRecord,
        dataParams.idnetsuite_admin,
    );

    if (!ownershipValidation.ok) {
        return {
            ok: false,
            statusCode: ownershipValidation.statusCode,
            message: ownershipValidation.message,
            data: {
                ok: false,
                code: ownershipValidation.code,
                ownerName: ownershipValidation.ownerName,
                ownerEmail: ownershipValidation.ownerEmail,
            },
        };
    }

    const query = `
        UPDATE calendars
        SET
            fechaIni_calendar = ?,
            fechaFin_calendar = ?,
            horaInicio_calendar = ?,
            horaFinal_calendar = ?
        WHERE id_calendar = ?
        LIMIT 1
    `;

    const params = [
        normalizeStringValue(dataParams.formatdateIni),
        normalizeStringValue(dataParams.formatdateFin),
        normalizeStringValue(dataParams.horaInicio),
        normalizeStringValue(dataParams.horaFinal),
        normalizeIntegerValue(dataParams.id_calendar, 0),
    ];

    return executeQuery(query, params, dataParams.database);
};

/**
 * Actualiza datos editables del evento local CRM vinculado con Outlook.
 *
 * @param {Object} dataParams - Datos de actualización.
 * @param {number|string} dataParams.id_calendar - ID interno CRM.
 * @returns {Promise<Object>} Resultado del UPDATE.
 */
outlookEvent.updateOutlookEventDetails = async (dataParams) => {
    const calendarId = normalizeIntegerValue(dataParams.id_calendar, 0);
    const eventLookupQuery = `
        SELECT
            c.id_calendar,
            c.id_admin,
            a.name_admin,
            a.email_admin
        FROM calendars AS c
        LEFT JOIN admins AS a
            ON a.idnetsuite_admin = c.id_admin
        WHERE c.id_calendar = ?
        LIMIT 1
    `;
    const eventLookupResult = await executeQuery(
        eventLookupQuery,
        [calendarId],
        dataParams.database,
    );

    if (!eventLookupResult?.ok) {
        return eventLookupResult;
    }

    const eventRecord = Array.isArray(eventLookupResult.data) ? eventLookupResult.data[0] : null;
    const ownershipValidation = validateCrmCalendarOwnership(
        eventRecord,
        dataParams.idnetsuite_admin,
    );

    if (!ownershipValidation.ok) {
        return {
            ok: false,
            statusCode: ownershipValidation.statusCode,
            message: ownershipValidation.message,
            data: {
                ok: false,
                code: ownershipValidation.code,
                ownerName: ownershipValidation.ownerName,
                ownerEmail: ownershipValidation.ownerEmail,
            },
        };
    }

    const tipoEvento = normalizeStringValue(dataParams.tipoEvento);
    const citaValue = tipoEvento === "Cita"
        ? 1
        : normalizeIntegerValue(dataParams.citaValue, 0);
    const nombreProyecto = normalizeStringValue(dataParams.nombre_proyecto, "0");
    const query = `
        UPDATE calendars
        SET
            nombre_calendar = ?,
            color_calendar = ?,
            id_lead = ?,
            fechaIni_calendar = ?,
            fechaFin_calendar = ?,
            horaInicio_calendar = ?,
            horaFinal_calendar = ?,
            decrip_calendar = ?,
            tipo_calendar = ?,
            cita_lead = ?,
            citas_chek = ?,
            masDeUnaCita_calendar = ?,
            id_proyecto = ?,
            nombre_proyecto = ?,
            copiaJefe = ?
        WHERE id_calendar = ?
        LIMIT 1
    `;

    const params = [
        normalizeStringValue(dataParams.nombreEvento),
        resolveEventColor(tipoEvento, dataParams.colorEvento),
        normalizeIntegerValue(dataParams.leadId, 0),
        normalizeStringValue(dataParams.formatdateIni),
        normalizeStringValue(dataParams.formatdateFin),
        normalizeStringValue(dataParams.horaInicio),
        normalizeStringValue(dataParams.horaFinal),
        normalizeStringValue(dataParams.descripcionEvento),
        tipoEvento,
        citaValue,
        citaValue,
        citaValue,
        normalizeIntegerValue(dataParams.id_proyecto, 0),
        nombreProyecto,
        normalizeIntegerValue(dataParams.copiaJefe, 1),
        calendarId,
    ];

    return executeQuery(query, params, dataParams.database);
};

module.exports = outlookEvent;
