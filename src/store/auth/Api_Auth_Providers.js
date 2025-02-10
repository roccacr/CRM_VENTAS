import { commonRequestData, fetchData } from "../../api";

/**
 * Realiza la autenticación del usuario.
 * @param {object} credentials - Credenciales del usuario (email y contraseña).
 * @returns {Promise<object>} - Objeto con la respuesta de la solicitud.
 */
// Función exportada que realiza la autenticación del usuario
export const singAuth = async ({ email, password }) => {
    // Crea un objeto requestData combinando commonRequestData con el email y la contraseña proporcionados
    const requestData = {
        ...commonRequestData,
        email,
        password,
    };

    // Realiza una solicitud utilizando fetchData y retorna la respuesta
    return await fetchData("login", requestData);
};

// Función exportada que realiza el proceso de cierre de sesión
export const exitLogout = async () => {
    // Retorna una cadena indicando que el proceso de cierre de sesión fue exitoso
    return "ok";
};


/**
 * Verifica si un usuario existe en la base de datos utilizando su correo electrónico.
 *
 * @param {Object} params - Parámetros para la solicitud.
 * @param {string} params.email - Correo electrónico del usuario a validar.
 * @returns {Promise<Object>} Promesa que resuelve con la respuesta de la API, que contiene los datos del usuario si existe.
 */
export const validarSiexisteUsuario = async ({ email }) => {
    // Prepara los datos necesarios para la solicitud, combinando datos comunes y el correo electrónico del usuario.
    const requestData = {
        ...commonRequestData, // Datos comunes para todas las solicitudes (headers, token de autenticación, etc.).
        email, // Correo electrónico del usuario a validar.
    };

    // Realiza una solicitud a la API para validar si el usuario existe.
    // El endpoint "admins/validarUsuario" se utiliza para verificar la existencia del usuario.
    const response = await fetchData("admins/validarUsuario", requestData);

    // Retorna la respuesta obtenida de la API.
    return response;
};




/**
 * Realiza una solicitud para la recuperación de contraseña de un usuario.
 *
 * @param {Object} params - Parámetros para la solicitud.
 * @param {string} params.email - Correo electrónico del usuario para la recuperación de contraseña.
 * @returns {Promise<Object>} La respuesta de la API con el resultado de la solicitud.
 */
export const recuperar_Contraseña = async ({ email }) => {
    // Prepara los datos necesarios para la solicitud, combinando datos comunes y el correo electrónico del usuario.
    const requestData = {
        ...commonRequestData, // Incluye datos comunes como headers y token de autenticación.
        email, // Correo electrónico del usuario para la recuperación de contraseña.
    };

    // Realiza una solicitud a la API para iniciar el proceso de recuperación de contraseña.
    // Utiliza el endpoint "admins/recuperar_Contrasena" para gestionar la solicitud.
    const response = await fetchData("admins/recuperar_Contrasena", requestData);

    // Retorna la respuesta obtenida de la API, que incluye el resultado de la solicitud.
    return response;
};