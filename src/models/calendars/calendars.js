const { executeStoredProcedure, executeQuery } = require("../conectionPool/conectionPool");
const { buildCalendarVisibilityScope } = require("./calendarVisibility");
const outlookCalendarSync = require("./outlookCalendarSync");
const outlookEvent = require("./outlookEvent");

const calendars = {};

/**
 * Obtiene los eventos visibles del calendario CRM.
 *
 * La visibilidad se resuelve por jerarquía real:
 * - usuario autenticado
 * - cualquier colaborador que dependa de él en `admins.id_supervisor_admin`
 *
 * @param {Object} dataParams - Parámetros de consulta.
 * @returns {Promise<Object>} Lista de eventos visibles.
 */
calendars.get_Calendars = (dataParams) => {
    const visibilityScope = buildCalendarVisibilityScope(dataParams.idnetsuite_admin);
    const query = `
        ${visibilityScope.cteSql}
        SELECT
            admins.name_admin,
            leads.nombre_lead,
            calendars.id_calendar,
            calendars.nombre_calendar,
            calendars.color_calendar,
            calendars.id_lead,
            calendars.fechaIni_calendar,
            calendars.fechaFin_calendar,
            calendars.horaInicio_calendar,
            calendars.horaFinal_calendar,
            calendars.decrip_calendar,
            calendars.tipo_calendar,
            calendars.cita_lead,
            CASE
                WHEN calendars.cita_lead = 1 OR calendars.masDeUnaCita_calendar = 1 THEN 'categoria5'
                WHEN calendars.tipo_calendar = 'Cita' THEN 'categoria5'
                WHEN calendars.tipo_calendar IN ('LLamada', 'Correo', 'Whatsapp') THEN 'categoria1'
                WHEN calendars.tipo_calendar = 'Tarea' THEN 'categoria2'
                WHEN calendars.tipo_calendar = 'Reunion' THEN 'categoria3'
                WHEN calendars.tipo_calendar = 'Seguimientos' THEN 'categoria4'
                ELSE NULL
            END AS categoria
        FROM calendars
        INNER JOIN admins ON admins.idnetsuite_admin = calendars.id_admin
        INNER JOIN leads ON leads.idinterno_lead = calendars.id_lead
        WHERE calendars.estado_calendar = 1
          AND calendars.accion_calendar = 'Pendiente'
          AND ${visibilityScope.predicateSql("calendars.id_admin")}
    `;

    return executeQuery(query, visibilityScope.params, dataParams.database).then((result) => ({
        ok: result.ok,
        statusCode: result.statusCode,
        0: result.data,
    }));
};

calendars.createEvent = (dataParams) =>
    executeStoredProcedure(
        "01_CREAR_EVENTO",
        [
            dataParams.nombreEvento,
            dataParams.colorEvento,
            dataParams.leadId,
            dataParams.idnetsuite_admin,
            dataParams.formatdateIni,
            dataParams.formatdateFin,
            dataParams.horaInicio,
            dataParams.horaFinal,
            dataParams.descripcionEvento,
            dataParams.tipoEvento,
            dataParams.citaValue,
            dataParams.citaValue,
            dataParams.citaValue,
            dataParams.id_proyecto || 0,
            dataParams.nombre_proyecto || 0,
            dataParams.copiaJefe || 0,
        ],
        dataParams.database,
    );

calendars.createOutlookEvent = (dataParams) =>
    outlookEvent.createOutlookEvent(dataParams);

calendars.updateOutlookEventSchedule = (dataParams) =>
    outlookEvent.updateOutlookEventSchedule(dataParams);

calendars.updateOutlookEventDetails = (dataParams) =>
    outlookEvent.updateOutlookEventDetails(dataParams);

calendars.registerOutlookCalendarSync = (dataParams) =>
    outlookCalendarSync.registerOutlookCalendarSync(dataParams);

calendars.processOutlookCalendarSync = (dataParams) =>
    outlookCalendarSync.processOutlookCalendarSync(dataParams);

calendars.getDataEevent = (dataParams) =>
    executeStoredProcedure(
        "28_OBTENER_DATOS_EVENTO",
        [dataParams.id],
        dataParams.database,
    );

calendars.get_event_Citas = (dataParams) =>
    executeStoredProcedure(
        "04_OBTENER_EVENTOS_CITAS",
        [dataParams.id],
        dataParams.database,
    );

calendars.editEvent = (dataParams) =>
    executeStoredProcedure(
        "02_EDITAR_EVENTO",
        [
            dataParams.id_calendar,
            dataParams.nombreEvento,
            dataParams.colorEvento,
            dataParams.leadId,
            dataParams.idnetsuite_admin,
            dataParams.formatdateIni,
            dataParams.formatdateFin,
            dataParams.horaInicio,
            dataParams.horaFinal,
            dataParams.descripcionEvento,
            dataParams.tipoEvento,
            dataParams.citaValue,
            dataParams.citaValue,
            dataParams.citaValue,
            dataParams.id_proyecto || 0,
            dataParams.nombre_proyecto || 0,
            dataParams.copiaJefe || 0,
        ],
        dataParams.database,
    );

calendars.update_event_MoveDate = (dataParams) =>
    executeStoredProcedure(
        "05_ACTUALIZAR_FECHA_EVENTO",
        [
            dataParams.id,
            dataParams.newDateStart,
            dataParams.newDateEnd,
        ],
        dataParams.database,
    );

calendars.update_Status_Event = (dataParams) => {
    let notificarCliente = 0;
    let correoEnviado = 0;

    if (dataParams.EstadoAccion === "Pendiente") {
        notificarCliente = 1;
        correoEnviado = 0;
    } else if (dataParams.EstadoAccion === "Cancelado") {
        notificarCliente = 4;
        correoEnviado = 0;
    } else if (dataParams.EstadoAccion === "Completado") {
        notificarCliente = 0;
        correoEnviado = 1;
    }

    return executeStoredProcedure(
        "06_MODIFICAR_ESTADO_EVENTO",
        [
            dataParams.id,
            dataParams.NewStatus,
            dataParams.EstadoAccion,
            notificarCliente,
            correoEnviado,
        ],
        dataParams.database,
    );
};

/**
 * Obtiene la lista completa de eventos visibles en un rango.
 *
 * Conserva el contrato del SP antiguo, pero reemplaza la visibilidad por
 * jerarquía real en lugar de depender de `rol_admin`.
 *
 * @param {Object} dataParams - Parámetros de consulta.
 * @returns {Promise<Object>} Lista completa de eventos visibles.
 */
calendars.getAll_ListEvent = (dataParams) => {
    const visibilityScope = buildCalendarVisibilityScope(dataParams.idnetsuite_admin);
    const query = `
        ${visibilityScope.cteSql}
        SELECT
            leads.*,
            calendars.*,
            admins.*
        FROM calendars AS calendars
        LEFT JOIN leads ON leads.idinterno_lead = calendars.id_lead
        LEFT JOIN admins ON calendars.id_admin = admins.idnetsuite_admin
        WHERE DATE_FORMAT(calendars.fechaIni_calendar, '%Y-%m-%dT%H:%i:%s')
              BETWEEN STR_TO_DATE(?, '%Y-%m-%dT%H:%i:%s')
                  AND STR_TO_DATE(CONCAT(?, ' 23:59:59'), '%Y-%m-%d %H:%i:%s')
          AND ${visibilityScope.predicateSql("calendars.id_admin")}
    `;

    return executeQuery(
        query,
        [
            ...visibilityScope.params,
            dataParams.dateStart,
            dataParams.dateEnd,
        ],
        dataParams.database,
    ).then((result) => ({
        ok: result.ok,
        statusCode: result.statusCode,
        0: result.data,
    }));
};

calendars.cancelOverduePendingEvents = async (dataParams) => {
    const query = `
        UPDATE calendars
        SET
            estado_calendar = 0,
            accion_calendar = 'Cancelado',
            NotificarCliente = 4,
            correoEnviado = 0
        WHERE estado_calendar = 1
          AND accion_calendar NOT IN ('Completado', 'Cancelado')
          AND (
                CASE
                    WHEN fechaIni_calendar LIKE '%:%:%'
                        THEN STR_TO_DATE(fechaIni_calendar, '%Y-%m-%dT%H:%i:%s')
                    ELSE STR_TO_DATE(fechaIni_calendar, '%Y-%m-%dT%H:%i')
                END
              ) < NOW() - INTERVAL 7 DAY
    `;

    return executeQuery(query, [], dataParams.database);
};

calendars.getPendingActionCalendarEvents = (dataParams) =>
    outlookEvent.getPendingActionCalendarEvents(dataParams);

module.exports = calendars;
