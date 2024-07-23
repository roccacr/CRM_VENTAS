import { Auth_Layout } from "../layout/Auth_Layout";
import { Link } from "react-router-dom";
import { Link as RouterLink } from "react-dom/client";
import { TextField } from "@mui/material";
export const RecoverPass = () => {
  return (
    // 5. Utiliza el componente AuthLayout con el título "recover".
    <Auth_Layout title="recover">
      <form className="animate__animated animate__fadeIn animate__faster">
        {/*Importamos el logo del componente*/}
        <div className="text-center">
          {/* Imagen del logotipo del sistema administrativo */}
          <img
            src="/assets/logo2.jpg"
            alt="images"
            className="mb-1"
            style={{ maxWidth: "100%", height: "92px" }}
          />
          {/* Descripción debajo del logotipo */}
          <br />
          <br />
          <p className="mb-3">Recuperar Acceso al sistema</p>
        </div>
        {/*Importamos el logo del componente*/}

        {/*Campo de entrada para el correo electrónico */}
        <div className="mb-3">
          <TextField
            type="email"
            className="form-control"
            id="floatingInput"
            placeholder="Correo administrativo"
            name="email"
          />
        </div>

        <div className="d-flex mt-1 justify-content-between align-items-center">
          <Link component={RouterLink} to="/auth/login">
            <h6 className="f-w-400 mb-0">¿Ya tienes acceso?</h6>
          </Link>
        </div>
        <div className="d-grid mt-4">
          <button type="submit" className="btn btn-dark">
            Solicitar nueva contraseña
          </button>
        </div>
      </form>
    </Auth_Layout>
  );
};
