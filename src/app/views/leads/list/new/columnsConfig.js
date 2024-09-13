// Configuración de las columnas que se mostrarán en la tabla.
export const columnsConfig = [
    // Cada objeto en este array define una columna en la tabla, incluyendo el título, el campo de datos y la clase CSS.

    // Columna oculta: "ASESOR" no se muestra en la tabla pero los datos pueden ser usados para búsquedas o exportaciones.
    { title: "ASESOR", data: "name_admin", className: "text-center" }, // 0

    // Columna visible: Muestra el nombre del cliente.
    { title: "Nombre Cliente", data: "nombre_lead", className: "text-left" }, //1

    // Columna visible: Muestra el número de NETSUITE.
    { title: "# NETSUITE", data: "idinterno_lead", className: "text-left" },//2

    // Columna visible: Muestra el correo del cliente.
    { title: "Correo Cliente", data: "email_lead", className: "text-left" },//3

    // Columna visible: Muestra el teléfono del cliente.
    { title: "Teléfono", data: "telefono_lead", className: "text-left" },//4

    // Columna visible: Muestra el proyecto al que pertenece el lead.
    { title: "Proyecto", data: "proyecto_lead", className: "text-left" },//5

    // Columna visible: Muestra la campaña asociada al lead.
    { title: "Campaña", data: "campana_lead", className: "text-left" },//6

    // Columna visible: Muestra la fecha de creación del lead.
    { title: "Creado", data: "creado_lead", className: "text-left" }, //7

    // Columna oculta: "Subsidiarias" no se muestra en la tabla pero los datos pueden ser usados para búsquedas o exportaciones.
    { title: "Subsidiarias", data: "subsidiaria_lead", className: "text-left" },//8
];
