const mysql = require("mysql2/promise"); // Módulo para manejar conexiones a la base de datos de manera asincrónica.
const config = require("../../config/config"); // Importa la configuración de la base de datos.
const cron = require("node-cron"); // Librería para ejecutar tareas programadas.
const cronsLeads = {}; // Objeto para agrupar todas las funciones relacionadas con 'cronsLeads'.

/**
 * Establece una conexión asincrónica a la base de datos especificada.
 * @async
 * @param {string} database - El nombre de la base de datos a la que se va a conectar.
 * @returns {Promise<mysql.Connection>} - Retorna una conexión a la base de datos.
 * @throws {Error} - Lanza un error si la conexión no se puede establecer.
 */
const createConnection = async (database) => {
    try {
        // Crea una conexión a la base de datos utilizando la configuración definida.
        const connection = await mysql.createConnection(config.database[database]);
        return connection; // Retorna la conexión establecida.
    } catch (error) {
        // Registra el error y lanza una nueva excepción si la conexión falla.
        console.error(`Error al conectar a la base de datos: ${error.message}`);
        throw new Error("No se pudo establecer la conexión a la base de datos");
    }
};

/**
 * Maneja una operación en la base de datos de manera segura, incluyendo la conexión y desconexión.
 * @async
 * @param {Function} operation - Función que define la operación a realizar en la base de datos.
 * @param {string} database - Nombre de la base de datos a utilizar.
 * @returns {Promise<Object>} - El resultado de la operación de base de datos.
 * @throws {Error} - Lanza un error si ocurre un problema durante la operación.
 */
const handleDatabaseOperation = async (operation, database) => {
    let connection;
    try {
        // Establece la conexión a la base de datos y ejecuta la operación.
        connection = await createConnection(database);
        return await operation(connection);
    } catch (error) {
        // Captura cualquier error que ocurra durante la operación de la base de datos.
        console.error(`Error en la operación de base de datos: ${error.message}`);
        return { statusCode: 500, error: "Error interno del servidor" };
    } finally {
        // Asegura que la conexión a la base de datos se cierre si se estableció.
        if (connection) await connection.end();
    }
};

/**
 * Ejecuta un procedimiento almacenado con parámetros proporcionados y retorna el resultado.
 * @async
 * @param {string} procedureName - Nombre del procedimiento almacenado a ejecutar.
 * @param {Array} params - Array de parámetros a pasar al procedimiento almacenado.
 * @param {string} database - Nombre de la base de datos a utilizar.
 * @returns {Promise<Object>} - Resultado de la ejecución del procedimiento almacenado.
 */
const executeStoredProcedure = async (procedureName, params, database) => {
    return handleDatabaseOperation(async (connection) => {
        // Ejecuta el procedimiento almacenado con los parámetros usando placeholders para evitar inyecciones SQL.
        const [rows] = await connection.execute(`CALL ${procedureName}(${params.map(() => "?").join(", ")})`, params);
        return {
            ok: true,
            statusCode: 200,
            ...rows, // Devuelve los resultados del procedimiento almacenado.
        };
    }, database);
};

/**
 * Obtiene la lista de leads que requieren atención desde la base de datos.
 *
 * Esta función ejecuta un procedimiento almacenado para recuperar la lista de leads
 * que requieren atención, basada en el rol y el ID del administrador de Netsuite.
 *
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la consulta.
 * @param {string} dataParams.rol_admin - Rol del administrador, utilizado para filtrar los leads según permisos.
 * @param {number} dataParams.idnetsuite_admin - ID del administrador de Netsuite, utilizado para identificar al solicitante.
 * @param {string} dataParams.database - Nombre de la base de datos donde se ejecutará la consulta.
 * @returns {Promise<Object>} - Promesa que resuelve con el resultado de la consulta de leads que requieren atención.
 */
cronsLeads.getAll_LeadsAttention = async (dataParams) =>
    executeStoredProcedure(
        "getAll_LeadsAttention", // Nombre del procedimiento almacenado que recupera los leads que requieren atención.
        [dataParams.rol_admin, dataParams.idnetsuite_admin, dataParams.startDate, dataParams.endDate, dataParams.filterOption], // Parámetros necesarios: rol y ID del administrador.
        dataParams.database, // Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
    );

/**
 * Inserta una bitácora de acciones para un lead específico en la base de datos.
 *
 * Esta función ejecuta un procedimiento almacenado para registrar una bitácora
 * de las acciones realizadas sobre un lead en la base de datos, proporcionando
 * detalles como el ID del lead, la descripción del evento, el tipo de acción y el estado actual.
 *
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la inserción de la bitácora.
 * @param {number} dataParams.leadId - ID del lead para el cual se está registrando la bitácora.
 * @param {number} dataParams.idnetsuite_admin - ID del administrador de NetSuite que está realizando la acción.
 * @param {string} dataParams.valorDeCaida - Valor relacionado con la caída o progreso del lead.
 * @param {string} dataParams.descripcionEvento - Descripción del evento o acción realizada.
 * @param {string} dataParams.tipo - Tipo de evento o acción que se está registrando (por ejemplo, seguimiento, reserva, etc.).
 * @param {string} dataParams.estadoActual - Estado actual del lead, validado previamente para asegurar su consistencia.
 * @param {string} dataParams.database - Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
 * @returns {Promise<Object>} - Promesa que resuelve con el resultado de la inserción de la bitácora.
 */
cronsLeads.insertBitcoraLead = async  (dataParams) =>
    executeStoredProcedure(
        "insertBitcoraLead", // Nombre del procedimiento almacenado que gestiona la inserción de la bitácora.
        [
            dataParams.leadId, // ID del lead que se está manejando.
            dataParams.idnetsuite_admin, // ID del administrador que realiza la acción.
            dataParams.valorDeCaida, // Valor asociado al progreso o caída del lead.
            dataParams.descripcionEvento, // Descripción del evento o acción realizada.
            dataParams.tipo, // Tipo de evento (ejemplo: seguimiento, reserva, etc.).
            dataParams.estadoActual, // Estado actual del lead, validado previamente.
        ],
        dataParams.database, // Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
    );


/**
 * Actualiza la información de un lead y registra una bitácora de las acciones realizadas en la base de datos.
 *
 * Esta función ejecuta un procedimiento almacenado para actualizar el estado del lead y registrar una bitácora
 * con los detalles de la acción realizada, como el ID del lead, el estado actual, la acción tomada, el seguimiento
 * en el calendario y otros valores relacionados.
 *
 * @async
 * @param {Object} dataParams - Objeto que contiene los parámetros necesarios para la actualización y registro de la bitácora.
 * @param {number} dataParams.leadId - ID del lead que se está actualizando y para el cual se registrará la bitácora.
 * @param {string} dataParams.estadoActual - Estado actual del lead, previamente validado para asegurar consistencia de datos.
 * @param {string} dataParams.valor_segimineto_lead - Valor asociado al seguimiento actual del lead.
 * @param {string} dataParams.estado_lead - Estado nuevo del lead que se actualizará en el sistema.
 * @param {string} dataParams.accion_lead - Acción que se ha realizado sobre el lead, como seguimiento, reserva, etc.
 * @param {string} dataParams.seguimiento_calendar - Información de seguimiento relacionada con el calendario del lead.
 * @param {string} dataParams.valorDeCaida - Motivo o valor relacionado con la caída del lead, si aplica.
 * @param {string} dataParams.formattedDate - Fecha formateada en la que se realizó la acción (YYYY-MM-DD).
 * @param {string} dataParams.database - Nombre de la base de datos en la que se ejecutará el procedimiento almacenado.
 * @returns {Promise<Object>} - Devuelve una promesa que resuelve con el resultado de la ejecución del procedimiento almacenado.
 */
cronsLeads.updateLeadActionApi = async (dataParams) =>
    executeStoredProcedure(
        "updateLeadActionApi", // Nombre del procedimiento almacenado que gestiona la actualización y registro de la bitácora.
        [
            dataParams.estadoActual, // Estado actual del lead.
            dataParams.valor_segimineto_lead, // Valor del seguimiento asociado al lead.
            dataParams.estado_lead, // Nuevo estado del lead a actualizar.
            dataParams.accion_lead, // Acción realizada sobre el lead.
            dataParams.seguimiento_calendar, // Información de seguimiento en el calendario.
            dataParams.valorDeCaida, // Valor relacionado con la caída del lead, si corresponde.
            dataParams.formattedDate, // Fecha formateada de la acción realizada (YYYY-MM-DD).
            dataParams.leadId, // ID del lead que se está actualizando.
        ],
        dataParams.database, // Nombre de la base de datos donde se ejecutará el procedimiento almacenado.
    );


// Programación de una tarea con cron que se ejecutará todos los días a las 8:54 AM
cron.schedule("*/5 * * * *", async () => {
    console.log("Ejecutando cron de leads cada día a las 8:54 AM");

    // Obtener la fecha de hoy en formato YYYY-MM-DD
    const hoy = new Date();
    const fechaHoyFormateada = hoy.getFullYear() + "-" + String(hoy.getMonth() + 1).padStart(2, "0") + "-" + String(hoy.getDate()).padStart(2, "0");
    console.log("La fecha de hoy es:", fechaHoyFormateada);

    // Base de datos a utilizar en las consultas
    const database = "produccion";

    try {
        // Definir los parámetros iniciales para consultar los leads que requieren atención
        const dataParams = {
            rol_admin: 1, // El rol de administrador
            idnetsuite_admin: 0, // ID del administrador en Netsuite
            startDate: "2024-01-01", // Fecha de inicio para filtrar leads (en este caso, fija)
            endDate: "2024-01-01", // Fecha de fin para filtrar leads (también fija)
            filterOption: 0, // Opción de filtro para los leads
            database, // Base de datos a utilizar (producción)
        };

        // Obtener todos los leads que requieren atención basados en los parámetros iniciales
        const result = await cronsLeads.getAll_LeadsAttention(dataParams);

        // Valores adicionales para procesar leads que están inactivos o sin actividad reciente
        const additionalValues = {
            valorDeCaida: 60, // Valor de caída de leads (posible métrica de tiempo de inactividad)
            tipo: "01 Sin actividad registrada en los últimos 7 días", // Tipo de inactividad
            estado_lead: 1, // Estado del lead (1 puede representar "activo")
            accion_lead: 7, // Acción que se va a tomar sobre el lead (7 puede representar una acción específica)
            seguimiento_calendar: 0, // Valor de seguimiento en el calendario
            valor_segimineto_lead: 3, // Valor de seguimiento del lead (posible prioridad o estado)
        };

        // Procesar cada lead de manera asincrónica utilizando Promise.all()
        await Promise.all(
            result["0"].map(async (lead) => {
                console.log("Procesando lead con ID", lead.idinterno_lead);

                let fechaFormateada = null; // Variable para almacenar la fecha formateada
                const { actualizadaaccion_lead } = lead; // Extraer la última fecha de actualización del lead

                // Formatear la fecha según su tipo (Date o string)
                if (actualizadaaccion_lead instanceof Date) {
                    // Si es un objeto Date, convertir a formato YYYY-MM-DD
                    fechaFormateada = actualizadaaccion_lead.toISOString().split("T")[0];
                } else if (typeof actualizadaaccion_lead === "string") {
                    // Si es una cadena, determinar si contiene "T" o espacios y eliminar la hora
                    if (actualizadaaccion_lead.includes("T")) {
                        fechaFormateada = actualizadaaccion_lead.split("T")[0];
                    } else if (actualizadaaccion_lead.includes(" ")) {
                        fechaFormateada = actualizadaaccion_lead.split(" ")[0];
                    } else {
                        // Si ya está en formato YYYY-MM-DD, usarla directamente
                        fechaFormateada = actualizadaaccion_lead;
                    }
                } else {
                    // Manejar casos donde el valor no es ni cadena ni fecha válida
                    console.log(`El valor de actualizadaaccion_lead para el lead con ID ${lead.idinterno_lead} no es ni una cadena ni una fecha válida.`);
                }

                // Si se pudo obtener una fecha válida, calcular la diferencia en días
                if (fechaFormateada) {
                    // Convertir la fecha formateada a un objeto Date en el huso horario de Costa Rica (UTC-06:00)
                    const fechaLead = new Date(fechaFormateada + "T00:00:00-06:00");

                    // Diferencia entre la fecha de hoy y la fecha de actualización del lead en milisegundos
                    const diferenciaMilisegundos = hoy - fechaLead;
                    const diasDiferencia = Math.floor(diferenciaMilisegundos / (1000 * 60 * 60 * 24)); // Convertir milisegundos a días

                    if (diasDiferencia >= 7) {
                        const bitacoraParams = {
                            leadId: lead.idinterno_lead,
                            idnetsuite_admin: lead.id_empleado_lead,
                            valorDeCaida: additionalValues.valorDeCaida,
                            descripcionEvento: "Proceso automatico",
                            tipo: "lead",
                            estadoActual: lead.segimineto_lead,
                            database,
                        };

                        // Registrar la actividad del lead en la bitácora
                        await cronsLeads.insertBitcoraLead(bitacoraParams);
                        // Si han pasado más de 7 días, procesar el lead como inactivo
                        const updateParams = {
                            estadoActual: lead.segimineto_lead,
                            valor_segimineto_lead: additionalValues.valor_segimineto_lead,
                            estado_lead: additionalValues.estado_lead,
                            accion_lead: additionalValues.accion_lead,
                            seguimiento_calendar: additionalValues.seguimiento_calendar,
                            valorDeCaida: additionalValues.valorDeCaida,
                            formattedDate: fechaFormateada, // Mantener la fecha original de la acción
                            leadId: lead.idinterno_lead,
                            database,
                        };

                        // Actualizar el estado del lead
                        await cronsLeads.updateLeadActionApi(updateParams);

                        console.log(`El lead con ID ${lead.idinterno_lead} ha estado inactivo por más de 7 días. y los dias son ${fechaFormateada}`);
                    }
                } else {
                    // Si no se pudo obtener una fecha válida, se muestra un mensaje
                    console.log("No se pudo obtener una fecha válida para este lead.");
                }

                console.log("------ Next lead ------");
            }),
        );

        console.log("🚀 Proceso automático de leads rezagados completado.");
    } catch (error) {
        // Capturar y mostrar cualquier error durante la ejecución del cron
        console.error("Error al ejecutar el cron de leads:", error.message);
    }
});








module.exports = cronsLeads; // Exporta el objeto 'cronsLeads' que contiene todas las funciones definidas.
