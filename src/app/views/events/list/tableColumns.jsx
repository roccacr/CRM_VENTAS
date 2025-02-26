import { formatDate } from "../../../../hook/useFormatDate";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
export const tableColumns = [
    { title: "ASESOR", data: "name_admin", className: "text-center" }, // ASESOR
    { title: "EVENTO", data: "nombre_calendar", className: "text-left" }, // EVENTO
    {
        title: "LEAD",
        data: "nombre_lead",
        className: "text-left",
        render: function (data) {
            return data === "0" || data === null  || data === 0 ? "No aplica" : data;
        },
    }, // LEAD
    {
        title: "FECHA INICIO",
        data: "fechaIni_calendar",
        className: "text-left",
        render: function (data) {
            const { formattedDate } = formatDate(data);
            return formattedDate;
        },
    }, // FECHA INICIO
    { title: "HORA INICIAL", data: "horaInicio_calendar", className: "text-left" }, // HORA INICIAL
    { title: "ESTADO", data: "accion_calendar", className: "text-left" }, // ESTADO
    { title: "TIPO", data: "tipo_calendar", className: "text-left" }, // TIPO
    {
        title: "CITA",
        data: "cita_lead",
        className: "text-left",
        render: function (data) {
            return data === 1 ? "Cita" : "No aplica";
        },
    }, // CITA
    { title: "PROYECTO", data: "proyecto_lead", className: "text-left", render: function (data) {

        return data === "0" || data === null  || data === 0 ? "No aplica" : data;
    }, }, // PROYECTO
    { title: "CAMPAÑA", data: "campana_lead", className: "text-left", render: function (data) {

        return data === "0" || data === null  || data === 0 ? "No aplica" : data;
    }, }, // CAMPAÑA.
];
