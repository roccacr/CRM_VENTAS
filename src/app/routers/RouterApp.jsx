import { Navigate, Route, Routes } from "react-router-dom";
import { AppPage } from "../pages/home/AppPage";
import { LeadsPage } from "../pages/leads/LeadsPage";
import { Page_calendars } from "../pages/calendar/Page_calendars";
import { Page_Events } from "../pages/events/Page_Events";
import { Page_Expediente } from "../pages/expediente/Page_Expediente";
import { Page_oportunidad } from "../pages/oportunidad/Page_oportunidad";
import { Page_Estimaciones } from "../pages/estimaciones/Page_Estimaciones";
import { Cotizaciones } from "../pages/cotizaciones/Cotizaciones";
// import { LeadsPage } from "../pages/leads/LeadsPage";



export const RouterApp = () => {
  return (
      <Routes>
          {/** Home  */}
          <Route path="/" element={<AppPage />} />

          {/* lista de leas */}
          <Route path="/leads/*" element={<LeadsPage />} />

          {/* calendario*/}
          <Route path="/calendar/*" element={<Page_calendars />} />

          {/* eventos*/}
          <Route path="/events/*" element={<Page_Events />} />

          <Route path="/expedientes/*" element={<Page_Expediente />} />

          <Route path="/oportunidad/*" element={<Page_oportunidad />} />

          <Route path="/estimaciones/*" element={<Page_Estimaciones />} />

          <Route path="/orden/*" element={<Cotizaciones />} />

          {/** Cualquier ruta*/}
          <Route path="/*" element={<Navigate to="/" />} />
      </Routes>
  );
}
