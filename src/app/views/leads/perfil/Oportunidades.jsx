import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { obtenerOportunidadesCliente } from "../../../../store/oportuinidad/thunkOportunidad";
import { ProfileEmptyState, ProfileSection } from "./profileTheme";

export const Oportunidades = ({ leadDetails }) => {
   const navigate = useNavigate();
   const dispatch = useDispatch();
   const [oportunidades, setOportunidades] = useState([]);

   const fetchClientOportunidades = useCallback(async () => {
      try {
         const leadData = await dispatch(obtenerOportunidadesCliente(leadDetails));
         setOportunidades(leadData || []);
      } catch (error) {
         console.error("Error fetching client opportunities:", error);
      }
   }, [dispatch, leadDetails]);

   useEffect(() => {
      fetchClientOportunidades();
   }, [fetchClientOportunidades]);

   const handleOpportunityClick = (idOportunidad, idLead) => {
      navigate(`/oportunidad/ver?data=${idLead}&data2=${idOportunidad}`);
   };

   return (
      <ProfileSection
         eyebrow="Pipeline"
         title="Oportunidades del cliente"
         description="Consulte las oportunidades creadas para este cliente y su estado dentro del proceso comercial."
      >
         {oportunidades.length === 0 ? (
            <ProfileEmptyState message="No hay oportunidades registradas para este cliente." />
         ) : (
            <div className="lead-profile-table-wrap table-responsive">
               <table className="lead-profile-table">
                  <thead>
                     <tr>
                        <th>ID oportunidad</th>
                        <th>Motivo condición</th>
                        <th>Estado</th>
                        <th>Creado</th>
                     </tr>
                  </thead>
                  <tbody>
                     {oportunidades.map((oportunidad) => (
                        <tr
                           key={oportunidad.id_oportunidad_oport}
                           className="is-clickable"
                           onClick={() =>
                              handleOpportunityClick(
                                 oportunidad.id_oportunidad_oport,
                                 oportunidad.entity_oport
                              )
                           }
                        >
                           <td>{oportunidad.tranid_oport}</td>
                           <td>{oportunidad.Motico_Condicion}</td>
                           <td>{oportunidad.chek_oport === 1 ? "+MAS PROBABLE" : "-MENOS PROBABLE"}</td>
                           <td>{oportunidad.fecha_creada_oport}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         )}
      </ProfileSection>
   );
};
