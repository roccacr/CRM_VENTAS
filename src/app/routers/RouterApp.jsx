import { Navigate, Route, Routes } from "react-router-dom";
import { AppPage } from "../pages/home/AppPage";
import { LeadsPage } from "../pages/leads/LeadsPage";
import { Page_calendars } from "../pages/calendar/Page_calendars";
import { Page_Events } from "../pages/events/Page_Events";
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

          {/** Cualquier ruta*/}
          <Route path="/*" element={<Navigate to="/" />} />
      </Routes>
  );
}