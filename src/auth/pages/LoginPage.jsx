import { useMemo } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Link, TextField } from "@mui/material";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";

import { useForm } from "../../hook";
import { startAuthentication } from "../../store/auth/thunks";
import { useMicrosoftAuth } from "../../store/auth/authThunksMicrosoft";
import { Auth_Layout } from "../layout/Auth_Layout";

const loginFormData = {
   loginEmail: "",
   loginPassword: "",
};


export const LoginPage = () => {
   const dispatch = useDispatch();
   const { status, errorMessage, mensaje } = useSelector((state) => state.auth);
   const isLoading = useMemo(() => status === "loading", [status]);
   const { loginEmail, loginPassword, onInputChange } = useForm(loginFormData);
   const { inProgress, handleLogin } = useMicrosoftAuth();

   const onSubmit = (event) => {
      event.preventDefault();
      dispatch(startAuthentication({ loginEmail, loginPassword }));
   };

   return (
      <Auth_Layout title="login">
         <div className="text-center">
            <img src="/assets/logo2.jpg" alt="images" className="mb-1" style={{ maxWidth: "100%", height: "92px" }} />
            <br />
            <br />
            <p className="mb-3">Ingreso al sistema administrativo</p>
         </div>

         {isLoading && (
            <div className="d-flex justify-content-center">
               <button className="btn btn-dark lh-1" type="button" disabled>
                  <span className="spinner-border spinner-border-sm" role="status"></span>
                  &nbsp;&nbsp; Espere un momento.....
               </button>
            </div>
         )}

         <LoginStatusIndicator authUsuario={status} mensaje={mensaje} />

         <br />

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
            <Link component={RouterLink} to="/auth/recover-pass">
               <h6 className="f-w-400 mb-0">¿Olvidaste contraseña?</h6>
            </Link>
         </div>

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
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
               }}
            >
               <img src="/assets/authentication/microsoft.png" alt="Microsoft" style={{ maxWidth: "100px", height: "auto" }} />
            </button>
         </div>
      </Auth_Layout>
   );
};


const LoginStatusIndicator = ({ authUsuario, mensaje }) => {
   if (authUsuario === "EnProceso") {
      return (
         <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", my: 4, gap: 2 }}>
            <CircularProgress />
            <span>{mensaje} estamos verificando la cuenta espere un momento...</span>
         </Box>
      );
   }

   if (authUsuario === "Error") {
      return <Box sx={{ color: "error.main", textAlign: "center", my: 2 }}>{mensaje}</Box>;
   }

   return null;
};
