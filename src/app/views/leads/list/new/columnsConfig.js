// Configuración de las columnas que se mostrarán en la tabla.
export const columnsConfig = [
    // Cada objeto en este array define una columna en la tabla, incluyendo el título, el campo de datos y la clase CSS.

    // Columna oculta: "ASESOR" no se muestra en la tabla pero los datos pueden ser usados para búsquedas o exportaciones.
    { title: "ASESOR", data: "name_admin", className: "text-center" }, // 0

    // Columna visible: Muestra el nombre del cliente.
    { title: "Nombre Cliente", data: "nombre_lead", className: "text-left" }, //1

    // Columna visible: Muestra el número de NETSUITE.
    { title: "# NETSUITE", data: "idinterno_lead", className: "text-left" }, //2

    // Columna visible: Muestra el correo del cliente.
    { title: "Correo Cliente", data: "email_lead", className: "text-left" }, //3

    // Columna visible: Muestra el teléfono del cliente.
    { title: "Teléfono", data: "telefono_lead", className: "text-left" }, //4

    // Columna visible: Muestra el proyecto al que pertenece el lead.
    { title: "Proyecto", data: "proyecto_lead", className: "text-left" }, //5

    // Columna visible: Muestra la campaña asociada al lead.
    { title: "Campaña", data: "campana_lead", className: "text-left" }, //6

    // Columna visible: Muestra la fecha de creación del lead.
    {
        title: "Creado",
        data: "creado_lead",
        className: "text-left",
        render: function (data) {
            const { formattedDate, formattedTime } = formatDate(data);
            return `${formattedDate} ${formattedTime}`;
        },
    }, // 8

    // Columna oculta: "Subsidiarias" no se muestra en la tabla pero los datos pueden ser usados para búsquedas o exportaciones.
    { title: "Subsidiarias", data: "subsidiaria_lead", className: "text-left" }, //8
];


// La función formatDate que formatea la fecha y hora
const formatDate = (dateString) => {
    const date = new Date(dateString);

    // Ajustar la fecha a la zona horaria de Costa Rica (UTC-6)
    const localDate = new Date(date.getTime() - 6 * 60 * 60 * 1000);

    // Extraer año, mes y día
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, "0");
    const day = String(localDate.getDate()).padStart(2, "0");

    // Extraer horas, minutos y segundos, ajustando al formato de 12 horas
    let hours = localDate.getHours();
    const minutes = String(localDate.getMinutes()).padStart(2, "0");
    const seconds = String(localDate.getSeconds()).padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // Si la hora es '0', que sea '12'
    hours = String(hours).padStart(2, "0");

    // Formato de la fecha
    const formattedDate = `${year}-${month}-${day}`;

    // Formato de la hora
    const formattedTime = `${hours}:${minutes}:${seconds} ${ampm}`;

    // Retornar ambos valores por separado
    return { formattedDate, formattedTime };
};
