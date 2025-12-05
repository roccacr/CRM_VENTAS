/**
 * Módulo Api_provider_sticknotes - Encargado de manejar las solicitudes API para Sticky Notes
 */

import { commonRequestData, fetchData } from "../../api";

/**
 * Obtiene todos los sticky notes para una transacción específica
 * @param {Object} params - Parámetros de la solicitud
 * @param {string} params.transaction_type - Tipo de transacción
 * @param {number} params.transaction_id - ID de la transacción
 * @returns {Promise} - Respuesta de la API
 */
export const obtenerSticNotes = async ({ transaction_type, transaction_id , id_usuario_autenticado}) => {   
    const requestData = {
        ...commonRequestData,
        transaction_type,
        transaction_id,
        id_usuario_autenticado,
    };

    const response = await fetchData("sticknotes/obtener", requestData);
    return response;
};

/**
 * Crea un nuevo sticky note
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.idinterno_lead - ID interno del lead
 * @param {string} params.transaction_type - Tipo de transacción
 * @param {number} params.transaction_id - ID de la transacción
 * @param {string} params.titulo - Título del sticky note
 * @param {string} params.mensaje - Contenido del mensaje
 * @param {string} params.color_hex - Color en formato HEX
 * @param {number} params.pos_x - Posición X
 * @param {number} params.pos_y - Posición Y
 * @param {number} params.id_usuario_creador - ID del usuario creador
 * @param {number} params.privado - Si es privado (0/1)
 * @param {number} params.id_usuario_asignado - ID del usuario asignado
 * @param {string} params.prioridad - Prioridad (baja, media, alta)
 * @param {string} params.categoria - Categoría
 * @returns {Promise} - Respuesta de la API
 */
export const crearSticNote = async ({
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
    prioridad,
    categoria,
}) => {
    const requestData = {
        ...commonRequestData,
        idinterno_lead,
        transaction_type,
        transaction_id,
        titulo,
        mensaje,
        color_hex,
        pos_x,
        pos_y,
        id_usuario_creador,
        privado: privado || 0,
        id_usuario_asignado: id_usuario_asignado || null,
        prioridad: prioridad || "media",
        categoria: categoria || "general",
    };

    const response = await fetchData("sticknotes/crear", requestData);
    return response;
};

/**
 * Edita un sticky note existente
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.id_sticknote - ID del sticky note
 * @param {string} params.titulo - Nuevo título
 * @param {string} params.mensaje - Nuevo mensaje
 * @param {string} params.color_hex - Nuevo color
 * @returns {Promise} - Respuesta de la API
 */
export const editarSticNote = async ({
    id_sticknote,
    titulo,
    mensaje,
    color_hex,
}) => {
    const requestData = {
        ...commonRequestData,
        id_sticknote,
        titulo,
        mensaje,
        color_hex,
    };

    const response = await fetchData("sticknotes/editar", requestData);
    return response;
};

/**
 * Actualiza la posición de un sticky note
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.id_sticknote - ID del sticky note
 * @param {number} params.pos_x - Nueva posición X
 * @param {number} params.pos_y - Nueva posición Y
 * @returns {Promise} - Respuesta de la API
 */
export const actualizarPosicionSticNote = async ({
    id_sticknote,
    pos_x,
    pos_y,
}) => {
    const requestData = {
        ...commonRequestData,
        id_sticknote,
        pos_x,
        pos_y,
    };

    const response = await fetchData("sticknotes/posicion", requestData);
    return response;
};

/**
 * Cambia la visibilidad de un sticky note
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.id_sticknote - ID del sticky note
 * @param {number} params.visible - Nuevo estado de visibilidad (0 o 1)
 * @returns {Promise} - Respuesta de la API
 */
export const cambiarVisibilidadSticNote = async ({
    id_sticknote,
    visible,
}) => {
    const requestData = {
        ...commonRequestData,
        id_sticknote,
        visible,
    };

    const response = await fetchData("sticknotes/visibilidad", requestData);
    return response;
};

/**
 * Cambia el estado de un sticky note
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.id_sticknote - ID del sticky note
 * @param {number} params.estado - Nuevo estado (0 o 1)
 * @param {number} params.visible - Visibilidad (0 o 1) - Opcional
 * @returns {Promise} - Respuesta de la API
 */
export const cambiarEstadoSticNote = async ({
    id_sticknote,
    estado,
    visible,
}) => {
    const requestData = {
        ...commonRequestData,
        id_sticknote,
        estado,
    };

    // Incluir visible si se proporciona
    if (visible !== undefined) {
        requestData.visible = visible;
    }

    const response = await fetchData("sticknotes/estado", requestData);
    return response;
};

/**
 * Obtiene un sticky note específico por su ID
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.id_sticknote - ID del sticky note
 * @returns {Promise} - Respuesta de la API
 */
export const obtenerSticNotePorId = async ({ id_sticknote }) => {
    const requestData = {
        ...commonRequestData,
        id_sticknote,
    };

    const response = await fetchData("sticknotes/obtener-por-id", requestData);
    return response;
};

/**
 * Actualiza el estado PIN de un sticky note
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.id_sticknote - ID del sticky note
 * @param {number} params.pin - Nuevo estado PIN (0 o 1)
 * @returns {Promise} - Respuesta de la API
 */
export const actualizarPinSticNote = async ({
    id_sticknote,
    pin,
}) => {
    const requestData = {
        ...commonRequestData,
        id_sticknote,
        pin,
    };

    const response = await fetchData("sticknotes/pin", requestData);
    return response;
};

/**
 * Obtiene la lista de administradores para asignar notas
 * @param {Object} params - Parámetros de la solicitud
 * @param {number} params.p_estado - Estado del administrador (1 = activo)
 * @returns {Promise} - Respuesta de la API
 */
export const obtenerAdminsParaSticknotes = async ({ p_estado = 1 }) => {
    const requestData = {
        ...commonRequestData,
        p_estado,
    };

    const response = await fetchData("leads/getDataSelect_Admins", requestData);
    return response;
};
