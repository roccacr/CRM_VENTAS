import { useState } from "react";
import { Link } from "react-router-dom";
import { TextField } from "@mui/material";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

import { ValidarUsuario, recuperarContrasena } from "../../store/auth/thunks";
import { Auth_Layout } from "../layout/Auth_Layout";

export const RecoverPass = () => {
    const [email, setEmail] = useState("");
    const [emailExists, setEmailExists] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const dispatch = useDispatch();
    const navigate = useNavigate();

    const validarEmail = async (nextEmail) => {
        if (nextEmail.trim() === "") {
            setEmailExists(false);
            setErrorMessage("");
            return;
        }

        try {
            const exists = await dispatch(ValidarUsuario(nextEmail));

            if (exists["0"].count === 1) {
                setEmailExists(true);
                setErrorMessage("Correo encontrado. Puede recuperar su clave.");
                return;
            }

            setEmailExists(false);
            setErrorMessage("Correo no encontrado.");
        } catch (error) {
            console.error("Error al validar el correo:", error);
            setErrorMessage("Error al validar el correo.");
        }
    };

    const handleEmailChange = (event) => {
        const emailValue = event.target.value;
        setEmail(emailValue);
        validarEmail(emailValue);
    };

    const handleRecoverPassword = async (event) => {
        event.preventDefault();

        const result = await Swal.fire({
            title: "¿Restablecer contraseña?",
            text: "¿Estás seguro de que deseas restablecer tu contraseña?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sí, restablecer",
            cancelButtonText: "Cancelar",
        });

        if (!result.isConfirmed) {
            return;
        }

        try {
            await dispatch(recuperarContrasena(email));

            await Swal.fire({
                icon: "success",
                title: "Solicitud enviada",
                text: "Se ha enviado un correo para restablecer tu contraseña.",
                showConfirmButton: false,
                timer: 1000,
            });

            setTimeout(() => {
                navigate("/auth/login");
            }, 1000);
        } catch (error) {
            console.error("Error al recuperar la contraseña:", error);
            await Swal.fire({
                icon: "error",
                title: "Error",
                text: "No se pudo enviar la solicitud. Intenta nuevamente.",
            });
        }
    };

    return (
        <Auth_Layout title="recover">
            <form className="animate__animated animate__fadeIn animate__faster" onSubmit={handleRecoverPassword}>
                <div className="text-center">
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                        <img src="/assets/logo2.jpg" alt="images" className="mb-1" style={{ maxWidth: "100%", height: "92px" }} />
                    </div>
                    <p className="mb-3">Recuperación de clave</p>
                </div>

                <div className="mb-3">
                    <TextField
                        type="email"
                        className="form-control"
                        id="floatingInput"
                        placeholder="Correo administrativo"
                        name="email"
                        value={email}
                        onChange={handleEmailChange}
                    />
                </div>

                {errorMessage && (
                    <div className={`alert ${emailExists ? "alert-success" : "alert-danger"}`} role="alert">
                        {errorMessage}
                    </div>
                )}

                <div className="d-flex mt-1 justify-content-between align-items-center">
                    <Link className="text-decoration-none" to="/auth/login">
                        <h6 className="f-w-400 mb-0">¿Ya tienes acceso?</h6>
                    </Link>
                </div>

                <div className="d-grid mt-4">
                    <button type="submit" className="btn btn-dark" disabled={!emailExists}>
                        Solicitar nueva contraseña
                    </button>
                </div>
            </form>
        </Auth_Layout>
    );
};
