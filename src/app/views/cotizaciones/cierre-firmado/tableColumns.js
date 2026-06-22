import { formatDate } from "../../../../hook/useFormatDate";

const VISIBLE_FIELDS = [
    "name_admin",
    "nombre_lead",
    "email_lead",
    "telefono_lead",
    "proyecto_lead",
    "campana_lead",
    "id_ov_tranid",
    "namesubsi_ov",
    "cierre_firmado_ov",
    "chekJefeVenta",
    "aprobacion__rdr_ov",
    "aprobacion_forma_ov",
    "contrado_frima_ov",
    "calculo_comision_asesor_ov",
    "comision_cancelada_ov",
    "creado_ov",
    "pre_lista_ov",
    "trandate_ov",
    "prec_ventaneto_ov",
    "prec_venta_ov",
    "comison_asesor_ov",
    "ubicacion",
    "fechaClienteComprobante_ov",
    "Nacionalidad_lead",
    "Estado_ciLead",
    "Edad_lead",
    "Profesion_lead",
    "Hijos_lead",
    "Direccion",
    "Corredor_lead",
    "info_extra_ingresos",
    "info_extra_MotivoCompra",
    "info_extra_MomentodeCompra",
    "info_extra_Trabajo",
    "info_extra_OrigenFondo",
    "info_extra_ZonaRecidencia",
    "info_extra_PerfilClienteComprador",
];

const FILTERABLE_FIELDS = new Set([
    "name_admin",
    "proyecto_lead",
    "campana_lead",
    "namesubsi_ov",
    "cierre_firmado_ov",
    "chekJefeVenta",
    "aprobacion__rdr_ov",
    "aprobacion_forma_ov",
    "contrado_frima_ov",
    "ubicacion",
    "Edad_lead",
    "Profesion_lead",
    "Estado_ciLead",
    "info_extra_ingresos",
    "info_extra_MotivoCompra",
    "info_extra_MomentodeCompra",
    "info_extra_Trabajo",
    "info_extra_ZonaRecidencia",
]);

const DATE_FIELDS = new Set(["creado_ov"]);
const DATE_TEXT_FIELDS = new Set(["trandate_ov", "fechaClienteComprobante_ov"]);
const YES_NO_FIELDS = new Set([
    "cierre_firmado_ov",
    "chekJefeVenta",
    "contrado_frima_ov",
    "aprobacion_forma_ov",
    "aprobacion__rdr_ov",
    "calculo_comision_asesor_ov",
    "comision_cancelada_ov",
]);

const COLUMN_TITLES = {
    name_admin: "Asesor",
    nombre_lead: "Nombre Cliente",
    email_lead: "Correo Cliente",
    telefono_lead: "Teléfono",
    proyecto_lead: "Proyecto",
    campana_lead: "Campaña",
    id_ov_tranid: "Orden de Venta",
    namesubsi_ov: "Subsidiaria",
    cierre_firmado_ov: "Cierre firmado OV",
    chekJefeVenta: "Aprobación Jefatura de Ventas",
    aprobacion__rdr_ov: "Aprobación RDR",
    aprobacion_forma_ov: "Aprobación Formalizaciones",
    contrado_frima_ov: "Contrato Firma",
    calculo_comision_asesor_ov: "Cálculo Comisión Asesor",
    comision_cancelada_ov: "Comisión Cancelada",
    creado_ov: "Creado",
    pre_lista_ov: "Pre lista",
    trandate_ov: "Fecha OV",
    prec_ventaneto_ov: "Precio Venta Neto",
    prec_venta_ov: "Precio Venta",
    comison_asesor_ov: "Comisión Asesor",
    ubicacion: "Ubicación",
    fechaClienteComprobante_ov: "Fecha Cliente Comprobante",
    Nacionalidad_lead: "Nacionalidad",
    Estado_ciLead: "Estado Civil",
    Edad_lead: "Edad",
    Profesion_lead: "Profesión",
    Hijos_lead: "Hijos",
    Direccion: "Dirección",
    Corredor_lead: "Corredor",
    info_extra_ingresos: "Ingresos",
    info_extra_MotivoCompra: "Motivo Compra",
    info_extra_MomentodeCompra: "Momento de Compra",
    info_extra_Trabajo: "Trabajo",
    info_extra_OrigenFondo: "Origen Fondo",
    info_extra_ZonaRecidencia: "Zona Residencia",
};

const formatDateTime = (date) => {
    if (!date) return "No aplica";
    const { formattedDate, formattedTime } = formatDate(date);
    return `${formattedDate} ${formattedTime}`;
};

const formatColumnTitle = (field) => COLUMN_TITLES[field]
    || field.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const normalizeValue = (value) => {
    if (value === null || value === undefined || value === "") return "No aplica";
    if (typeof value === "string" && value.trim().toLowerCase() === "undefined") return "No aplica";
    return value;
};

const formatDateText = (value) => {
    const normalizedValue = normalizeValue(value);
    if (normalizedValue === "No aplica") return normalizedValue;

    const date = new Date(normalizedValue);
    if (Number.isNaN(date.getTime())) return normalizedValue;

    return date.toLocaleDateString("es-CR");
};

const formatYesNo = (value) => {
    const normalizedValue = normalizeValue(value);
    if (normalizedValue === "No aplica") return normalizedValue;
    return Number(normalizedValue) === 1 ? "Sí" : "No";
};

const buildColumn = (field) => ({
    title: formatColumnTitle(field),
    data: field,
    className: "text-left",
    defaultContent: "No aplica",
    searchPanes: { show: FILTERABLE_FIELDS.has(field) },
    render: DATE_FIELDS.has(field)
        ? (value) => formatDateTime(value)
        : DATE_TEXT_FIELDS.has(field)
            ? (value) => formatDateText(value)
            : YES_NO_FIELDS.has(field)
                ? (value) => formatYesNo(value)
                : (value) => normalizeValue(value),
});

export const TABLE_COLUMNS = VISIBLE_FIELDS.map(buildColumn);

export const SEARCH_PANES_COLUMNS = TABLE_COLUMNS
    .map((column, index) => (column.searchPanes?.show ? index : -1))
    .filter((index) => index >= 0);
