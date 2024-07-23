import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setUserAuthentication, setUserLogout } from "../store/auth"; // Asegúrate de que la ruta al archivo auth.js sea correcta
import CryptoJS from "crypto-js";

/* Clave secreta para el descifrado (debe ser la misma clave utilizada para cifrar los datos) */
import { secretKey } from "../api";

/********************************************** HOOK PERSONALIZADO useCheckAuth ********************************************/

/**
 * Hook personalizado para verificar la autenticación del usuario
 * @returns {string} - Estado de autenticación
 */
export const useCheckAuth = () => {
    const dispatch = useDispatch(); // Obtiene el dispatch para enviar acciones a Redux
    const { status } = useSelector((state) => state.auth); // Obtiene el estado de autenticación desde Redux

    useEffect(() => {
        /**
         * Función para verificar la autenticación del usuario
         */
        const checkAuth = () => {
            const encryptedUserData = localStorage.getItem("payload_1"); // Obtiene los datos de usuario cifrados desde el localStorage

            if (!encryptedUserData) {
                // Si no hay datos cifrados, se realiza el logout
                return dispatch(setUserLogout({ errorMessage: "" }));
            }

            const decryptedUserData = decryptData(encryptedUserData, secretKey); // Desencripta los datos del usuario

            if (decryptedUserData) {
                // Si los datos se desencriptaron correctamente, se realiza el login
                dispatch(setUserAuthentication(decryptedUserData));
            }
        };

        checkAuth(); // Llama a la función de verificación de autenticación
    }, []);

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
