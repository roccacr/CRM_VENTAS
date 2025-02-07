import { useState } from "react";
import { Auth_Layout } from "../layout/Auth_Layout";
import { Link, useNavigate } from "react-router-dom";
import { Link as RouterLink } from "react-dom/client";
import { TextField } from "@mui/material";
import { useDispatch } from "react-redux";
import Swal from "sweetalert2";
import { ValidarUsuario, recuperarContraseña } from "../../store/auth/thunks";

export const RecoverPass = () => {
    const [email, setEmail] = useState("");
    const [emailExists, setEmailExists] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");
    const dispatch = useDispatch();
    const navigate = useNavigate();

    // Función para validar el correo electrónico
    const validarEmail = async (email) => {
        if (email.trim() === "") {
            setEmailExists(false);
            setErrorMessage("");
            return;
        }

        try {
            const exists = await dispatch(ValidarUsuario(email));
            if (exists["0"].count === 1) {
                setEmailExists(true);
                setErrorMessage("Correo encontrado. Puede recuperar su clave.");
            } else {
                setEmailExists(false);
                setErrorMessage("Correo no encontrado.");
            }
        } catch (error) {
            console.error("Error al validar el correo:", error);
            setErrorMessage("Error al validar el correo.");
        }
    };

    // Función para manejar el cambio del campo de correo
    const handleEmailChange = (event) => {
        const emailValue = event.target.value;
        setEmail(emailValue);
        validarEmail(emailValue);
    };

    // Función para manejar la solicitud de restablecimiento de contraseña
    const handleRecoverPassword = async (event) => {
        event.preventDefault();

        // Mostrar confirmación con SweetAlert
        const result = await Swal.fire({
            title: "¿Restablecer contraseña?",
            text: "¿Estás seguro de que deseas restablecer tu contraseña?",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sí, restablecer",
            cancelButtonText: "Cancelar",
        });

        if (result.isConfirmed) {
            try {
                // Llamar a la acción para recuperar contraseña
                await dispatch(recuperarContraseña(email));

                // Mostrar mensaje de éxito
                await Swal.fire({
                    icon: "success",
                    title: "Solicitud enviada",
                    text: "Se ha enviado un correo para restablecer tu contraseña.",
                    showConfirmButton: false,
                    timer: 1000,
                });

                // Recargar la página y redirigir al login después de 3 segundos
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
        }
    };

    return (
        <Auth_Layout title="recover">
            <form className="animate__animated animate__fadeIn animate__faster" onSubmit={handleRecoverPassword}>
                <div className="text-center">
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                        <img src="/assets/logo2.jpg" alt="images" className="mb-1" style={{ maxWidth: "100%", height: "92px" }} />
                    </div>
                    <p className="mb-3">Recuperacion de clave</p>
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
                    <Link component={RouterLink} to="/auth/login">
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
