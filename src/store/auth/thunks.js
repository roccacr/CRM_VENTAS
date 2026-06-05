/********************************************** MODULE IMPORTS ****************************************************/
import { errorMessages } from "../../api";

import { exitLogout, recuperar_Contraseña as recuperarContrasenaApi, singAuth, validarSiexisteUsuario } from "./Api_Auth_Providers";
import { setCheckingCredentials, setLoadingCredentials, setUserAuthentication, setUserLogout } from "./authSlice";
import { clearAuthSession, persistAuthSession } from "./authSessionStorage";
import { logoutMicrosoftSession } from "./authThunksMicrosoft";


export const verifyAuthenticationAsync = () => async (dispatch) => {
    dispatch(setCheckingCredentials());
};


export const startAuthentication = ({ loginEmail, loginPassword }) => {
    const email = loginEmail;
    const password = loginPassword;

    return async (dispatch) => {
        dispatch(setLoadingCredentials());

        try {
            const result = await singAuth({ email, password });
            const statusCode = result.data.statusCode;
            const userData = result.data;

            if (!result.ok || statusCode === 500) {
                dispatch(setUserLogout({ errorMessage: errorMessages[0] }));
                return;
            }

            if (statusCode === 210 || statusCode === 401) {
                dispatch(setUserLogout({ errorMessage: errorMessages[1] }));
                return;
            }

            const { status_admin } = userData.data;

            if (status_admin === 0) {
                dispatch(setUserLogout({ errorMessage: errorMessages[3] }));
                return;
            }

            dispatch(setUserAuthentication(userData.data));
            persistAuthSession(userData.data);
        } catch (error) {
            dispatch(setUserLogout({ errorMessage: "Error durante la autenticación (startAuthentication)" }));
        }
    };
};


export const startLogout = () => {
    return async (dispatch, getState) => {
        const { token_admin } = getState().auth;

        dispatch(setCheckingCredentials());

        await exitLogout({ token_admin });
        await logoutMicrosoftSession();
        clearAuthSession();

        dispatch(setUserLogout({ errorMessage: errorMessages[4] }));
    };
};


export const ValidarUsuario = (email) => {
    return async () => {
        try {
            const resultado = await validarSiexisteUsuario({ email });

            return resultado?.data?.data || [];
        } catch (error) {
            console.error("Error al validar el usuario:", error);
            return [];
        }
    };
};


export const recuperarContrasena = (email) => {
    return async () => {
        try {
            const resultado = await recuperarContrasenaApi({ email });

            return resultado?.data?.data || [];
        } catch (error) {
            console.error("Error al solicitar la recuperación de contraseña:", error);
            return [];
        }
    };
};
