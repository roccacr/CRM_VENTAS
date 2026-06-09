import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { RouterApp } from "../app/routers/RouterApp";
import { AuthRouter } from "../auth/routers";
import { CheckingAuth } from "../ui";
import { useCheckAuth } from "../hook";
import { consumeAuthRedirectPath, persistAuthRedirectPath } from "../store/auth/authSessionStorage";

/**
 * AppRouter - Enrutador principal de la aplicación
 * Determina qué rutas mostrar basándose en el estado de autenticación del usuario
 *
 * Estados posibles:
 * - "checking": Validando autenticación (muestra CheckingAuth)
 * - "authenticated": Usuario autenticado (muestra RouterApp con rutas de aplicación)
 * - "not-authenticated": Usuario no autenticado (muestra AuthRouter con rutas de login)
 */
export const AppRouter = () => {
  const location = useLocation();
  const status = useCheckAuth();
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const isAuthRoute = location.pathname.startsWith("/auth");

  // Mientras se valida la autenticación, mostrar componente de carga
  if (status === "checking") {
      return <CheckingAuth />;
  }

  if (status === "authenticated" && isAuthRoute) {
      const redirectPath = consumeAuthRedirectPath() || "/";
      return <Navigate to={redirectPath} replace />;
  }

  if (status !== "authenticated" && !isAuthRoute) {
      persistAuthRedirectPath(currentPath);
  }

  return (
      <Routes>
          {status === "authenticated" ? (
              // Si está autenticado, mostrar rutas de la aplicación principal
              <Route path="/*" element={<RouterApp />} />
          ) : (
              // Si no está autenticado, mostrar rutas de autenticación
              <Route path="/auth/*" element={<AuthRouter />} />
          )}
          {/* Redirigir cualquier ruta desconocida al login */}
          <Route path="/*" element={<Navigate to="/auth/login" />} />
      </Routes>
  );
};
