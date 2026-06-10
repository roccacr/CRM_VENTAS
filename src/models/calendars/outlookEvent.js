const { executeQuery } = require("../conectionPool/conectionPool");

const outlookEvent = {};

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

module.exports = outlookEvent;
