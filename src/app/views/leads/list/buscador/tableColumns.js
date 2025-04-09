/**
 * @fileoverview Definiciones de columnas para las tablas del buscador del CRM
 * @module TableColumns
 */

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
 * Convierte estados numéricos a texto
 * @param {number} status - Estado numérico (1: Activo, 2: Inactivo)
 * @returns {string} Estado en formato texto
 */
const getStatusText = (status) => status === 1 ? "Activo" : "Inactivo";

/**
 * Configuración base para todas las columnas
 * @type {Object}
 */
const baseColumnConfig = {
    className: "text-center",
    searchPanes: { show: true }
};

/**
 * Crea una configuración de columna con los valores base
 * @param {string} title - Título de la columna
 * @param {string} data - Campo de datos a mostrar
 * @param {Object} [additionalConfig={}] - Configuración adicional para la columna
 * @returns {Object} Configuración completa de la columna
 */
const createColumn = (title, data, additionalConfig = {}) => ({
    title,
    data,
    ...baseColumnConfig,
    ...additionalConfig
});

/**
 * Columnas para la tabla de leads
 * @type {Array<Object>}
 */
export const TABLE_LEADS_BUSCADOR = [
    createColumn("Asesor", "nombre_admin"),
    createColumn("Nombre Lead", "nombre_lead"),
    createColumn("Correo Lead", "email_lead"),
    createColumn("Teléfono Lead", "telefono_lead"),
    createColumn("Proyecto Lead", "proyecto_lead"),
    createColumn("Campaña", "campana_lead")
];

/**
 * Columnas para la tabla de oportunidades
 * @type {Array<Object>}
 */
export const TABLE_OPORTUNIDADES_BUSCADOR = [
    createColumn("Empleado", "employee_oport"),
    createColumn("TranID", "tranid_oport"),
    createColumn("Lead", "entity_oport_name")
];

/**
 * Columnas para la tabla de eventos
 * @type {Array<Object>}
 */
export const TABLE_EVENTOS_BUSCADOR = [
    createColumn("Empleado", "employee_evento"),
    createColumn("Nombre Evento", "nombre_calendar"),
    createColumn("Lead", "nombre_lead"),
    createColumn("Fecha Inicio", "fechaIni_calendar", { render: formatDateTime }),
    createColumn("Hora Inicio", "horaInicio_calendar"),
    createColumn("Accion", "accion_calendar")
];

/**
 * Columnas para la tabla de estimaciones
 * @type {Array<Object>}
 */
export const TABLE_ESTIMACIONES_BUSCADOR = [
    createColumn("Empleado", "employee_estimacion"),
    createColumn("TranID", "tranid_est"),
    createColumn("Lead", "entity_estimacion")
];

/**
 * Columnas para la tabla de órdenes de venta
 * @type {Array<Object>}
 */
export const TABLE_ORDEN_VENTA_BUSCADOR = [
    createColumn("Empleado", "employee_ordenVenta"),
    createColumn("TranID", "id_ov_tranid"),
    createColumn("Lead", "entity_ordenVenta")
];

/**
 * Columnas para la tabla de corredores
 * @type {Array<Object>}
 */
export const TABLE_CORREDORES_BUSCADOR = [
    createColumn("Nombre Corredor", "nombre_corredor"),
    createColumn("ID Netsuite", "valoridNetsuite"),
    createColumn("Estado Corredor", "estado_corredor", { render: (data) => getStatusText(data) })
];

/**
 * Columnas para la tabla de proyectos
 * @type {Array<Object>}
 */
export const TABLE_PROYECTOS_BUSCADOR = [
    createColumn("Nombre Proyecto", "Nombre_proyecto"),
    createColumn("ID Netsuite", "id_ProNetsuite"),
    createColumn("Estado Proyecto", "estado_proyecto", { render: (data) => getStatusText(data) })
];

/**
 * Columnas para la tabla de subsidiarias
 * @type {Array<Object>}
 */
export const TABLE_SUBSIDIARIA_BUSCADOR = [
    createColumn("Nombre Subsidiaria", "Nombre_Subsidiaria"),
    createColumn("ID Netsuite", "id_NetsuiteSub"),
    createColumn("Estado Subsidiaria", "Estado_Subsidiaria", { render: (data) => getStatusText(data) })
];



/**
 * Columnas para la tabla de ubicaciones
 * @type {Array<Object>}
 */
export const TABLE_UBICACIONES_BUSCADOR = [
    createColumn("Nombre Ubicacion", "nombre_ubicaciones"),
    createColumn("ID Netsuite", "idNetsuite_ubicaciones"),
    createColumn("Estado Ubicacion", "estado_ubicaciones", { render: (data) => getStatusText(data) })
];





/**
 * Columnas para la tabla de campañas
 * @type {Array<Object>}
 */
export const TABLE_CAMPANAS_BUSCADOR = [
    createColumn("Nombre Campaña", "Nombre_Campana"),
    createColumn("ID Netsuite", "id_NetsauiteCampana"),
    createColumn("Estado Campaña", "Estado_Campana", { render: (data) => getStatusText(data) })
];
