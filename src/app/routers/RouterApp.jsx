import { Navigate, Route, Routes } from "react-router-dom";
import { AppPage } from "../pages/home/AppPage";



export const RouterApp = () => {
  return (
    <Routes>
      {/** Home  */}
      <Route path="/" element={<AppPage />} />

      {/** Cualquier ruta*/}
      <Route path="/*" element={<Navigate to="/" />} />
    </Routes>
  );
}
