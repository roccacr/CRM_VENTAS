import { formatDate } from "../../../../hook/useFormatDate";


/**
 * Formatea la fecha y hora en un formato legible
 * @param {string} date - Fecha en formato ISO o timestamp
 * @returns {string} Fecha y hora formateada
 */
const formatDateTime = (date) => {
    const { formattedDate, formattedTime } = formatDate(date);
    return `${formattedDate} ${formattedTime}`;
};

/**
 * Renderiza el código de cotización con icono de alerta si aplica
 * @param {string} tranid - ID de la transacción
 * @param {Object} row - Fila completa de datos
 * @returns {string} HTML con el código y el icono de alerta si es necesario
 */
const renderCotizacionConAlerta = (tranid, row) => {
    if (!row.alerta) {
        return tranid;
    }
    const mensaje = row.alerta_mensaje ? row.alerta_mensaje.replace(/"/g, '&quot;') : 'Sin mensaje';
    return `${tranid} <i class="fas fa-exclamation-circle" style="color: #dc3545; font-size: 16px; cursor: pointer; margin-left: 8px;" title="${mensaje}"></i>`;
};


/**
 * Definición de columnas para la tabla de leads
 * Cada columna especifica cómo se debe mostrar y procesar la información
 * @constant {Array<Object>}
 */
export const TABLE_COLUMNS = [
    {
        title: "ADMIN",
        data: "name_admin",
        className: "text-left",
        searchPanes: { show: true }
    },
    {
        title: "#COTIZACION",
        data: "id_ov_tranid",
        className: "text-left",
        searchPanes: { show: true },
        render: (tranid, type, row) => {
            return renderCotizacionConAlerta(tranid, row);
        }
    },
    {
        title: "LEADS",
        data: "nombre_lead",
        className: "text-left",
        searchPanes: { show: true }
    },
    {
        title: "PROYECTO",
        data: "proyecto_lead",
        className: "text-left",
        searchPanes: { show: true }
    },
    {
        title: "#OPORTUNIDAD",
        data: "tranid_oport",
        className: "text-left",
        searchPanes: { show: true }
    },
    {
        title: "#ESTIMACION",
        data: "tranid_est",
        className: "text-left",
        searchPanes: { show: true }
    },
    {
        title: "#EXPEDIENTE",
        data: "codigo_exp",
        className: "text-left",
        searchPanes: { show: true }
    },
    {
        title: "FECHA DE CREACION",
        data: "creado_ov",
        className: "text-left",
        render: formatDateTime,
        searchPanes: { show: true }
    }
];

