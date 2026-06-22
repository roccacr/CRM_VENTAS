import { formatDate } from "../../../../hook/useFormatDate";
import { ProfileEmptyState, ProfileSection, getDisplayText } from "./profileTheme";

export const Seguimiento = ({ BitacoraLeads }) => {
   const sortedBitacora = [...BitacoraLeads].sort(
      (a, b) => new Date(b.fecha_creado_bit) - new Date(a.fecha_creado_bit)
   );

   return (
      <ProfileSection
         eyebrow="Historial comercial"
         title="Bitácora de seguimiento"
         description="Resumen detallado de las acciones, notas y avances registrados por el asesor para este cliente."
      >
         {sortedBitacora.length === 0 ? (
            <ProfileEmptyState message="No hay registros de seguimiento disponibles para este cliente." />
         ) : (
            <div className="lead-profile-timeline">
               {sortedBitacora.map((entry, idx) => {
                  const estadoTexto = getDisplayText(entry.estado_bit)
                     .split("-")
                     .slice(1)
                     .join("-") || getDisplayText(entry.estado_bit);
                  const { formattedDate, formattedTime } = formatDate(entry.fecha_creado_bit);
                  const accion = getDisplayText(entry.detalle_bit);
                  const motivo = getDisplayText(entry.nombre_caida);

                  return (
                     <article className="lead-profile-timeline-card" key={`${entry.fecha_creado_bit}-${idx}`}>
                        <h6 className="lead-profile-timeline-title">{estadoTexto}</h6>
                        <div className="lead-profile-meta">
                           <span>{formattedDate}</span>
                           <span>{formattedTime}</span>
                        </div>
                        <p className="lead-profile-note">
                           <strong>Acción:</strong> {accion}
                        </p>
                        <p className="lead-profile-note">
                           <strong>Motivo:</strong> {motivo}
                        </p>
                     </article>
                  );
               })}
            </div>
         )}
      </ProfileSection>
   );
};
