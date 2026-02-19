/**
 * Thunks para la gestión de Sticky Notes
 */

import {
    obtenerSticNotes,
    crearSticNote,
    editarSticNote,
    actualizarPosicionSticNote,
    cambiarVisibilidadSticNote,
    cambiarEstadoSticNote,
    obtenerSticNotePorId,
    actualizarPinSticNote,
    obtenerAdminsParaSticknotes,
    eliminarSticNote,
} from "./Api_provider_sticknotes";

/**
 * Obtiene todos los sticky notes para una transacción específica
 * Filtra por usuario autenticado (creador, asignado o notas públicas)
 * @param {string} transaction_type - Tipo de transacción (ej: ordersale)
 * @param {number} transaction_id - ID de la transacción
 * @returns {Function} - Función asincrónica de Redux
 */
export const obtenerSticNotesPorTransaccion = (transaction_type, transaction_id) => {
    return async (dispatch, getState) => {
        try {
            // Obtener el estado completo de auth
            const authState = getState().auth;
            const { idnetsuite_admin } = authState;

            const result = await obtenerSticNotes({
                transaction_type,
                transaction_id,
                id_usuario_autenticado: idnetsuite_admin,
            });
            return result;
        } catch (error) {
            throw error;
        }
    };
};

/**
 * Crea un nuevo sticky note
 * @param {Object} params - Parámetros de creación
 * @returns {Function} - Función asincrónica de Redux
 */
export const crearSticNotePorTransaccion = (params) => {
    return async (dispatch, getState) => {
        try {
            const { idnetsuite_admin } = getState().auth;
            if (idnetsuite_admin === undefined || idnetsuite_admin === null || idnetsuite_admin === "") {
                throw new Error("No se pudo identificar el usuario autenticado para crear la nota.");
            }

            const result = await crearSticNote({
                ...params,
                id_usuario_creador: idnetsuite_admin,
            });
            return result;
        } catch (error) {
            throw error;
        }
    };
};

/**
 * Edita un sticky note existente
 * @param {Object} params - Parámetros de edición
 * @returns {Function} - Función asincrónica de Redux
 */
export const editarSticNotePorId = (params) => {
    return async (dispatch, getState) => {
        try {
            const result = await editarSticNote(params);
            return result;
        } catch (error) {
            throw error;
        }
    };
};

/**
 * Actualiza la posición de un sticky note cuando se arrastra
 * @param {Object} params - Parámetros de posición
 * @returns {Function} - Función asincrónica de Redux
 */
export const actualizarPosicionSticNotePorId = (params) => {
    return async (dispatch, getState) => {
        try {
            const result = await actualizarPosicionSticNote(params);
            return result;
        } catch (error) {
            throw error;
        }
    };
};

/**
 * Cambia la visibilidad de un sticky note
 * @param {Object} params - Parámetros de visibilidad
 * @returns {Function} - Función asincrónica de Redux
 */
export const cambiarVisibilidadSticNotePorId = (params) => {
    return async (dispatch, getState) => {
        try {
            const result = await cambiarVisibilidadSticNote(params);
            return result;
        } catch (error) {
            throw error;
        }
    };
};

/**
 * Cambia el estado de un sticky note
 * @param {Object} params - Parámetros de estado
 * @returns {Function} - Función asincrónica de Redux
 */
export const cambiarEstadoSticNotePorId = (params) => {
    return async (dispatch, getState) => {
        try {
            const result = await cambiarEstadoSticNote(params);
            return result;
        } catch (error) {
            throw error;
        }
    };
};

/**
 * Obtiene un sticky note específico por su ID
 * @param {number} id_sticknote - ID del sticky note
 * @returns {Function} - Función asincrónica de Redux
 */
export const obtenerSticNotePorIdThunk = (id_sticknote) => {
    return async (dispatch, getState) => {
        try {
            const result = await obtenerSticNotePorId({ id_sticknote });
            return result;
        } catch (error) {
            throw error;
        }
    };
};

/**
 * Actualiza el estado PIN de un sticky note
 * @param {Object} params - Parámetros de PIN
 * @returns {Function} - Función asincrónica de Redux
 */
export const actualizarPinSticNotePorId = (params) => {
    return async (dispatch, getState) => {
        try {
            const result = await actualizarPinSticNote(params);
            return result;
        } catch (error) {
            throw error;
        }
    };
};

/**
 * Obtiene la lista de administradores para asignar notas
 * @param {number} p_estado - Estado del administrador (1 = activo)
 * @returns {Function} - Función asincrónica de Redux
 */
export const obtenerAdminsParaSticknotesThunk = (p_estado = 1) => {
    return async (dispatch, getState) => {
        try {
            const result = await obtenerAdminsParaSticknotes({ p_estado });
            return result;
        } catch (error) {
            throw error;
        }
    };
};

/**
 * Elimina un sticky note por su ID
 * @param {number} id_sticknote - ID del sticky note a eliminar
 * @returns {Function} - Función asincrónica de Redux
 */
export const eliminarSticNotePorId = (id_sticknote) => {
    return async (dispatch, getState) => {
        try {
            const result = await eliminarSticNote({ id_sticknote });
            return result;
        } catch (error) {
            throw error;
        }
    };
};
