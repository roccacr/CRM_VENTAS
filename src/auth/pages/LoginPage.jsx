import { Link as RouterLink } from "react-dom/client";
import { Link } from "react-router-dom";
import { useForm } from "../../hook";
import { useDispatch, useSelector } from "react-redux";
// import { startAuthentication } from "@ThunksL";
import { TextField } from "@mui/material";
import { useMemo } from "react";
import { Auth_Layout } from "../layout/Auth_Layout";
import { startAuthentication } from "../../store/auth/thunks";
import { useMicrosoftAuth } from "../../store/auth/authThunksMicrosoft";

import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";

/* Definimos nuestras variables vacías */
const loginFormData = {
   loginEmail: localStorage.getItem("rememberedEmail") || "", // Set initial value as empty string
   loginPassword: "", // Set initial value as empty string
   rememberLogin: (localStorage.getItem("rememberLogin") || "false") === "true",
};

export const LoginPage = () => {
   const dispatch = useDispatch();

   // useEffect(() => {
   //     // dispatch(startLoadingLeads());
   // }, [dispatch]);

   // Obtiene el estado de autenticación del store
   const { status, errorMessage } = useSelector((state) => state.auth);

   // Determina si el estado es de carga
   const isLoading = useMemo(() => status === "loading", [status]);

   // Inicializa el formulario con el hook personalizado useForm
   const { loginEmail, loginPassword, rememberLogin, onInputChange } = useForm(loginFormData);

   // Función para manejar el envío del formulario
   const onSubmit = (event) => {
      event.preventDefault();

      // Almacena el email en localStorage solo si el usuario ha marcado la casilla de recordar
      localStorage.setItem("rememberedEmail", rememberLogin ? loginEmail : "");

      // Almacena el estado de la casilla de recordar en localStorage
      localStorage.setItem("rememberLogin", rememberLogin ? "true" : "false");

      // Despacha la acción para verificar la autenticación del usuario
      dispatch(startAuthentication({ loginEmail, loginPassword }));
   };

   const { inProgress, handleLogin } = useMicrosoftAuth();
   const { mensaje } = useSelector((state) => state.auth);

   return (
      // Utiliza el componente AuthLayout con el título "login"
      <Auth_Layout title="login">
         <div className="text-center">
            {/* Imagen del logotipo del sistema administrativo */}
            <img src="/assets/logo2.jpg" alt="images" className="mb-1" style={{ maxWidth: "100%", height: "92px" }} />
            {/* Descripción debajo del logotipo */}
            <br />
            <br />
            <p className="mb-3">Ingreso al sistema administrativo</p>
         </div>
         {isLoading && (
            <div className="d-flex justify-content-center">
               <button className="btn btn-dark lh-1" type="button" disabled="">
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  &nbsp;&nbsp; Espere un momento.....
               </button>
            </div>
         )}
         <LoginStatusIndicator authUsuario={status} mensaje={mensaje} />

         <br />
         {/* Campo de entrada para el correo electrónico */}
         <div className="mb-3">
            <TextField
               disabled={isLoading}
               type="email"
               className="form-control"
               id="floatingInput"
               name="loginEmail"
               onChange={onInputChange}
               value={loginEmail}
               placeholder="Correo administrativo"
            />
         </div>
         {/* Campo de entrada para la contraseña */}
         <div className="mb-3">
            <TextField
               disabled={isLoading}
               type="password"
               className="form-control"
               id="floatingInput1"
               name="loginPassword"
               onChange={onInputChange}
               value={loginPassword}
               placeholder="Contraseña"
            />
         </div>
         {!!errorMessage && (
            <div className="alert alert-danger d-flex align-items-center" role="alert">
               <div>{errorMessage}</div>
            </div>
         )}
         <div className="d-flex mt-1 justify-content-between align-items-center">
            <div className="form-check">
               {/* Checkbox para recordar acceso */}
               <input
                  className="form-check-input input-dark"
                  type="checkbox"
                  id="customCheckc1"
                  checked={rememberLogin}
                  name="rememberLogin"
                  onChange={onInputChange}
               />
               <label className="form-check-label text-muted" htmlFor="customCheckc1">
                  ¿Recordar acceso?{" "}
               </label>
            </div>
            {/* Enlace para recuperar contraseña utilizando RouterLink */}
            <Link component={RouterLink} to="/auth/recover-pass">
               <h6 className="f-w-400 mb-0">¿Olvidaste contraseña?</h6>
            </Link>
         </div>

         {/* Botón para iniciar sesión */}
         <div className="d-grid mt-4">
            <button onClick={onSubmit} disabled={isLoading} type="submit" className="btn btn-dark">
               Iniciar sesión
            </button>
         </div>

         <div className="d-grid mt-3">
            <button
               onClick={handleLogin}
               disabled={inProgress === "microsoft"}
               className="btn w-100"
               style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #dee2e6",
                  borderRadius: "4px",
                  padding: "8px",
                  height: "45px",
               }}
            >
               <img src="/assets/authentication/microsoft.png" alt="Microsoft" style={{ maxWidth: "180px", height: "auto" }} />
            </button>
         </div>
      </Auth_Layout>
   );
};

/** ====================================================================================================================================
 * Componente que muestra el estado actual del proceso de autenticación.
 * @param {string} authUsuario - Estado actual de la autenticación
 * @param {string} mensaje - Mensaje de error (si existe)
 * @returns {JSX.Element} Indicador de estado de autenticación
 */
const LoginStatusIndicator = ({ authUsuario, mensaje }) => {
   if (authUsuario === "EnProceso") {
      return (
         <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", my: 4, gap: 2 }}>
            <CircularProgress />
            <span> {mensaje} estamos verificando la cuenta espere un momento...</span>
         </Box>
      );
   }

   if (authUsuario === "Error") {
      return <Box sx={{ color: "error.main", textAlign: "center", my: 2 }}>{mensaje}</Box>;
   }

   return null;
};
