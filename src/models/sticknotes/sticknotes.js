// Importamos las funciones necesarias para conectarse a la base de datos
const { executeQuery } = require("../conectionPool/conectionPool");

// Creamos un objeto que contendrá las funciones relacionadas con Sticky Notes
const sticknotes = {};

/**
 * Obtiene todos los sticky notes para una transacción específica
 * Solo devuelve notas donde el usuario es creador O asignado
 * @param {Object} params - Parámetros de la solicitud
 * @param {string} params.transaction_type - Tipo de transacción (ej: salesorder, estimate)
 * @param {number} params.transaction_id - ID de la transacción específica
 * @param {number} params.id_usuario_autenticado - ID del usuario autenticado
 * @param {Object} params.database - Conexión a la base de datos
 * @returns {Promise<Object>} - Resultado de la consulta
 */
sticknotes.obtenerSticNotesPorTransaccion = async ({ transaction_type, transaction_id, id_usuario_autenticado, database }) => {
    try {
        const query = `
            SELECT
                sn.*,

                -- Datos del dueño/creador de la nota
                creador.name_admin  AS nombre_duenio,
                creador.email_admin AS correo_duenio

            FROM crm_stick_notes AS sn

            -- JOIN con el creador
            LEFT JOIN admins AS creador
                ON creador.idnetsuite_admin = sn.id_usuario_creador

            WHERE sn.transaction_type = ?
                AND sn.transaction_id = ?
                AND (
                    -- Regla 1: Si soy el creador, siempre puedo verla
                    sn.id_usuario_creador = ?
                    OR
                    -- Regla 2: Si NO es privada Y estoy asignado (múltiples asignaciones soportadas)
                    (
                        sn.privado = 0
                        AND sn.id_usuario_asignado IS NOT NULL
                        AND (
                            -- Buscar mi ID en el string separado por coma
                            FIND_IN_SET(?, sn.id_usuario_asignado) > 0
                            OR sn.id_usuario_asignado LIKE CONCAT(?, ',%')
                            OR sn.id_usuario_asignado LIKE CONCAT('%,', ?)
                            OR sn.id_usuario_asignado = ?
                        )
                    )
                )
            ORDER BY sn.creado_en DESC
        `;

        const result = await executeQuery(
            query,
            [
                transaction_type, 
                transaction_id, 
                id_usuario_autenticado, // Para verificar si soy el creador
                id_usuario_autenticado, // Para FIND_IN_SET
                id_usuario_autenticado, // Para LIKE inicio
                id_usuario_autenticado, // Para LIKE fin
                id_usuario_autenticado  // Para igualdad exacta
            ],
            database
        );

        // Asegurar que result es un array
        const notesData = Array.isArray(result) ? result : (result && result.data ? result.data : []);

        return {
            statusCode: 200,
            message: "Sticky notes obtenidos correctamente",
            data: notesData,
        };
    } catch (error) {
        console.error("❌ Error obteniendo sticky notes:", error);
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
 * @param {number} params.privado - Si es privado (0/1)
 * @param {number} params.id_usuario_asignado - ID del usuario asignado
 * @param {string} params.email_usuario_asignado - Email del usuario asignado
 * @param {string} params.prioridad - Prioridad (baja, media, alta)
 * @param {string} params.categoria - Categoría de la nota
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
    privado,
    id_usuario_asignado,
    email_usuario_asignado,
    prioridad,
    categoria,
    database,
}) => {
    const leadId = idinterno_lead || id_lead;

    console.log("📝 ========== DATOS RECIBIDOS PARA CREAR STICKY NOTE ==========");
    console.log("📝 Datos completos:", JSON.stringify({
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
        privado,
        id_usuario_asignado,
        email_usuario_asignado,
        prioridad,
        categoria,
    }, null, 2));
    console.log("👤 Usuario asignado:", {
        id: id_usuario_asignado,
        email: email_usuario_asignado,
        tieneId: !!id_usuario_asignado,
        tieneEmail: !!email_usuario_asignado,
    });
    console.log("📝 ============================================================");

    try {
        const query = `
            INSERT INTO crm_stick_notes (
                idinterno_lead, transaction_type, transaction_id, titulo, mensaje,
                color_hex, pos_x, pos_y, visible, estado, id_usuario_creador,
                privado, id_usuario_asignado, email_usuario_asignado, notificado, prioridad, categoria,
                creado_en, actualizado_en
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `;

        const result = await executeQuery(
            query,
            [
                leadId,
                transaction_type,
                transaction_id,
                titulo,
                mensaje,
                color_hex || "#FFF9C4",
                pos_x || 0,
                pos_y || 0,
                id_usuario_creador,
                privado || 0,
                id_usuario_asignado || null,
                email_usuario_asignado || null,
                prioridad || "media",
                categoria || "general",
            ],
            database
        );

        return {
            statusCode: 201,
            message: "Sticky note creado correctamente",
            data: { id_sticknote: result.insertId },
        };
    } catch (error) {
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
 * @param {number} params.privado - Si es privado (0/1)
 * @param {number} params.id_usuario_asignado - ID del usuario asignado
 * @param {string} params.email_usuario_asignado - Email del usuario asignado
 * @param {string} params.prioridad - Prioridad (baja, media, alta)
 * @param {string} params.categoria - Categoría de la nota
 * @param {Object} params.database - Conexión a la base de datos
 * @returns {Promise<Object>} - Resultado de la actualización
 */
sticknotes.editarSticNote = async ({
    id_sticknote,
    titulo,
    mensaje,
    color_hex,
    privado,
    id_usuario_asignado,
    email_usuario_asignado,
    prioridad,
    categoria,
    database,
}) => {
    console.log("📝 ========== DATOS RECIBIDOS PARA EDITAR STICKY NOTE ==========");
    console.log("📝 Datos completos:", JSON.stringify({
        id_sticknote,
        titulo,
        mensaje,
        color_hex,
        privado,
        id_usuario_asignado,
        email_usuario_asignado,
        prioridad,
        categoria,
    }, null, 2));
    console.log("👤 Usuario asignado:", {
        id: id_usuario_asignado,
        email: email_usuario_asignado,
        tieneId: !!id_usuario_asignado,
        tieneEmail: !!email_usuario_asignado,
    });
    console.log("📝 ============================================================");

    try {
        // Construir query dinámicamente para solo actualizar campos proporcionados
        let query = `UPDATE crm_stick_notes SET `;
        const params = [];
        const updates = [];

        if (titulo !== undefined) {
            updates.push(`titulo = ?`);
            params.push(titulo);
        }
        if (mensaje !== undefined) {
            updates.push(`mensaje = ?`);
            params.push(mensaje);
        }
        if (color_hex !== undefined) {
            updates.push(`color_hex = ?`);
            params.push(color_hex);
        }
        if (privado !== undefined) {
            updates.push(`privado = ?`);
            params.push(privado);
        }
        if (id_usuario_asignado !== undefined) {
            updates.push(`id_usuario_asignado = ?`);
            params.push(id_usuario_asignado || null);
        }
        if (email_usuario_asignado !== undefined) {
            updates.push(`email_usuario_asignado = ?`);
            params.push(email_usuario_asignado || null);
        }
        if (prioridad !== undefined) {
            updates.push(`prioridad = ?`);
            params.push(prioridad);
        }
        if (categoria !== undefined) {
            updates.push(`categoria = ?`);
            params.push(categoria);
        }

        if (updates.length === 0) {
            return {
                statusCode: 400,
                message: "No se proporcionaron campos para actualizar",
            };
        }

        query += updates.join(', ');
        query += `, actualizado_en = CURRENT_TIMESTAMP WHERE id_sticknote = ?`;
        params.push(id_sticknote);

        const result = await executeQuery(query, params, database);

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
 * @param {number} params.visible - Visibilidad (0 o 1) - Opcional
 * @param {Object} params.database - Conexión a la base de datos
 * @returns {Promise<Object>} - Resultado de la actualización
 */
sticknotes.cambiarEstadoSticNote = async ({
    id_sticknote,
    estado,
    visible,
    database,
}) => {
    try {
        // Construir query dinámicamente según si se proporciona visible
        let query = `
            UPDATE crm_stick_notes
            SET estado = ?`;

        const params = [estado];

        if (visible !== undefined) {
            query += `, visible = ?`;
            params.push(visible);
        }

        query += `, actualizado_en = CURRENT_TIMESTAMP
            WHERE id_sticknote = ?`;
        params.push(id_sticknote);

        const result = await executeQuery(query, params, database);

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
            SELECT
                sn.*,

                -- Datos del dueño/creador de la nota
                creador.name_admin  AS nombre_duenio,
                creador.email_admin AS correo_duenio,

                -- Datos del usuario asignado
                asignado.name_admin  AS nombre_asignado,
                asignado.email_admin AS correo_asignado

            FROM crm_stick_notes AS sn

            -- JOIN con el creador
            LEFT JOIN admins AS creador
                ON creador.idnetsuite_admin = sn.id_usuario_creador

            -- JOIN con el asignado
            LEFT JOIN admins AS asignado
                ON asignado.idnetsuite_admin = sn.id_usuario_asignado

            WHERE sn.id_sticknote = ?;

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

/**
 * Actualiza el estado PIN de un sticky note (fijar en la parte superior)
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.id_sticknote - ID del sticky note
 * @param {number} params.pin - Nuevo estado PIN (0 o 1)
 * @param {Object} params.database - Conexión a la base de datos
 * @returns {Promise<Object>} - Resultado de la actualización
 */
sticknotes.actualizarPinSticNote = async ({
    id_sticknote,
    pin,
    database,
}) => {
    try {
        const query = `
            UPDATE crm_stick_notes
            SET pin = ?, actualizado_en = CURRENT_TIMESTAMP
            WHERE id_sticknote = ?
        `;

        const result = await executeQuery(
            query,
            [pin, id_sticknote],
            database
        );

        return {
            statusCode: 200,
            message: "PIN actualizado correctamente",
            data: result,
        };
    } catch (error) {
        return {
            statusCode: 500,
            message: "Error al actualizar el PIN",
            error: error.message,
        };
    }
};

/**
 * Elimina un sticky note por su ID
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.id_sticknote - ID del sticky note a eliminar
 * @param {Object} params.database - Conexión a la base de datos
 * @returns {Promise<Object>} - Resultado de la eliminación
 */
sticknotes.eliminarSticNote = async ({
    id_sticknote,
    database,
}) => {
    try {
        const query = `
            DELETE FROM crm_stick_notes
            WHERE id_sticknote = ?
        `;

        const result = await executeQuery(
            query,
            [id_sticknote],
            database
        );

        console.log("🗑️ Sticky note eliminado:", id_sticknote);

        return {
            statusCode: 200,
            message: "Sticky note eliminado correctamente",
            data: result,
        };
    } catch (error) {
        console.error("❌ Error eliminando sticky note:", error);
        return {
            statusCode: 500,
            message: "Error al eliminar sticky note",
            error: error.message,
        };
    }
};

// Exportar el objeto con todas las funciones
module.exports = sticknotes;
