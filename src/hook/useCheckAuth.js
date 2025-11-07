import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setUserAuthentication, setUserLogout, verificacionUsuario } from "../store/auth/authSlice"; // Asegúrate de que la ruta al archivo auth.js sea correcta
import CryptoJS from "crypto-js";
import Cookies from "js-cookie";

/* Clave secreta para el descifrado (debe ser la misma clave utilizada para cifrar los datos) */
import { secretKey } from "../api";
/* ApiProvider para hacer llamadas al backend */
import { ApiProvider } from "../store/ApiProvider/ApiProvider";

/********************************************** HOOK PERSONALIZADO useCheckAuth ********************************************/

/**
 * Hook personalizado para verificar la autenticación del usuario
 * Valida el token expirado y recupera la sesión desde localStorage
 * @returns {string} - Estado de autenticación
 */
export const useCheckAuth = () => {
    const dispatch = useDispatch(); // Obtiene el dispatch para enviar acciones a Redux
    const { status } = useSelector((state) => state.auth); // Obtiene el estado de autenticación desde Redux

    useEffect(() => {
        /**
         * Función para validar si el token ha expirado
         * @param {string} expiresAtISO - Fecha ISO de expiración
         * @returns {boolean} - true si el token es válido
         */
        const isTokenValid = (expiresAtISO) => {
            if (!expiresAtISO) return false;
            const expiresAt = new Date(expiresAtISO).getTime();
            const now = Date.now();
            // Dar 5 minutos de margen (300000 ms)
            return expiresAt > (now + 300000);
        };

        /**
         * Función para verificar la autenticación del usuario
         * Valida primero con el backend y luego restaura la sesión
         */
        const checkAuth = async () => {
            try {
                // Obtener datos del localStorage
                const encryptedUserData = localStorage.getItem("payload_1");
                const tokenExpiresAt = localStorage.getItem("tokenExpiresAt");

                // Si no hay datos cifrados, no autenticar
                if (!encryptedUserData || !tokenExpiresAt) {
                    dispatch(setUserLogout({ errorMessage: "" }));
                    return;
                }

                // Validar si el token ha expirado localmente
                if (!isTokenValid(tokenExpiresAt)) {
                    // Limpiar datos si token expiró
                    localStorage.removeItem("payload_1");
                    localStorage.removeItem("tokenExpiresAt");
                    Cookies.remove("access_token");
                    Cookies.remove("refresh_token");
                    dispatch(setUserLogout({ errorMessage: "Tu sesión ha expirado. Por favor inicia sesión nuevamente." }));
                    return;
                }

                // Desencriptar los datos del usuario
                const decryptedUserData = decryptData(encryptedUserData, secretKey);

                if (decryptedUserData) {
                    // Primero restaurar la sesión en Redux (estado: "checking" → "authenticated")
                    dispatch(setUserAuthentication(decryptedUserData));

                    // Luego validar el token con el backend (de forma no bloqueante)
                    try {
                        const validationResponse = await ApiProvider({
                            transaccion: { token_admin: decryptedUserData.token_admin },
                            endpoint: "usuario/validarToken",
                        });

                        // Si el backend confirma que el token es válido
                        if (validationResponse?.data?.statusCode === 200) {
                            // Token válido
                        } else {
                            // Token inválido según el backend

                            // Limpiar datos si token es inválido
                            localStorage.removeItem("payload_1");
                            localStorage.removeItem("tokenExpiresAt");
                            Cookies.remove("access_token");
                            Cookies.remove("refresh_token");

                            // Cerrar sesión después de mostrar que se restauró
                            setTimeout(() => {
                                dispatch(setUserLogout({
                                    errorMessage: validationResponse?.data?.data || "Tu sesión ha expirado. Por favor inicia sesión nuevamente.",
                                }));
                            }, 500);
                        }
                    } catch (apiError) {
                        // Si no se puede validar con el backend, mantener la sesión con validación local
                    }
                } else {
                    // Error al desencriptar
                    dispatch(setUserLogout({ errorMessage: "" }));
                }
            } catch (error) {
                dispatch(setUserLogout({ errorMessage: "" }));
            }
        };

        checkAuth(); // Llama a la función de verificación de autenticación
    }, [dispatch]);

    return status; // Retorna el estado de autenticación
};

/********************************************** FUNCIÓN PARA DESENCRIPTAR DATOS ********************************************/

/**
 * Función para desencriptar los datos
 * @param {string} encryptedData - Datos cifrados
 * @param {string} key - Clave secreta para el descifrado
 * @returns {object|null} - Datos desencriptados o null en caso de error
 */
const decryptData = (encryptedData, key) => {
    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, key); // Desencripta los datos utilizando la clave secreta
        const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8)); // Convierte los bytes desencriptados a un objeto JavaScript
        return decryptedData; // Retorna los datos desencriptados
    } catch (error) {
        console.error("Error al descifrar los datos:", error); // Maneja el error en caso de fallo al desencriptar
        return null;
    }
};
