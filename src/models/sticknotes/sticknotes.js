// Importamos las funciones necesarias para conectarse a la base de datos
const { executeQuery } = require("../conectionPool/conectionPool");

// Creamos un objeto que contendrá las funciones relacionadas con Sticky Notes
const sticknotes = {};

/**
 * Obtiene todos los sticky notes para una transacción específica
 * @param {Object} params - Parámetros de la solicitud
 * @param {string} params.transaction_type - Tipo de transacción (ej: salesorder, estimate)
 * @param {number} params.transaction_id - ID de la transacción específica
 * @param {Object} params.database - Conexión a la base de datos
 * @returns {Promise<Object>} - Resultado de la consulta
 */
sticknotes.obtenerSticNotesPorTransaccion = async ({ transaction_type, transaction_id, database }) => {
    try {
        const query = `
            SELECT * FROM crm_stick_notes
            WHERE transaction_type = ? AND transaction_id = ? AND estado = 1
            ORDER BY creado_en DESC
        `;

        const result = await executeQuery(query, [transaction_type, transaction_id], database);

        return {
            statusCode: 200,
            message: "Sticky notes obtenidos correctamente",
            data: result,
        };
    } catch (error) {
        return {
            statusCode: 500,
            message: "Error al obtener sticky notes",
            error: error.message,
        };
    }
};

/**
 * Crea un nuevo sticky note
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.id_lead - ID del lead
 * @param {string} params.transaction_type - Tipo de transacción
 * @param {number} params.transaction_id - ID de la transacción
 * @param {string} params.titulo - Título del sticky note
 * @param {string} params.mensaje - Contenido del mensaje
 * @param {string} params.color_hex - Color en formato HEX
 * @param {number} params.pos_x - Posición X en pantalla
 * @param {number} params.pos_y - Posición Y en pantalla
 * @param {number} params.id_usuario_creador - ID del usuario que crea la nota
 * @param {Object} params.database - Conexión a la base de datos
 * @returns {Promise<Object>} - Resultado de la inserción
 */
sticknotes.crearSticNote = async ({
    id_lead,
    idinterno_lead,
    transaction_type,
    transaction_id,
    titulo,
    mensaje,
    color_hex,
    pos_x,
    pos_y,
    id_usuario_creador,
    database,
}) => {
    const leadId = idinterno_lead || id_lead;

    console.log("🔍 Parámetros recibidos en crearSticNote:", {
        leadId,
        transaction_type,
        transaction_id,
        titulo,
        mensaje,
        color_hex,
        pos_x,
        pos_y,
        id_usuario_creador,
    });

    try {
        const query = `
            INSERT INTO crm_stick_notes (
                idinterno_lead, transaction_type, transaction_id, titulo, mensaje,
                color_hex, pos_x, pos_y, visible, estado, id_usuario_creador,
                creado_en, actualizado_en
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        const result = await executeQuery(
            query,
            [
                leadId,
                transaction_type,
                transaction_id,
                titulo,
                mensaje,
                color_hex || "#FFFF88",
                pos_x || 0,
                pos_y || 0,
                id_usuario_creador,
            ],
            database
        );

        console.log("✅ Sticky note creado correctamente, ID:", result.insertId);

        return {
            statusCode: 201,
            message: "Sticky note creado correctamente",
            data: { id_sticknote: result.insertId },
        };
    } catch (error) {
        console.error("❌ Error en la operación de base de datos:", error.message);
        return {
            statusCode: 500,
            message: "Error al crear sticky note",
            error: error.message,
        };
    }
};

/**
 * Edita un sticky note existente
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.id_sticknote - ID del sticky note a editar
 * @param {string} params.titulo - Nuevo título
 * @param {string} params.mensaje - Nuevo contenido del mensaje
 * @param {string} params.color_hex - Nuevo color en formato HEX
 * @param {Object} params.database - Conexión a la base de datos
 * @returns {Promise<Object>} - Resultado de la actualización
 */
sticknotes.editarSticNote = async ({
    id_sticknote,
    titulo,
    mensaje,
    color_hex,
    database,
}) => {
    try {
        const query = `
            UPDATE crm_stick_notes
            SET titulo = ?, mensaje = ?, color_hex = ?, actualizado_en = CURRENT_TIMESTAMP
            WHERE id_sticknote = ?
        `;

        const result = await executeQuery(
            query,
            [titulo, mensaje, color_hex, id_sticknote],
            database
        );

        return {
            statusCode: 200,
            message: "Sticky note actualizado correctamente",
            data: result,
        };
    } catch (error) {
        return {
            statusCode: 500,
            message: "Error al actualizar sticky note",
            error: error.message,
        };
    }
};

/**
 * Actualiza la posición de un sticky note (cuando se arrastra)
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.id_sticknote - ID del sticky note
 * @param {number} params.pos_x - Nueva posición X
 * @param {number} params.pos_y - Nueva posición Y
 * @param {Object} params.database - Conexión a la base de datos
 * @returns {Promise<Object>} - Resultado de la actualización
 */
sticknotes.actualizarPosicionSticNote = async ({
    id_sticknote,
    pos_x,
    pos_y,
    database,
}) => {
    try {
        const query = `
            UPDATE crm_stick_notes
            SET pos_x = ?, pos_y = ?, actualizado_en = CURRENT_TIMESTAMP
            WHERE id_sticknote = ?
        `;

        const result = await executeQuery(
            query,
            [pos_x, pos_y, id_sticknote],
            database
        );

        return {
            statusCode: 200,
            message: "Posición actualizada correctamente",
            data: result,
        };
    } catch (error) {
        return {
            statusCode: 500,
            message: "Error al actualizar la posición",
            error: error.message,
        };
    }
};

/**
 * Cambia la visibilidad de un sticky note
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.id_sticknote - ID del sticky note
 * @param {number} params.visible - Nuevo estado de visibilidad (0 o 1)
 * @param {Object} params.database - Conexión a la base de datos
 * @returns {Promise<Object>} - Resultado de la actualización
 */
sticknotes.cambiarVisibilidadSticNote = async ({
    id_sticknote,
    visible,
    database,
}) => {
    try {
        const query = `
            UPDATE crm_stick_notes
            SET visible = ?, actualizado_en = CURRENT_TIMESTAMP
            WHERE id_sticknote = ?
        `;

        const result = await executeQuery(
            query,
            [visible, id_sticknote],
            database
        );

        return {
            statusCode: 200,
            message: "Visibilidad actualizada correctamente",
            data: result,
        };
    } catch (error) {
        return {
            statusCode: 500,
            message: "Error al actualizar la visibilidad",
            error: error.message,
        };
    }
};

/**
 * Cambia el estado de un sticky note (activo/inactivo)
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.id_sticknote - ID del sticky note
 * @param {number} params.estado - Nuevo estado (0 o 1)
 * @param {Object} params.database - Conexión a la base de datos
 * @returns {Promise<Object>} - Resultado de la actualización
 */
sticknotes.cambiarEstadoSticNote = async ({
    id_sticknote,
    estado,
    database,
}) => {
    try {
        const query = `
            UPDATE crm_stick_notes
            SET estado = ?, actualizado_en = CURRENT_TIMESTAMP
            WHERE id_sticknote = ?
        `;

        const result = await executeQuery(
            query,
            [estado, id_sticknote],
            database
        );

        return {
            statusCode: 200,
            message: "Estado actualizado correctamente",
            data: result,
        };
    } catch (error) {
        return {
            statusCode: 500,
            message: "Error al actualizar el estado",
            error: error.message,
        };
    }
};

/**
 * Obtiene un sticky note específico por su ID
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.id_sticknote - ID del sticky note
 * @param {Object} params.database - Conexión a la base de datos
 * @returns {Promise<Object>} - Sticky note encontrado
 */
sticknotes.obtenerSticNotePorId = async ({
    id_sticknote,
    database,
}) => {
    try {
        const query = `
            SELECT * FROM crm_stick_notes
            WHERE id_sticknote = ?
        `;

        const result = await executeQuery(
            query,
            [id_sticknote],
            database
        );

        return {
            statusCode: 200,
            message: "Sticky note obtenido correctamente",
            data: result,
        };
    } catch (error) {
        return {
            statusCode: 500,
            message: "Error al obtener sticky note",
            error: error.message,
        };
    }
};

// Exportar el objeto con todas las funciones
module.exports = sticknotes;
