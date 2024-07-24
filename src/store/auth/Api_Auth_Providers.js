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
