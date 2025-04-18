import { createSlice } from "@reduxjs/toolkit";

// Slice para el estado de autenticación
export const authSlice = createSlice({
   name: "auth",
   initialState: {
      // Estado inicial del slice
      status: "checking", // Estado de autenticación: 'checking', 'not-authenticated', 'authenticated', 'recoveringAccess'
      id_admin: null, // ID de usuario
      name_admin: null, // Nombre de usuario
      rol_admin: null, // Rol de usuario
      email_admin: null, // Correo electrónico de usuario
      token_admin: null, // Token de autenticación
      status_admin: null, // Estado de usuario
      errorMessage: null, // Mensaje de error, si lo hay
      idnetsuite_admin: null,
      microsoftUser: null,
      mensaje: null,
   },
   reducers: {
      /**
       * Actualiza el estado de verificación del usuario
       * Este reducer se utiliza para actualizar el estado de autenticación con un mensaje.
       * @param {Object} state - Estado actual de Redux
       * @param {Object} action - Acción de Redux con el payload
       */
      verificacionUsuario: (state, action) => {
         return {
            ...state,  // Propaga el estado actual
            status: action.payload.status,  // Actualiza el valor de status
            mensaje: action.payload.Mensaje,  // Actualiza el valor de mensaje
         };
      },
      setMicrosoftUser: (state, action) => {
         state.microsoftUser = {
            username: action.payload.name,
            email: action.payload.username,
            authorityType: action.payload.authorityType,
            idToken: action.payload.idToken,
         };
      },
      // Reducer para establecer la autenticación del usuario
      setUserAuthentication: (state, { payload }) => {
         state.status = "authenticated";
         state.id_admin = payload.id_admin;
         state.idnetsuite_admin = payload.idnetsuite_admin;
         state.name_admin = payload.name_admin;
         state.rol_admin = payload.id_rol_admin;
         state.email_admin = payload.email_admin;
         state.token_admin = payload.token_admin;
         state.status_admin = payload.status_admin;
         state.microsoftUser = payload.microsoftUser;
         state.errorMessage = "";
      },
      // Reducer para cerrar la sesión del usuario
      setUserLogout: (state, { payload }) => {
         state.status = "not-authenticated";
         state.id_admin = null;
         state.idnetsuite_admin = null;
         state.name_admin = null;
         state.rol_admin = null;
         state.email_admin = null;
         state.token_admin = null;
         state.status_admin = null;
         state.errorMessage = payload?.errorMessage;
         state.microsoftUser = null;
         localStorage.removeItem("payload_1");
      },
      // Reducer para establecer el estado de verificación de credenciales
      setCheckingCredentials: (state) => {
         state.status = "EnProceso";
      },
      // Reducer para establecer el estado de verificación de estado
      setLoadingCredentials: (state) => {
         state.status = "loading";
         state.errorMessage = "";
      },
      /**
       * Realiza el logout del usuario, reseteando el estado
       * Elimina todos los datos relacionados con el usuario y su sesión.
       * @param {Object} state - Estado actual de Redux
       * @param {Object} action - Acción de Redux con payload (por ejemplo, un mensaje)
       */
      logout: (state, action) => {
         state.status = "not-authenticated";
         state.id_admin = null;
         state.idnetsuite_admin = null;
         state.name_admin = null;
         state.rol_admin = null;
         state.email_admin = null;
         state.token_admin = null;
         state.status_admin = null;
         state.errorMessage = action.payload.mensaje;  
         state.microsoftUser = null;
         localStorage.removeItem("payload_1");
         
      },
   },
});

// Exporta los action creators generados para cada reducer
export const { setUserAuthentication, setUserLogout, setCheckingStatus, setCheckingCredentials, setLoadingCredentials, verificacionUsuario, setMicrosoftUser, logout } = authSlice.actions; 
