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
 * Definición de columnas para la tabla de leads
 * Cada columna especifica cómo se debe mostrar y procesar la información
 * @constant {Array<Object>}
 */
export const TABLE_COLUMNS = [
    {
        title: "#COTIZACION",
        data: "id_ov_tranid",
        className: "text-left",
        searchPanes: { show: true }
    },
    {
        title: "LEADS",
        data: "nombre_lead",
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

