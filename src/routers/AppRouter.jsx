import { Navigate, Route, Routes } from "react-router-dom";
import { RouterApp } from "../app/routers/RouterApp";
import { AuthRouter } from "../auth/routers";
import { CheckingAuth } from "../ui";
import { useCheckAuth } from "../hook";
export const AppRouter = () => {

  const status = useCheckAuth();

  if (status === "checking") {
      return <CheckingAuth />;
  }

  return (
      <Routes>
          {status === "authenticated" ? (
              <Route path="/*" element={<RouterApp />} />
          ) : (
              /* 9. Si el usuario está autenticado, renderiza DashboardRouter para manejar las rutas del dashboard. */
              <Route path="/auth/*" element={<AuthRouter />} />
              /* 10. Si el usuario no está autenticado, renderiza AuthRoutes para manejar las rutas de autenticación. */
          )}
          <Route path="/*" element={<Navigate to="/auth/login" />} />
      </Routes>
  );
};
