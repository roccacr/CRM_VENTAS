import { Navigate, Route, Routes } from "react-router-dom";
import { RouterApp } from "../app/routers/RouterApp";
import { AuthRouter } from "../auth/routers";

export const AppRouter = () => {
  return (
    <Routes>
      {/* LOGIN , RECOVER PASSWORD */}
      <Route path="/auth/*" element={<AuthRouter />} />

      {/* DASHBOARD */}
      <Route path="/*" element={<RouterApp />} />

      <Route path="/*" element={<Navigate to="/auth/login" />} />
    </Routes>
  );
};
