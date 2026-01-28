// Importamos las funciones necesarias para conectarse a la base de datos
const { executeQuery } = require("../conectionPool/conectionPool");
const nodemailer = require('nodemailer');

// Configuración del transporte SMTP para Outlook (CRM Ventas)
const emailTransporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    auth: {
        user: 'crm_noreply@roccacr.com',
        pass: 'CrM_$2023.T1',
    },
    tls: {
        ciphers: 'SSLv3',
    },
});

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

        const id_sticknote_creado = result.insertId;

        // Enviar correo de forma asíncrona (sin await) si hay usuarios asignados
        // La privacidad solo afecta la vista, pero si hay asignados deben recibir correo
        if (email_usuario_asignado && email_usuario_asignado.trim() !== '') {
            // Obtener datos del creador de forma asíncrona
            executeQuery(
                `SELECT name_admin, email_admin FROM admins WHERE idnetsuite_admin = ? LIMIT 1`,
                [id_usuario_creador],
                database
            ).then(creadorResult => {
                // executeQuery devuelve un objeto con estructura { ok, statusCode, data }
                // Necesitamos acceder a creadorResult.data que es el array de resultados
                const creadorArray = (creadorResult && creadorResult.data && Array.isArray(creadorResult.data)) 
                    ? creadorResult.data 
                    : (Array.isArray(creadorResult) ? creadorResult : []);
                
                const creador = creadorArray.length > 0 
                    ? creadorArray[0] 
                    : { name_admin: 'Sistema', email_admin: null };

                // Enviar correo sin await (no bloquea la respuesta)
                enviarCorreoStickyNote({
                    email_usuario_asignado,
                    titulo,
                    mensaje,
                    color_hex: color_hex || "#FFF9C4",
                    prioridad: prioridad || "media",
                    creador_nombre: creador.name_admin || 'Sistema',
                    creador_email: creador.email_admin || null,
                    id_sticknote: id_sticknote_creado,
                    transaction_type: transaction_type,
                    transaction_id: transaction_id,
                    database,
                });
            }).catch(error => {
                console.error('❌ Error obteniendo datos del creador:', error);
            });
        }

        return {
            statusCode: 201,
            message: "Sticky note creado correctamente",
            data: { id_sticknote: id_sticknote_creado },
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

        // Enviar correo de forma asíncrona (sin await) si hay usuarios asignados
        // La privacidad solo afecta la vista, pero si hay asignados deben recibir correo
        console.log('📧 Iniciando proceso de envío de correo para nota editada:', id_sticknote);
        
        // Obtener datos completos de la nota y del creador para enviar correo
        executeQuery(
            `SELECT sn.titulo, sn.mensaje, sn.color_hex, sn.prioridad, sn.id_usuario_creador,
                    sn.email_usuario_asignado, sn.transaction_type, sn.transaction_id,
                    creador.name_admin, creador.email_admin
             FROM crm_stick_notes sn
             LEFT JOIN admins creador ON creador.idnetsuite_admin = sn.id_usuario_creador
             WHERE sn.id_sticknote = ? LIMIT 1`,
            [id_sticknote],
            database
        ).then(noteResult => {
            console.log('📧 Resultado de consulta para correo:', JSON.stringify(noteResult, null, 2));
            
            // executeQuery devuelve un objeto con estructura { ok, statusCode, data }
            // Necesitamos acceder a noteResult.data que es el array de resultados
            const notesArray = (noteResult && noteResult.data && Array.isArray(noteResult.data)) 
                ? noteResult.data 
                : (Array.isArray(noteResult) ? noteResult : []);
            
            console.log('📧 Array de notas extraído:', notesArray.length, 'nota(s)');
            
            if (notesArray.length > 0) {
                const note = notesArray[0];
                console.log('📧 Datos de la nota obtenidos:', {
                    email_bd: note.email_usuario_asignado,
                    email_proporcionado: email_usuario_asignado,
                    transaction_type: note.transaction_type,
                    transaction_id: note.transaction_id,
                });
                
                // Usar el email actualizado si se proporcionó, sino el de la BD
                const emailFinal = email_usuario_asignado !== undefined ? email_usuario_asignado : note.email_usuario_asignado;
                
                console.log('📧 Email final para envío:', emailFinal);
                
                // Enviar correo siempre que haya emails asignados (independiente de privacidad)
                if (emailFinal && emailFinal.trim() !== '') {
                    console.log('📧 Enviando correo a:', emailFinal);
                    
                    // Enviar correo sin await (no bloquea la respuesta)
                    enviarCorreoStickyNote({
                        email_usuario_asignado: emailFinal,
                        titulo: titulo !== undefined ? titulo : note.titulo,
                        mensaje: mensaje !== undefined ? mensaje : note.mensaje,
                        color_hex: color_hex !== undefined ? color_hex : note.color_hex,
                        prioridad: prioridad !== undefined ? prioridad : note.prioridad,
                        creador_nombre: note.name_admin || 'Sistema',
                        creador_email: note.email_admin || null,
                        id_sticknote: id_sticknote,
                        transaction_type: note.transaction_type,
                        transaction_id: note.transaction_id,
                        database,
                    });
                } else {
                    console.log('⚠️ No se enviará correo: no hay emails asignados');
                }
            } else {
                console.log('⚠️ No se encontró la nota para enviar correo');
            }
        }).catch(error => {
            console.error('❌ Error obteniendo datos de la nota para correo:', error);
        });

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

/**
 * Función auxiliar para enviar correo de notificación de sticky note
 * Se ejecuta de forma asíncrona (sin await) para no bloquear la respuesta
 * @param {Object} params - Parámetros del correo
 * @param {string} params.email_usuario_asignado - Emails separados por coma
 * @param {string} params.titulo - Título de la nota
 * @param {string} params.mensaje - Mensaje de la nota
 * @param {string} params.color_hex - Color de la nota
 * @param {string} params.prioridad - Prioridad (baja, media, alta)
 * @param {string} params.creador_nombre - Nombre del creador
 * @param {string} params.creador_email - Email del creador
 * @param {number} params.id_sticknote - ID de la nota
 * @param {string} params.transaction_type - Tipo de transacción (ej: ordersale)
 * @param {number} params.transaction_id - ID de la transacción
 * @param {Object} params.database - Conexión a la base de datos
 */
const enviarCorreoStickyNote = async ({
    email_usuario_asignado,
    titulo,
    mensaje,
    color_hex,
    prioridad,
    creador_nombre,
    creador_email,
    id_sticknote,
    transaction_type,
    transaction_id,
    database,
}) => {
    console.log('📧 ========== ENVIAR CORREO STICKY NOTE ==========');
    console.log('📧 Parámetros recibidos:', {
        email_usuario_asignado,
        titulo,
        transaction_type,
        transaction_id,
        id_sticknote,
    });
    
    // Si no hay emails asignados, no enviar correo
    if (!email_usuario_asignado || email_usuario_asignado.trim() === '') {
        console.log('⚠️ No se enviará correo: email_usuario_asignado vacío o null');
        return;
    }

    try {
        // Parsear emails (separados por coma)
        const emailsArray = email_usuario_asignado
            .split(',')
            .map(email => email.trim())
            .filter(email => email && email.includes('@'));

        console.log('📧 Emails parseados:', emailsArray);
        console.log('📧 Cantidad de emails:', emailsArray.length);

        if (emailsArray.length === 0) {
            console.log('⚠️ No se enviará correo: array de emails vacío después de parsear');
            return;
        }

        // Mapear prioridad a texto
        const prioridadTexto = {
            baja: 'Baja',
            media: 'Media',
            alta: 'Alta',
        };

        // Mapear prioridad a color de texto
        const prioridadColor = {
            baja: '#2e7d32',
            media: '#f57c00',
            alta: '#c62828',
        };

        // Función para escapar HTML y prevenir XSS
        const escapeHtml = (text) => {
            if (!text) return '';
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return String(text).replace(/[&<>"']/g, m => map[m]);
        };

        // Escapar contenido para seguridad
        const tituloEscapado = escapeHtml(titulo || 'Sticky Note');
        const mensajeEscapado = escapeHtml(mensaje || '').replace(/\n/g, '<br>');
        const creadorNombreEscapado = escapeHtml(creador_nombre || 'Sistema');
        const creadorEmailEscapado = creador_email ? escapeHtml(creador_email) : '';

        // Generar link de NetSuite según el tipo de transacción
        let netsuiteLink = null;
        let linkTexto = '';
        if (transaction_type === 'ordersale' && transaction_id) {
            netsuiteLink = `https://4552704.app.netsuite.com/app/accounting/transactions/salesord.nl?id=${transaction_id}&whence=`;
            linkTexto = 'Ver Orden de Venta en NetSuite';
        }
        // Aquí se pueden agregar más tipos de transacciones en el futuro

        // Crear HTML con estilo de sticky note
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .sticky-note-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: ${color_hex || '#FFF9C4'};
            border-radius: 8px;
            padding: 25px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            border-left: 4px solid ${prioridadColor[prioridad] || '#f57c00'};
        }
        .sticky-note-header {
            border-bottom: 2px solid rgba(0, 0, 0, 0.1);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        .sticky-note-title {
            font-size: 22px;
            font-weight: bold;
            color: #212121;
            margin: 0 0 10px 0;
        }
        .sticky-note-priority {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            color: white;
            background-color: ${prioridadColor[prioridad] || '#f57c00'};
            text-transform: uppercase;
        }
        .sticky-note-content {
            font-size: 15px;
            line-height: 1.6;
            color: #424242;
            white-space: pre-wrap;
            margin-bottom: 20px;
        }
        .sticky-note-footer {
            border-top: 1px solid rgba(0, 0, 0, 0.1);
            padding-top: 15px;
            font-size: 13px;
            color: #757575;
        }
        .sticky-note-creator {
            margin-bottom: 8px;
        }
        .sticky-note-creator strong {
            color: #212121;
        }
        .sticky-note-link-button {
            display: inline-block;
            margin-top: 15px;
            padding: 12px 24px;
            background-color: #1976d2;
            color: white !important;
            text-decoration: none;
            border-radius: 4px;
            font-weight: 600;
            font-size: 14px;
            text-align: center;
            transition: background-color 0.3s ease;
        }
        .sticky-note-link-button:hover {
            background-color: #1565c0;
        }
    </style>
</head>
<body>
    <div class="sticky-note-container">
        <div class="sticky-note-header">
            <h2 class="sticky-note-title">${tituloEscapado}</h2>
            <span class="sticky-note-priority">Prioridad: ${prioridadTexto[prioridad] || 'Media'}</span>
        </div>
        <div class="sticky-note-content">
            ${mensajeEscapado}
        </div>
        <div class="sticky-note-footer">
            <div class="sticky-note-creator">
                <strong>👤 Creado por:</strong> ${creadorNombreEscapado}${creadorEmailEscapado ? ` (${creadorEmailEscapado})` : ''}
            </div>
            ${netsuiteLink ? `
            <div style="margin-top: 15px; text-align: center;">
                <a href="${netsuiteLink}" class="sticky-note-link-button" style="color: white; text-decoration: none;">
                    🔗 ${linkTexto}
                </a>
            </div>
            ` : ''}
            <div style="margin-top: 15px; font-size: 12px; color: #9e9e9e; text-align: center;">
                Este es un mensaje automático del sistema CRM Ventas Rocca.
            </div>
        </div>
    </div>
</body>
</html>
        `.trim();

        // Configurar opciones del correo
        const mailOptions = {
            from: '"CRM Ventas Rocca" <crm_noreply@roccacr.com>',
            to: emailsArray.join(', '),
            subject: `📌 Sticky Note: ${tituloEscapado}`,
            html: htmlContent,
            text: `
Sticky Note: ${titulo || 'Nueva Nota'}

${mensaje || ''}

Prioridad: ${prioridadTexto[prioridad] || 'Media'}
Creado por: ${creador_nombre || 'Sistema'}${creador_email ? ` (${creador_email})` : ''}
${netsuiteLink ? `\n\nVer en NetSuite: ${netsuiteLink}` : ''}

---
Este es un mensaje automático del sistema CRM Ventas Rocca.
            `.trim(),
        };

        console.log('📧 Configurando envío de correo...');
        console.log('📧 Destinatarios:', emailsArray.join(', '));
        console.log('📧 Asunto:', mailOptions.subject);
        console.log('📧 Link NetSuite:', netsuiteLink || 'No aplica');
        
        // Enviar correo (sin await para no bloquear)
        emailTransporter.sendMail(mailOptions, async (error, info) => {
            if (error) {
                console.error('❌ Error enviando correo de sticky note:', error);
                console.error('❌ Detalles del error:', JSON.stringify(error, null, 2));
            } else {
                console.log('✅ Correo de sticky note enviado exitosamente');
                console.log('✅ MessageId:', info.messageId);
                console.log('✅ Respuesta del servidor:', info.response);
                console.log('📧 Destinatarios:', emailsArray.join(', '));

                // Actualizar campo notificado en la base de datos
                try {
                    await executeQuery(
                        `UPDATE crm_stick_notes SET notificado = 1 WHERE id_sticknote = ?`,
                        [id_sticknote],
                        database
                    );
                    console.log(`✅ Campo 'notificado' actualizado para nota ${id_sticknote}`);
                } catch (updateError) {
                    console.error('❌ Error actualizando campo notificado:', updateError);
                }
            }
        });
        
        console.log('📧 Función sendMail llamada (proceso asíncrono iniciado)');
    } catch (error) {
        console.error('❌ Error en función enviarCorreoStickyNote:', error);
    }
};

// Exportar el objeto con todas las funciones
module.exports = sticknotes;
