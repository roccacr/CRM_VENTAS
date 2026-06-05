import { useState } from "react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import { useDispatch } from "react-redux";

import { initializeMSAL, loginRequest, msalInstance } from "../../config/msalConfig";
import { ApiProvider } from "../ApiProvider/ApiProvider";
import { logout, setUserAuthentication, setUserLogout, verificacionUsuario } from "./authSlice";
import { clearAuthSession, persistAuthSession, readAuthSession } from "./authSessionStorage";

const validateMsalConfig = () => {
  if (!msalInstance) {
    throw new Error("MSAL no está inicializado");
  }
};


const getCachedAccount = () => {
  const activeAccount = msalInstance.getActiveAccount();

  if (activeAccount) {
    return activeAccount;
  }

  const accounts = msalInstance.getAllAccounts();

  if (accounts.length === 0) {
    return null;
  }

  msalInstance.setActiveAccount(accounts[0]);

  return accounts[0];
};


const buildBackendMicrosoftPayload = (account) => ({
  user: {
    name: account?.name || "",
    email: account?.username || "",
  },
});


const buildAuthenticatedUser = (backendResult, account, profilePicture = null) => ({
  id_admin: backendResult?.id_admin,
  idnetsuite_admin: backendResult?.idnetsuite_admin,
  name_admin: backendResult?.name_admin,
  id_rol_admin: backendResult?.id_rol_admin,
  email_admin: backendResult?.email_admin,
  token_admin: backendResult?.token_admin,
  status_admin: backendResult?.status_admin,
  microsoftUser: {
    username: account?.name || backendResult?.name_admin || "",
    email: account?.username || backendResult?.email_admin || "",
    authorityType: account?.tenantId ? "MSSTS" : "",
    tenantId: account?.tenantId || null,
    userId: account?.localAccountId || null,
    profilePicture: profilePicture || account?.idTokenClaims?.picture || null,
  },
});


const getUserProfilePicture = async (accessToken) => {
  try {
    const response = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();

    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};


const acquireMicrosoftToken = async (account, interactiveFallback = false) => {
  const request = {
    ...loginRequest,
    account,
  };

  try {
    return await msalInstance.acquireTokenSilent(request);
  } catch (error) {
    if (interactiveFallback && error instanceof InteractionRequiredAuthError) {
      return await msalInstance.acquireTokenPopup(request);
    }

    throw error;
  }
};


const validateBackendUserState = (backendResponse, dispatch) => {
  const backendUser = backendResponse?.data?.userData;

  if (!backendUser) {
    dispatch(setUserLogout({ errorMessage: "No se pudo validar la cuenta en CRM." }));
    clearAuthSession();
    return false;
  }

  if (backendUser.status_admin === 0) {
    dispatch(logout({ mensaje: "Lo sentimos, su usuario está inactivo. Favor comunicarse con el administrador del sistema." }));
    clearAuthSession();
    return false;
  }

  return true;
};


const verifyMicrosoftUserInBackend = async (account) => {
  const response = await ApiProvider({
    transaccion: buildBackendMicrosoftPayload(account),
    endpoint: "usuario/verificaionDeUsuario",
  });

  if (!response?.ok) {
    return null;
  }

  return response.data;
};


const validateStoredToken = async (token_admin) => {
  const response = await ApiProvider({
    transaccion: { token_admin },
    endpoint: "usuario/validarToken",
  });

  if (!response?.ok) {
    return null;
  }

  return response.data;
};


const buildStoredAuthenticatedUser = (storedSession, validationResponse) => ({
  ...storedSession,
  ...validationResponse?.userData,
});


export const restoreMicrosoftSession = () => {
  return async (dispatch) => {
    try {
      await initializeMSAL();
      await msalInstance.handleRedirectPromise();

      const account = getCachedAccount();

      if (!account) {
        return false;
      }

      await acquireMicrosoftToken(account, false);

      const backendResponse = await verifyMicrosoftUserInBackend(account);

      if (!backendResponse || backendResponse.status !== 200) {
        return false;
      }

      if (!validateBackendUserState(backendResponse, dispatch)) {
        return false;
      }

      const authenticatedUser = buildAuthenticatedUser(backendResponse.data.userData, account);

      dispatch(setUserAuthentication(authenticatedUser));
      persistAuthSession(authenticatedUser);

      return true;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        return false;
      }

      return false;
    }
  };
};


const restoreStoredSession = () => {
  return async (dispatch) => {
    const storedSession = readAuthSession();

    if (!storedSession?.token_admin) {
      clearAuthSession();
      return false;
    }

    const validationResponse = await validateStoredToken(storedSession.token_admin);

    if (validationResponse?.statusCode !== 200) {
      clearAuthSession();
      return false;
    }

    if (validationResponse.userData?.status_admin === 0) {
      clearAuthSession();
      dispatch(logout({ mensaje: "Lo sentimos, su usuario está inactivo. Favor comunicarse con el administrador del sistema." }));
      return false;
    }

    const authenticatedUser = buildStoredAuthenticatedUser(storedSession, validationResponse);

    dispatch(setUserAuthentication(authenticatedUser));
    persistAuthSession(authenticatedUser);
    return true;
  };
};


export const restoreSession = () => {
  return async (dispatch, getState) => {
    const microsoftRestored = await dispatch(restoreMicrosoftSession());

    if (microsoftRestored) {
      return true;
    }

    const storedSessionRestored = await dispatch(restoreStoredSession());

    if (storedSessionRestored) {
      return true;
    }

    if (getState().auth.status === "checking") {
      dispatch(setUserLogout({ errorMessage: "" }));
    }

    return false;
  };
};


export const logoutMicrosoftSession = async () => {
  try {
    await initializeMSAL();

    const account = getCachedAccount();

    if (!account) {
      return;
    }

    await msalInstance.logoutPopup({
      account,
      mainWindowRedirectUri: "/auth/login",
    });
  } catch {
    // No bloquear logout local si cierre Microsoft falla.
  }
};


export const validarSesion = (account) => {
  return async (dispatch) => {
    const backendResponse = await verifyMicrosoftUserInBackend(account);

    if (!backendResponse || backendResponse.status !== 200) {
      dispatch(
        verificacionUsuario({
          status: "Error",
          Mensaje: backendResponse?.message || "No se pudo validar la cuenta con CRM.",
        }),
      );

      return null;
    }

    if (!validateBackendUserState(backendResponse, dispatch)) {
      return null;
    }

    return backendResponse;
  };
};


export const useMicrosoftAuth = () => {
  const [inProgress, setInProgress] = useState("none");
  const { instance } = useMsal();
  const dispatch = useDispatch();

  const handleLogin = async () => {
    try {
      setInProgress("microsoft");
      validateMsalConfig();
      dispatch(verificacionUsuario({ status: "EnProceso", Mensaje: "" }));

      const response = await instance.loginPopup(loginRequest);
      const account = response.account || instance.getActiveAccount();

      if (!account) {
        throw new Error("No se pudo obtener la cuenta del usuario");
      }

      instance.setActiveAccount(account);

      const tokenResponse = await acquireMicrosoftToken(account, true);
      const profilePicture = await getUserProfilePicture(tokenResponse.accessToken);
      const backendResponse = await dispatch(validarSesion(account));

      if (!backendResponse?.data?.userData) {
        return null;
      }

      const authenticatedUser = buildAuthenticatedUser(
        backendResponse.data.userData,
        account,
        profilePicture,
      );

      dispatch(setUserAuthentication(authenticatedUser));
      persistAuthSession(authenticatedUser);

      return authenticatedUser;
    } catch (error) {
      const message = error?.message || "Ocurrió un error durante el inicio de sesión con Microsoft.";

      clearAuthSession();
      dispatch(
        verificacionUsuario({
          status: "Error",
          Mensaje: message,
        }),
      );

      setTimeout(() => {
        dispatch(setUserLogout({ errorMessage: "" }));
      }, 4000);

      return null;
    } finally {
      setInProgress("none");
    }
  };

  return { inProgress, handleLogin };
};
