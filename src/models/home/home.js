const { executeStoredProcedure, handleDatabaseOperation, executeQuery } = require("../conectionPool/conectionPool");

const home = {};

home.getAllBanners = (dataParams) =>
    executeStoredProcedure("37_OBTENER_TODOS_LOS_BANNERS", [dataParams.rol_admin, dataParams.idnetsuite_admin], dataParams.database);

home.getAllEventsHome = (dataParams) =>
    executeStoredProcedure("17_EVENTOS_PENDIENTES_INICIO", [dataParams.rol_admin, dataParams.idnetsuite_admin], dataParams.database);

home.updateEventStatus = (dataParams) =>
    handleDatabaseOperation(async (connection) => {
        const [result] = await connection.execute(`CALL 15_ACTUALIZAR_ESTADO_EVENTO_INICIO(?, ?)`, [
            dataParams.newStatus,
            dataParams.id_calendar,
        ]);

        return {
            statusCode: result.affectedRows > 0 ? 200 : 210,
            data: result,
        };
    }, dataParams.database);

home.fetchGetMonthlyDataKpi = (dataParams) =>
    executeStoredProcedure(
        "09_GRAFICOS_MENSUALES_KPI",
        [dataParams.rol_admin, dataParams.idnetsuite_admin, dataParams.startDate, dataParams.endDate],
        dataParams.database,
    );

home.getMonthlyData_venta = (dataParams) =>
    executeStoredProcedure(
        "40_GRAFICO_RESERVA_HOME",
        [dataParams.rol_admin, dataParams.idnetsuite_admin, dataParams.startDate, dataParams.endDate],
        dataParams.database,
    );

home.getMonthlyData = (dataParams) =>
    executeStoredProcedure(
        "10_GRAFICOS_MENSUALES",
        [dataParams.rol_admin, dataParams.idnetsuite_admin, dataParams.startDate, dataParams.endDate],
        dataParams.database,
    );

home.fetchupdateEventDate = (dataParams) =>
    executeStoredProcedure("16_ACTUALIZAR_FECHA_EVENTO_INICIO", [dataParams.eventId, dataParams.selectedValue], dataParams.database);

/**
 * Obtiene notificaciones CRM de pre-reservas vencidas y OV por vencer.
 *
 * `rol_admin = 1` ve todo. Resto solo registros propios:
 * `estimaciones.idAdmin_est` y `ordenventa.id_ov_admin`.
 *
 * @param {Object} dataParams - Parámetros de consulta.
 * @returns {Promise<Object>} Lista de notificaciones.
 */
home.getNotifications = async (dataParams) => {
    const isAdmin = String(dataParams.rol_admin) === "1";
    const ownerParams = isAdmin ? [] : [dataParams.idnetsuite_admin, dataParams.idnetsuite_admin];
    const ownerFilterEstimacion = isAdmin ? "" : "AND e.idAdmin_est = ?";
    const ownerFilterOrdenVenta = isAdmin ? "" : "AND o.id_ov_admin = ?";

    const parseDateExpression = (fieldName) => `
        CASE
            WHEN ${fieldName} IS NULL OR TRIM(${fieldName}) = '' THEN NULL
            WHEN ${fieldName} LIKE '%/%' THEN STR_TO_DATE(${fieldName}, '%d/%m/%Y')
            ELSE STR_TO_DATE(${fieldName}, '%Y-%m-%d')
        END
    `;

    const preReservaDate = parseDateExpression("e.envioPreReserva");
    const reservaDate = parseDateExpression("o.envioReserva");

    const query = `
        SELECT *
        FROM (
            SELECT
                CONCAT('estimacion-', e.idEstimacion_est) AS notification_id,
                'estimacion' AS notification_type,
                'Pre-reserva' AS stage_label,
                e.idLead_est AS lead_id,
                e.idEstimacion_est AS transaction_id,
                e.tranid_est AS reference_code,
                l.nombre_lead AS customer_name,
                l.proyecto_lead AS project_name,
                l.campana_lead AS campaign_name,
                l.custentityaccion_campana AS campaign_action,
                a.name_admin AS advisor_name,
                CONCAT(
                    'Pre-reserva ',
                    e.tranid_est,
                    ' lleva ',
                    DATEDIFF(CURDATE(), ${preReservaDate}),
                    ' días sin pasar a reserva'
                ) AS message,
                DATEDIFF(CURDATE(), ${preReservaDate}) AS priority_days,
                ${preReservaDate} AS reference_date,
                ${preReservaDate} AS source_date,
                DATE_ADD(${preReservaDate}, INTERVAL 14 DAY) AS due_date,
                DATEDIFF(CURDATE(), ${preReservaDate}) AS age_days,
                NULL AS days_to_due,
                DATEDIFF(CURDATE(), DATE_ADD(${preReservaDate}, INTERVAL 14 DAY)) AS overdue_days
            FROM estimaciones AS e
            INNER JOIN admins AS a ON a.idnetsuite_admin = e.idAdmin_est
            INNER JOIN leads AS l ON l.idinterno_lead = e.idLead_est
            WHERE e.pre_reserva = 1
              AND e.pre_caida = 0
              AND e.status = 1
              AND ${preReservaDate} IS NOT NULL
              AND DATEDIFF(CURDATE(), ${preReservaDate}) >= 14
              AND NOT EXISTS (
                  SELECT 1
                  FROM ordenventa AS ov
                  WHERE ov.id_ov_est = e.idEstimacion_est
                    AND ov.status_ov = 1
                    AND ov.caida_ov = 0
                    AND ov.reserva_ov = 1
              )
              ${ownerFilterEstimacion}

            UNION ALL

            SELECT
                CONCAT('ordenventa-', o.id_ov_netsuite) AS notification_id,
                'ordenventa' AS notification_type,
                'Orden de venta' AS stage_label,
                o.id_ov_lead AS lead_id,
                o.id_ov_netsuite AS transaction_id,
                o.id_ov_tranid AS reference_code,
                l.nombre_lead AS customer_name,
                l.proyecto_lead AS project_name,
                l.campana_lead AS campaign_name,
                l.custentityaccion_campana AS campaign_action,
                a.name_admin AS advisor_name,
                CASE
                    WHEN DATEDIFF(DATE_ADD(${reservaDate}, INTERVAL 30 DAY), CURDATE()) = 0 THEN
                        CONCAT('OV ', o.id_ov_tranid, ' vence hoy')
                    WHEN DATEDIFF(DATE_ADD(${reservaDate}, INTERVAL 30 DAY), CURDATE()) < 0 THEN
                        CONCAT('OV ', o.id_ov_tranid, ' lleva ', ABS(DATEDIFF(DATE_ADD(${reservaDate}, INTERVAL 30 DAY), CURDATE())), ' días vencida')
                    ELSE
                        CONCAT(
                            'OV ',
                            o.id_ov_tranid,
                            ' vence en ',
                            DATEDIFF(DATE_ADD(${reservaDate}, INTERVAL 30 DAY), CURDATE()),
                            ' días'
                        )
                END AS message,
                DATEDIFF(DATE_ADD(${reservaDate}, INTERVAL 30 DAY), CURDATE()) AS priority_days,
                ${reservaDate} AS reference_date,
                ${reservaDate} AS source_date,
                DATE_ADD(${reservaDate}, INTERVAL 30 DAY) AS due_date,
                DATEDIFF(CURDATE(), ${reservaDate}) AS age_days,
                DATEDIFF(DATE_ADD(${reservaDate}, INTERVAL 30 DAY), CURDATE()) AS days_to_due,
                GREATEST(DATEDIFF(CURDATE(), DATE_ADD(${reservaDate}, INTERVAL 30 DAY)), 0) AS overdue_days
            FROM ordenventa AS o
            INNER JOIN admins AS a ON a.idnetsuite_admin = o.id_ov_admin
            INNER JOIN leads AS l ON l.idinterno_lead = o.id_ov_lead
            WHERE o.reserva_ov = 1
              AND o.caida_ov = 0
              AND o.status_ov = 1
              AND o.cierre_firmado_ov = 0
              AND ${reservaDate} IS NOT NULL
              AND DATEDIFF(DATE_ADD(${reservaDate}, INTERVAL 30 DAY), CURDATE()) <= 5
              ${ownerFilterOrdenVenta}
        ) AS notifications
        ORDER BY
            CASE
                WHEN notification_type = 'estimacion' THEN 0
                ELSE 1
            END,
            priority_days DESC,
            reference_date ASC
    `;

    return executeQuery(query, ownerParams, dataParams.database);
};

module.exports = home;
