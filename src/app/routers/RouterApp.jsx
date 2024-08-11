import { Navigate, Route, Routes } from "react-router-dom";
import { AppPage } from "../pages/home/AppPage";
import { LeadsPage } from "../pages/leads/LeadsPage";



export const RouterApp = () => {
  return (
      <Routes>
          {/** Home  */}
          <Route path="/" element={<AppPage />} />

          {/* lista de leas */}
          <Route path="/leads/*" element={<LeadsPage />} />

          {/** Cualquier ruta*/}
          <Route path="/*" element={<Navigate to="/" />} />
      </Routes>
  );
}
