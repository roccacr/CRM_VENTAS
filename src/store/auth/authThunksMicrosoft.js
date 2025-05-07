import { PublicClientApplication } from "@azure/msal-browser";
import { MSAL_CLIENT_ID, MSAL_AUTHORITY, MSAL_REDIRECT_URI, secretKey } from "../../api/api";
import { useMsal } from "@azure/msal-react";
import { useDispatch } from "react-redux";
import { logout, setUserAuthentication, verificacionUsuario } from "./authSlice";
import { ApiProvider } from "../ApiProvider/ApiProvider";
import { useNavigate } from "react-router-dom";
import Cookies from "js-cookie";
import { useState } from "react";
import CryptoJS from "crypto-js";
/** ====================================================================================================================================
 * Configuración de MSAL para la autenticación con Azure AD.
 * @const {Object} msalConfig - Objeto de configuración de MSAL para la autenticación.
 * @property {Object} auth - Configuración de autenticación.
 * @property {string} auth.clientId - Identificador único del cliente (tu aplicación registrada en Azure AD).
 * @property {string} auth.authority - URL de autoridad para autenticar la solicitud (por ejemplo, el endpoint de Azure AD).
 * @property {string} auth.redirectUri - URI de redirección después de completar la autenticación.
 */
const msalConfig = {
   auth: {
      clientId: MSAL_CLIENT_ID, // Identificador único del cliente (tu aplicación registrada en Azure AD)
      authority: MSAL_AUTHORITY, // URL de autoridad para autenticar la solicitud (por ejemplo, endpoint de Azure AD)
      redirectUri: MSAL_REDIRECT_URI, // URI a la que se redirige después de completar la autenticación
   },
};

/** ====================================================================================================================================
 * Instancia pública de MSAL para la autenticación. Se utilizará para todas
 * las operaciones de autenticación con Microsoft.
 * @type {PublicClientApplication}
 */
export const pca = new PublicClientApplication(msalConfig);

/** ====================================================================================================================================
 *
 * Valida los parámetros de configuración de MSAL.
 * Verifica que todos los campos requeridos estén presentes y tengan un formato válido.
 * @throws {Error} Si algún parámetro de configuración es inválido o está ausente.
 *
 * Este método realiza las siguientes validaciones:
 * 1. Verifica que los parámetros `MSAL_CLIENT_ID`, `MSAL_AUTHORITY` y `MSAL_REDIRECT_URI` estén presentes.
 * 2. Valida que `MSAL_AUTHORITY` tenga el formato correcto, comenzando con `https://login.microsoftonline.com/`.
 * 3. Valida que `MSAL_REDIRECT_URI` sea una URL válida, comenzando con `http://` o `https://`.
 */
const validateMsalConfig = () => {
   // Verificar que todos los parámetros requeridos estén presentes
   if (!MSAL_CLIENT_ID || !MSAL_AUTHORITY || !MSAL_REDIRECT_URI) {
      throw new Error("Configuración de MSAL incompleta");
   }

   // Validar formato de la autoridad
   if (!MSAL_AUTHORITY.startsWith("https://login.microsoftonline.com/")) {
      throw new Error("MSAL_AUTHORITY debe comenzar con 'https://login.microsoftonline.com/'");
   }

   // Validar formato del URI de redirección
   if (!MSAL_REDIRECT_URI.startsWith("http://") && !MSAL_REDIRECT_URI.startsWith("https://")) {
      throw new Error("MSAL_REDIRECT_URI debe ser una URL válida");
   }
};

/** ====================================================================================================================================
 * Hook personalizado para la validación de configuración MSAL.
 * Proporciona un método para validar la configuración antes de iniciar el proceso de autenticación.
 * @returns {{validate: Function}} Objeto con la función de validación
 */
export const useMsalConfigValidation = () => ({
   validate: validateMsalConfig,
});

/** ====================================================================================================================================
 * Calcula las dimensiones y posición óptimas para la ventana emergente de autenticación.
 * Centra la ventana en la pantalla para una mejor experiencia de usuario.
 * @returns {{width: number, height: number, left: number, top: number}} Dimensiones y posición
 *
 * Este método realiza los siguientes cálculos:
 * 1. Establece un tamaño fijo para la ventana emergente: 500px de ancho y 600px de alto.
 * 2. Calcula la posición `left` y `top` para centrar la ventana en la pantalla del usuario.
 *
 * El cálculo de la posición se basa en las dimensiones de la pantalla del usuario, de modo que la ventana emergente se abra centrada.
 */
const calculatePopupDimensions = () => {
   const width = 500;
   const height = 600;
   const left = (window.screen.width - width) / 2;
   const top = (window.screen.height - height) / 2;
   return { width, height, left, top };
};

/** ====================================================================================================================================
 * Configura las opciones de la ventana emergente para el inicio de sesión.
 * Define las características visuales y de comportamiento de la ventana emergente.
 * @returns {Object} Configuración completa de la ventana emergente
 *
 * Esta función configura y retorna un objeto con las opciones necesarias para crear una ventana emergente:
 * 1. Utiliza las dimensiones calculadas previamente con la función `calculatePopupDimensions` para centrar la ventana.
 * 2. Define opciones para desactivar varias características visuales y de comportamiento de la ventana emergente (como barra de herramientas, menú, etc.).
 *
 * Las opciones incluidas aseguran que la ventana emergente se enfoque en el inicio de sesión sin distracciones adicionales.
 */
const getPopupWindowConfig = () => {
   const dimensions = calculatePopupDimensions();
   return {
      popup: true, // Indica que es una ventana emergente
      ...dimensions, // Propiedades calculadas de tamaño y posición (width, height, left, top)
      resizable: false, // Impide que la ventana se pueda redimensionar
      scrollbars: false, // Desactiva las barras de desplazamiento
      toolbar: false, // Desactiva la barra de herramientas
      menubar: false, // Desactiva el menú de la ventana
      location: false, // Desactiva la barra de ubicación (URL)
      status: false, // Desactiva la barra de estado
      fullscreen: false, // Desactiva el modo pantalla completa
   };
};

// ---------------------- GESTIÓN DE RESPUESTAS DE AUTENTICACIÓN ----------

/** ====================================================================================================================================
 * Procesa la respuesta del inicio de sesión y establece la cuenta activa.
 * Garantiza que haya una cuenta activa después del proceso de autenticación.
 * @param {Object} response - Respuesta de autenticación de MSAL
 * @param {Object} instance - Instancia de MSAL
 * @returns {Object} Cuenta activa del usuario
 * @throws {Error} Si no se puede obtener la cuenta del usuario
 *
 * Esta función procesa la respuesta de la autenticación proporcionada por MSAL, estableciendo la cuenta activa del usuario
 * dentro de la instancia de MSAL. Verifica que haya una cuenta activa y, en caso contrario, lanza un error.
 *
 * El flujo de la función es el siguiente:
 * 1. Si la respuesta de MSAL contiene una cuenta, se establece como la cuenta activa mediante `instance.setActiveAccount`.
 * 2. Luego se obtiene la cuenta activa a través de `instance.getActiveAccount`.
 * 3. Si no se puede obtener una cuenta activa, se lanza un error con el mensaje "No se pudo obtener la cuenta del usuario".
 */
const handleLoginResponse = (response, instance) => {
   // Establecer la cuenta como activa si está disponible
   if (response.account) {
      instance.setActiveAccount(response.account);
   }

   // Obtener la cuenta activa
   const account = instance.getActiveAccount();

   // Verificar que se haya obtenido una cuenta
   if (!account) {
      throw new Error("No se pudo obtener la cuenta del usuario");
   }

   return account;
};

/** ====================================================================================================================================
 * Obtiene la imagen de perfil del usuario desde Microsoft Graph API.
 * Realiza una solicitud a la API de Graph para obtener la foto de perfil.
 * @param {string} accessToken - Token de acceso para Microsoft Graph
 * @returns {Promise<string|null>} URL de la imagen o null si no se puede obtener
 *
 * Esta función realiza una solicitud HTTP a la Microsoft Graph API para obtener la foto de perfil del usuario autenticado.
 * Utiliza el token de acceso proporcionado para autenticar la solicitud.
 *
 * El flujo de la función es el siguiente:
 * 1. Se realiza una solicitud a la URL `https://graph.microsoft.com/v1.0/me/photo/$value` para obtener la foto de perfil.
 * 2. La solicitud utiliza el encabezado de autorización con el token de acceso (`Bearer ${accessToken}`).
 * 3. Si la respuesta es exitosa (`response.ok`), la foto se convierte a un `blob` y se crea una URL de objeto con `URL.createObjectURL(blob)`.
 * 4. Si la solicitud falla o no se puede obtener la foto, se devuelve `null`.
 * 5. Si ocurre un error en el proceso de la solicitud, se captura y se imprime en la consola, retornando también `null`.
 */
const getUserProfilePicture = async (accessToken) => {
   try {
      const response = await fetch("https://graph.microsoft.com/v1.0/me/photo/$value", {
         headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
         const blob = await response.blob();
         return URL.createObjectURL(blob);
      }

      return null;
   } catch (error) {
      console.error("Error al obtener la imagen de perfil:", error);
      return null;
   }
};

/** ====================================================================================================================================
 * Construye el objeto de datos del usuario con toda la información necesaria.
 * Consolida los datos del usuario, tokens y otros detalles en un objeto estructurado.
 * @param {Object} account - Cuenta del usuario de MSAL
 * @param {string} accessToken - Token de acceso
 * @param {Object} response - Respuesta completa de autenticación
 * @returns {Promise<Object>} Datos estructurados del usuario
 *
 * Esta función construye un objeto que contiene la información necesaria sobre el usuario autenticado,
 * incluyendo datos personales (nombre, correo electrónico, foto de perfil), así como tokens de acceso y
 * detalles adicionales de la cuenta obtenidos de MSAL y la respuesta de autenticación.
 *
 * El flujo de la función es el siguiente:
 * 1. **Obtención de la imagen de perfil**: Se llama a `getUserProfilePicture(accessToken)` para obtener la foto de perfil del usuario.
 * 2. **Construcción del objeto de datos del usuario**:
 *    - Se crea un objeto que contiene el `accessToken` junto con la información del usuario (nombre, correo y foto de perfil).
 *    - Se incluyen también los datos relacionados con Office 365 como el `accessToken`, `refreshToken`, `expiresIn`, `tenantId`, y `userId`.
 * 3. **Devolución del objeto**: La función devuelve una promesa que resuelve el objeto con todos los datos del usuario.
 */
const createUserData = async (account, accessToken, response) => {
   // Obtener la imagen de perfil
   const profilePicture = await getUserProfilePicture(accessToken);

   // Construir y retornar el objeto con los datos del usuario
   return {
      token: accessToken,
      user: {
         name: account.name,
         email: account.username,
         profilePicture: profilePicture || account.idTokenClaims?.picture || null,
      },
      o365Data: {
         accessToken,
         refreshToken: response.idToken,
         expiresIn: response.expiresOn.getTime() - Date.now(),
         tenantId: account.tenantId,
         userId: account.localAccountId,
      },
   };
};

/** ====================================================================================================================================
 * Maneja y procesa los errores durante la autenticación.
 * Actualiza el estado de la aplicación para reflejar el error y muestra mensajes apropiados.
 * @param {Error} error - Error ocurrido durante la autenticación
 * @param {Function} dispatch - Función dispatch de Redux
 *
 * Esta función se encarga de gestionar los errores que ocurren durante el proceso de autenticación.
 * Según el tipo de error, se define un mensaje adecuado y se actualiza el estado de la aplicación para reflejar
 * el error ocurrido. Además, el estado se restablece después de un breve período de tiempo.
 *
 * El flujo de la función es el siguiente:
 * 1. **Determinación del mensaje de error**: Si el error tiene el código "user_cancelled", el mensaje será "Has cancelado el inicio de sesión con Microsoft". Si no, se utiliza el mensaje de error proporcionado o un mensaje genérico.
 * 2. **Actualización del estado**: Se utiliza la función `dispatch` para actualizar el estado en Redux, estableciendo un estado de error y mostrando el mensaje correspondiente.
 * 3. **Restablecimiento del estado**: Después de 4 segundos, se restablece el estado de la autenticación en Redux, eliminando el mensaje de error y estableciendo el estado como "NoAutenticado".
 */
const handleLoginError = (error, dispatch) => {
   // Determinar el mensaje de error apropiado
   const mensaje =
      error.errorCode === "user_cancelled"
         ? "Has cancelado el inicio de sesión con Microsoft"
         : error.message || "Ocurrió un error durante el inicio de sesión";

   // Actualizar el estado para mostrar el error
   dispatch(verificacionUsuario({ status: "Error", Mensaje: mensaje }));

   // Restablecer el estado después de un tiempo
   setTimeout(
      () =>
         dispatch(
            verificacionUsuario({
               status: "NoAutenticado", // Estado de autenticación: 'checking', 'not-authenticated', 'authenticated', 'recoveringAccess'
               Mensaje: "",
            }),
         ),
      4000,
   );
};

/** ====================================================================================================================================
 * Verifica el estado del usuario en el sistema y determina si puede iniciar sesión.
 * Comprueba varias condiciones que podrían impedir el acceso del usuario.
 * @param {Object} resultado - Resultado de la validación del backend
 * @param {Function} dispatch - Función dispatch de Redux
 * @returns {boolean} true si la validación es exitosa, false si hay algún problema
 *
 * Esta función se encarga de verificar diferentes condiciones del estado del usuario,
 * como si está activo, si ha superado el límite de intentos fallidos, si está pendiente
 * de restablecer su contraseña o si no está verificado. Si alguna de estas condiciones
 * es cierta, se actualizará el estado de la aplicación, se realizará un logout y se
 * limpiarán los datos del almacenamiento local.
 *
 * Flujo de la función:
 * 1. **Extracción de datos**: Se extraen los datos relevantes del resultado proporcionado.
 * 2. **Definición de condiciones**: Se definen varias condiciones que pueden impedir el acceso del usuario.
 * 3. **Verificación de condiciones**: Se recorre cada condición y, si alguna se cumple, se realiza el logout y se actualiza el estado con el mensaje correspondiente.
 * 4. **Limpieza de almacenamiento**: Se eliminan elementos del almacenamiento local.
 * 5. **Resultado**: Si no se cumple ninguna condición que impida el acceso, la función retorna `true`.
 */
const verificarEstadoUsuario = (resultado, dispatch) => {
   // Extraer datos relevantes del resultado
   const { status_admin } = resultado.data.data.userData;

   // Definir condiciones que impedirían el acceso
   const condiciones = [
      {
         condicion: status_admin === 0,
         mensaje: "Su usuario está inactivo, favor comunicarse con el administrador del sistema",
      },
   ];

   // Verificar cada condición
   for (const { condicion, mensaje } of condiciones) {
      if (condicion) {
         // Actualizar el estado para mostrar el error
         dispatch(
            verificacionUsuario({
               status: "Error",
               Mensaje: `Lo sentimos, ${mensaje}`,
            }),
         );

         // Cerrar sesión
         dispatch(logout({ mensaje: `Lo sentimos, ${mensaje}` }));

         // Limpiar almacenamiento local
         localStorage.removeItem("preloading");
         localStorage.removeItem("persist:auth");
         localStorage.removeItem("persist:root");
         Cookies.remove("access_token");
         Cookies.remove("refresh_token");

         return false;
      }
   }

   return true;
};

/** ====================================================================================================================================
 * Guarda los tokens de acceso y refresco en cookies con configuraciones de seguridad.
 * Establece las cookies con los parámetros adecuados para mejorar la seguridad.
 * @param {string} accessToken - Token de acceso
 * @param {string} refreshToken - Token de refresco
 * @returns {Promise<boolean>} Retorna true si los tokens se guardan correctamente
 */
const saveTokensInCookies = async (accessToken, refreshToken) => {
   // Guardar token de acceso (corta duración - 1 hora)
   Cookies.set("access_token", accessToken, {
      secure: true,
      sameSite: "Strict",
      expires: 1 / 24, // Expiración de 1 hora
   });

   // Guardar token de refresco (larga duración - 30 días)
   Cookies.set("refresh_token", refreshToken, {
      httpOnly: true, // No accesible desde JavaScript
      secure: true,
      sameSite: "Strict",
      expires: 30, // Expiración de 30 días
   });

   return true;
};

/** ====================================================================================================================================
/**
 * Valida la sesión del usuario con el backend.
 * Esta función se encarga de enviar los datos del usuario al backend para verificar su acceso y estado.
 * Si la respuesta del servidor indica algún error, actualiza el estado de autenticación en la aplicación.
 * En caso de ser necesario, actualiza la información del usuario cuando la autenticación es realizada a través de Microsoft.
 *
 * @param {Object} datosUsuario - Datos del usuario a validar, que deben incluir los detalles necesarios para la autenticación.
 * @param {boolean} [isMicrosoft=false] - Indica si la autenticación fue realizada utilizando la plataforma Microsoft.
 *                                       Si es verdadero, se actualizará la información del usuario en el backend.
 * @returns {Function} Thunk para Redux que valida la sesión del usuario.
 *                     Si la validación es exitosa, se procesan los datos; si falla, se maneja el error correspondiente.
 *
 * @throws {Error} Si ocurre un error durante el proceso de validación o si el servidor responde con un error.
 */
export const validarSesion = (datosUsuario, isMicrosoft = false) => {
   return async (dispatch, getState) => {
      let transaccion = datosUsuario; // Datos del usuario que se enviarán al backend
      const endpoint = "usuario/verificaionDeUsuario"; // Endpoint de validación de usuario

      try {
         // Enviar los datos del usuario al backend para validación
         const resultado = await ApiProvider({ transaccion, endpoint });

         // Verificar si el servidor retornó un error (códigos 500 o 404)
         if (resultado?.data?.status === 500 || resultado?.data?.status === 404 || resultado?.data?.status === 401) {
            dispatch(
               verificacionUsuario({
                  status: "Error",
                  Mensaje: resultado?.data?.message,
               }),
            );
            return resultado?.data; // Retornar el mensaje de error si la validación falla
         }

         // Si la validación es exitosa (código 200)
         if (resultado?.data?.status === 200) {
            // Verificar el estado del usuario antes de proceder
            const estadoUsuario = verificarEstadoUsuario(resultado, dispatch);
            const resultadoValidacion = estadoUsuario ? resultado : false; // Solo retornar resultado si el estado es válido
            return resultadoValidacion; // Retornar el resultado de validación
         }

         return resultado; // Retornar el resultado de la validación
      } catch (error) {
         console.error("Error al validar la sesión:", error); // Registrar el error para diagnóstico
         throw error; // Lanza el error para ser manejado en un nivel superior
      }
   };
};

/** ====================================================================================================================================
 * Hook personalizado para manejar la autenticación con Microsoft.
 * Proporciona funciones y estado para el flujo de autenticación con Microsoft.
 *
 * Este hook se encarga de gestionar todo el proceso de autenticación con Microsoft,
 * desde la apertura de la ventana emergente para el inicio de sesión hasta la
 * validación de la sesión en el backend. Permite manejar el estado de la autenticación
 * y proporciona una función para iniciar el proceso de inicio de sesión.
 *
 * @returns {Object} Objeto con funciones y estado para la autenticación
 *   - inProgress: Estado actual del proceso de autenticación ("none" si no está en proceso, "microsoft" si está en curso).
 *   - handleLogin: Función para manejar el proceso de inicio de sesión con Microsoft.
 *   - handleLoginError: Función para manejar errores durante el inicio de sesión.
 */
export const useMicrosoftAuth = () => {
   const [inProgress, setInProgress] = useState("none"); // Estado del progreso de la autenticación
   const { instance } = useMsal(); // Instancia de MSAL para manejar la autenticación con Microsoft
   const dispatch = useDispatch(); // Función dispatch de Redux para actualizar el estado de la autenticación
   const { validate } = useMsalConfigValidation(); // Hook para validar la configuración de MSAL
   const navigate = useNavigate(); // Hook para manejar la navegación

   /**
    * Maneja el proceso completo de inicio de sesión con Microsoft.
    * Coordina todo el flujo desde la ventana emergente hasta la validación con el backend.
    *
    * Esta función inicia el proceso de inicio de sesión a través de la ventana emergente de MSAL,
    * luego maneja la respuesta, obtiene los datos del usuario y valida la sesión con el backend.
    * Finalmente, guarda los tokens y navega al usuario a la página principal si la autenticación es exitosa.
    *
    * @returns {Promise<string|null>} Estado de la autenticación ("Autenticado" si el proceso es exitoso,
    *                                 null si falla o el proceso no se completa).
    */
   const handleLogin = async () => {
      try {
         // Iniciar proceso de autenticación
         setInProgress("microsoft"); // Actualiza el estado a "en progreso"
         validate(); // Valida la configuración de MSAL
         dispatch(verificacionUsuario({ status: "EnProceso", Mensaje: "" })); // Actualiza el estado en Redux
         Cookies.remove("access_token"); // Elimina cualquier token almacenado previamente en las cookies

         // Configurar la solicitud de inicio de sesión
         const loginRequest = {
            scopes: ["User.Read", "profile"], // Ámbitos de acceso necesarios para la autenticación
            prompt: "select_account", // Solicita al usuario que seleccione su cuenta
         };

         // Mostrar ventana emergente de inicio de sesión y obtener respuesta
         const response = await instance.loginPopup({
            ...loginRequest,
            popupWindowFeatures: getPopupWindowConfig(), // Configuración adicional para la ventana emergente
         });

         // Procesar la respuesta de inicio de sesión
         const account = handleLoginResponse(response, instance);

         // Crear el objeto con los datos del usuario
         const userData = await createUserData(account, response.accessToken, response);

         
         // Obtener la imagen de perfil del usuario
         const profilePicture = await getUserProfilePicture(response.accessToken);
         userData.user.imageUsuario = profilePicture; // Asignar la imagen al objeto de usuario

         dispatch(verificacionUsuario({ status: "EnProceso", Mensaje: `Hola ${userData.user.name}` }));

         // Validar la sesión con el backend
         const resultadoValidacion = await dispatch(validarSesion(userData, true));

         // Procesar respuesta exitosa del backend
         if (resultadoValidacion?.data?.status === 200) {
            dispatch(
               verificacionUsuario({ status: "EnProceso", Mensaje: `Hola ${resultadoValidacion?.data?.data?.userData?.name_admin || ""}` }),
            );


      

            const userDataMicrosoft = {
              id_admin: resultadoValidacion?.data?.data?.userData?.id_admin,
              idnetsuite_admin: resultadoValidacion?.data?.data?.userData?.idnetsuite_admin,
              name_admin: resultadoValidacion?.data?.data?.userData?.name_admin,
               id_rol_admin: resultadoValidacion?.data?.data?.userData?.id_rol_admin,
               email_admin: resultadoValidacion?.data?.data?.userData?.email_admin,
               token_admin: resultadoValidacion?.data?.data?.userData?.token_admin,
               status_admin: resultadoValidacion?.data?.data?.userData?.status_admin,
               microsoftUser: {
                  username: userData.user.name,
                  email: userData.user.email,
                  idToken: userData.token,
                  authorityType: userData.authorityType ? userData.authorityType : "MSSTS",
                  profilePicture: userData.user.profilePicture,
                  new:userData
               },
            };


            //Si todo sale bien autenticamos al usuario y cambiamos el estado de checking a authenticated
            dispatch(setUserAuthentication(userDataMicrosoft));
            // Si todo sale bien guardamos al usuario en nuestro navegador pendiente de localStorage encriptado
            const payload_1 = CryptoJS.AES.encrypt(JSON.stringify(userDataMicrosoft), secretKey).toString();
            localStorage.setItem("payload_1", payload_1);
         }

         return null; // Si la validación no es exitosa, retornar null
      } catch (error) {
         handleLoginError(error, dispatch); // Manejar errores durante el inicio de sesión
      } finally {
         setInProgress("none"); // Restablecer el estado del progreso al finalizar
      }
   };

   return { inProgress, handleLogin, handleLoginError }; // Retornar los valores necesarios para el hook
};
