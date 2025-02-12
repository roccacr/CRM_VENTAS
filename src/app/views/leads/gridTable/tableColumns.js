/**
 * Configuración de columnas para la tabla de leads
 * @returns {Array} Array de objetos con la configuración de cada columna
 */
export const tableColumns = [
    { data: "nombre_lead", title: "Nombre Cliente", visible: false, defaultContent: "" },
    { data: "idinterno_lead", title: "# NETSUITE", defaultContent: "" },
    { data: "email_lead", title: "Correo Cliente", defaultContent: "" },
    { data: "telefono_lead", title: "Teléfono", defaultContent: "" },
    { data: "proyecto_lead", title: "Proyecto", defaultContent: "" },
    { data: "campana_lead", title: "Campaña", defaultContent: "" },
    { data: "segimineto_lead", title: "Estado", defaultContent: "" },
    { data: "creado_lead", title: "Creado", defaultContent: "" },
]; 