
import { formatDate } from "../../../../../hook/useFormatDate";
export const tableColumns = [
    { title: "ASESOR", data: "name_admin", className: "text-center" }, // 0
    { title: "Nombre Cliente", data: "nombre_lead", className: "text-left" }, // 1
    { title: "# NETSUITE", data: "idinterno_lead", className: "text-left" , visible: false }, // 2
    { title: "Correo Cliente", data: "email_lead", className: "text-left" }, // 3
    { title: "Teléfono", data: "telefono_lead", className: "text-left" }, // 4
    { title: "Proyecto", data: "proyecto_lead", className: "text-left" }, // 5
    { title: "Campaña", data: "campana_lead", className: "text-left" }, // 6
    {
        title: "Estado",
        data: "segimineto_lead",
        className: "text-left",
        render: function (data) {
            // Quitamos el prefijo antes del primer guion
            if (data && data.includes("-")) {
                return data.split("-")[2]; // Retorna todo lo que está después del primer guion
            }
            return data; // Si no tiene guion, retorna el dato tal como está
        },
        visible: false,
    }, // 7
    {
        title: "Creado",
        data: "creado_lead",
        className: "text-left",
        render: function (data) {
            const { formattedDate, formattedTime } = formatDate(data);
            return `${formattedDate} ${formattedTime}`;
        },

    }, // 8
    { title: "Subsidiarias", data: "subsidiaria_lead", className: "text-left", visible: false }, // 9
    {
        title: "Última Acción",
        data: "actualizadaaccion_lead",
        className: "text-left",
        render: function (data) {
            const { formattedDate, formattedTime } = formatDate(data);
            return `${formattedDate} ${formattedTime}`;
        },
        visible: false,
    }, // 9
    {
        title: "Estado Lead",
        data: "estado_lead",
        className: "text-left",
        render: function (data) {
            return data === 1 ? "Activo" : data === 2 ? "Inactivo" : "Desconocido";
        },
        visible: false,
    }, // 10
];
