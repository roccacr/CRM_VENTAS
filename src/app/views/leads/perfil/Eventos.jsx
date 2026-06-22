import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { obtenerEventosCliente } from "../../../../store/calendar/thunkscalendar";
import { ProfileEmptyState, ProfileSection } from "./profileTheme";

export const Eventos = ({ leadDetails }) => {
   const navigate = useNavigate();
   const dispatch = useDispatch();
   const [events, setEvents] = useState([]);

   const fetchClientEvents = useCallback(async () => {
      try {
         const leadData = await dispatch(obtenerEventosCliente(leadDetails));
         setEvents(leadData || []);
      } catch (error) {
         console.error("Error fetching client events:", error);
      }
   }, [dispatch, leadDetails]);

   useEffect(() => {
      fetchClientEvents();
   }, [fetchClientEvents]);

   const handleEventClick = (idCalendar, idLead) => {
      navigate(`/events/actions?idCalendar=${idCalendar}&idLead=${idLead}&idDate=0`);
   };

   return (
      <ProfileSection
         eyebrow="Agenda comercial"
         title="Eventos del cliente"
         description="Aquí se listan todos los eventos, actividades y compromisos registrados para este cliente."
      >
         {events.length === 0 ? (
            <ProfileEmptyState message="No hay eventos registrados para este cliente." />
         ) : (
            <div className="lead-profile-table-wrap table-responsive">
               <table className="lead-profile-table">
                  <thead>
                     <tr>
                        <th>Evento</th>
                        <th>Acción</th>
                        <th>Tipo</th>
                        <th>Fecha</th>
                        <th>Hora</th>
                     </tr>
                  </thead>
                  <tbody>
                     {events.map((evento) => (
                        <tr
                           key={`${evento.id_calendar}-${evento.id_lead}`}
                           className="is-clickable"
                           onClick={() => handleEventClick(evento.id_calendar, evento.id_lead)}
                        >
                           <td>{evento.nombre_calendar}</td>
                           <td>{evento.accion_calendar}</td>
                           <td>{evento.tipo_calendar}</td>
                           <td>{evento.fechaIni_calendar}</td>
                           <td>{evento.horaInicio_calendar}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         )}
      </ProfileSection>
   );
};
