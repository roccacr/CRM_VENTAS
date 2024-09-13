// Configuración de las columnas que se mostrarán en la tabla.
export const columnsConfig = [
    // Cada objeto en este array define una columna en la tabla, incluyendo el título, el campo de datos y la clase CSS.

    // Columna oculta: "ASESOR" no se muestra en la tabla pero los datos pueden ser usados para búsquedas o exportaciones.
    { title: "ASESOR", data: "name_admin", className: "text-center" },

    // Columna visible: Muestra el nombre del cliente.
    { title: "Nombre Cliente", data: "nombre_lead", className: "text-left" },

    // Columna visible: Muestra el número de NETSUITE.
    { title: "# NETSUITE", data: "idinterno_lead", className: "text-left" },

    // Columna visible: Muestra el correo del cliente.
    { title: "Correo Cliente", data: "email_lead", className: "text-left" },

    // Columna visible: Muestra el teléfono del cliente.
    { title: "Teléfono", data: "telefono_lead", className: "text-left" },

    // Columna visible: Muestra el proyecto al que pertenece el lead.
    { title: "Proyecto", data: "proyecto_lead", className: "text-left" },

    // Columna visible: Muestra la campaña asociada al lead.
    { title: "Campaña", data: "campana_lead", className: "text-left" },

    // Columna visible: Muestra la fecha de creación del lead.
    { title: "Creado", data: "creado_lead", className: "text-left" },

    // Columna oculta: "Subsidiarias" no se muestra en la tabla pero los datos pueden ser usados para búsquedas o exportaciones.
    { title: "Subsidiarias", data: "subsidiaria_lead", className: "text-left" },
];
