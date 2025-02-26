import { formatDate } from "../../../../../hook/useFormatDate";

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
 * Procesa el estado del seguimiento eliminando prefijos
 * @param {string} status - Estado completo del seguimiento
 * @returns {string} Estado procesado sin prefijos
 */
const processFollowUpStatus = (status) => {
    if (status && status.includes("-")) {
        return status.split("-")[2];
    }
    return status;
};

/**
 * Convierte el estado numérico del lead a texto
 * @param {number} status - Estado numérico (1: Activo, 2: Inactivo)
 * @returns {string} Estado en formato texto
 */
const getLeadStatus = (status) => {
    const statusMap = {
        1: "Activo",
        2: "Inactivo",
        default: "Desconocido"
    };
    return statusMap[status] || statusMap.default;
};

/**
 * Definición de columnas para la tabla de leads
 * Cada columna especifica cómo se debe mostrar y procesar la información
 * @constant {Array<Object>}
 */
export const TABLE_COLUMNS = [
    {
        title: "ASESOR",
        data: "name_admin",
        className: "text-center",
        searchPanes: { show: true }
    },
    {
        title: "Nombre Cliente",
        data: "nombre_lead",
        className: "text-left",
        searchPanes: { show: true }
    },
    {
        title: "# NETSUITE",
        data: "idinterno_lead",
        className: "text-left",
        visible: false,
        searchPanes: { show: true }
    },
    {
        title: "Correo Cliente",
        data: "email_lead",
        className: "text-left",
        searchPanes: { show: true }
    },
    {
        title: "Teléfono",
        data: "telefono_lead",
        className: "text-left",
        searchPanes: { show: true }
    },
    {
        title: "Proyecto",
        data: "proyecto_lead",
        className: "text-left",
        searchPanes: { show: true }
    },
    {
        title: "Campaña",
        data: "campana_lead",
        className: "text-left",
        searchPanes: { show: true }
    },
    {
        title: "Estado",
        data: "segimineto_lead",
        className: "text-left",
        render: processFollowUpStatus,
        visible: false,
        searchPanes: { show: true }
    },
    {
        title: "Creado",
        data: "creado_lead",
        className: "text-left",
        render: formatDateTime,
        searchPanes: { show: true }
    },
    {
        title: "Subsidiarias",
        data: "subsidiaria_lead",
        className: "text-left",
        visible: false,
        searchPanes: { show: true }
    },
    {
        title: "Última Acción",
        data: "actualizadaaccion_lead",
        className: "text-left",
        render: formatDateTime,
        searchPanes: { show: true }
    },
    {
        title: "Estado Lead",
        data: "estado_lead",
        className: "text-left",
        render: getLeadStatus,
        visible: false,
        searchPanes: { show: true }
    },
    {
        title: "Seguimineto",
        data: "nombre_caida",
        className: "text-left",
        searchPanes: { show: true }
    }
];

