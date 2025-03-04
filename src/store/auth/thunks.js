/********************************************** MODULE IMPORTS ****************************************************/
import { errorMessages, secretKey } from "../../api";
import { setCheckingCredentials, setLoadingCredentials, setUserAuthentication, setUserLogout } from "./authSlice";

import { exitLogout, recuperar_Contraseña, singAuth, validarSiexisteUsuario } from "./Api_Auth_Providers";
import CryptoJS from "crypto-js";

// Esta acción verifica la autenticación del usuario de forma asíncrona
export const verifyAuthenticationAsync = () => async (dispatch) => {
    // Despacha una acción para indicar que se están verificando las credenciales
    dispatch(setCheckingCredentials());
};

//iniciar sesion de login
// Función exportada que inicia el proceso de autenticación
export const startAuthentication = ({ loginEmail, loginPassword }) => {
    // Asignación de los parámetros de entrada a variables locales
    const email = loginEmail;
    const password = loginPassword;

    // Retorna una función asíncrona que recibe el parámetro dispatch
    return async (dispatch) => {
        // Despacha una acción para indicar que se están verificando las credenciales
        dispatch(setLoadingCredentials());

        try {
            // Realiza la autenticación del usuario con las credenciales proporcionadas
            const result = await singAuth({ email, password });

            // Obtiene el código de estado y los datos del usuario del resultado de la autenticación
            const statusCode = result.data.statusCode;
            const userData = result.data;

            // Verifica el resultado de la autenticación
            if (!result.ok || statusCode === 500) {
                // Si la autenticación falla o hay un error en el servidor, despacha una acción para cerrar la sesión del usuario
                dispatch(setUserLogout({ errorMessage: errorMessages[0] }));
                return;
            } else if (statusCode === 210 || statusCode === 401) {
                // Si el código de estado es 210 (probablemente usuario no activo) o 401 (no autorizado), cierra la sesión del usuario
                dispatch(setUserLogout({ errorMessage: errorMessages[1] }));
                return;
            } else {
                // Desestructuración de los datos del usuario para verificar el estado de la recuperación de contraseña y el estado del usuario
                const { status_admin } = userData.data;

                // Si el usuario no está activo, cierra la sesión y muestra un mensaje de error
                if (status_admin === 0) {
                    dispatch(setUserLogout({ errorMessage: errorMessages[3] }));
                    return;
                }

                //Si todo sale bien autenticamos al usuario y cambiamos el estado de checking a authenticated
                dispatch(setUserAuthentication(userData.data));
                // Si todo sale bien guardamos al usuario en nuestro navegador pendiente de localStorage encriptado
                const payload_1 = CryptoJS.AES.encrypt(JSON.stringify(userData.data), secretKey).toString();
                localStorage.setItem("payload_1", payload_1);
            }
        } catch (error) {
            console.log("error: ", error);
            // En caso de cualquier error durante el proceso de autenticación, cierra la sesión y muestra un mensaje de error
            dispatch(setUserLogout({ errorMessage: "Error durante la autenticación (startAuthentication)" }));
        }
    };
};

// Función exportada que inicia el proceso de cierre de sesión
export const startLogout = () => {
    // Retorna una función asíncrona que recibe el parámetro dispatch
    return async (dispatch) => {
        // Despacha una acción para indicar que se están verificando las credenciales
        dispatch(setCheckingCredentials());

        // Llama a la función exitLogout para realizar el proceso de cierre de sesión
        await exitLogout();

        // Despacha una acción para cerrar la sesión del usuario y muestra un mensaje de error específico
        dispatch(setUserLogout({ errorMessage: errorMessages[4] }));
    };
};


/**
 * Valida si un usuario existe en la base de datos utilizando su correo electrónico.
 *
 * @param {string} email - Correo electrónico del usuario a validar.
 * @returns {Function} Función thunk que retorna una Promesa con los datos del usuario si existe, o un array vacío si no existe o hay un error.
 */
export const ValidarUsuario = (email) => {
    return async () => {
        try {
            // Llama a la API para verificar si el usuario existe utilizando el correo electrónico proporcionado.
            const resultado = await validarSiexisteUsuario({ email });

            console.log("resultado: ", resultado);

            // Retorna los datos del usuario si existe, o un array vacío si no hay datos válidos.
            return resultado?.data?.data || [];
        } catch (error) {
            // Captura y registra cualquier error ocurrido durante la solicitud.
            console.error("Error al validar el usuario:", error);

            // Retorna un array vacío en caso de error para evitar fallos en el flujo de la aplicación.
            return [];
        }
    };
};

/**
 * Solicita la recuperación de contraseña para un usuario utilizando su correo electrónico.
 *
 * @param {string} email - Correo electrónico del usuario para la recuperación de contraseña.
 * @returns {Function} Función thunk que retorna una Promesa con los datos de recuperación o un array vacío si hay un error.
 */
export const recuperarContraseña = (email) => {
    return async () => {
        try {
            // Llama a la API para iniciar el proceso de recuperación de contraseña utilizando el correo electrónico proporcionado.
            const resultado = await recuperar_Contraseña({ email });

            // Retorna los datos de la respuesta de la API, o un array vacío si no hay datos válidos.
            return resultado?.data?.data || [];
        } catch (error) {
            // Captura y registra cualquier error ocurrido durante la solicitud.
            console.error("Error al solicitar la recuperación de contraseña:", error);

            // Retorna un array vacío en caso de error para manejar el fallo de manera segura.
            return [];
        }
    };
};


