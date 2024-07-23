import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage, RecoverPass } from "../pages";

export const AuthRouter = () => {
  return (
    <Routes>
      {/** Login Registro */}
      <Route path="login" element={<LoginPage />} />

      {/** Recuperar Acceso */}
      <Route path="recover-pass" element={<RecoverPass />} />

      {/** Redirecciona a la ruta de login */}
      <Route path="/*" element={<Navigate to="/auth/login" />} />
    </Routes>
  );
};
