import { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { obtenerOrndesPorcliente } from "../../../../store/ordenVenta/thunkOrdenVenta";
import { ProfileEmptyState, ProfileSection } from "./profileTheme";

export const Ordenes = ({ leadDetails }) => {
   const navigate = useNavigate();
   const dispatch = useDispatch();
   const [ordenes, setOrdenes] = useState([]);

   const fetchOrdenes = useCallback(async () => {
      try {
         const leadData = await dispatch(obtenerOrndesPorcliente(leadDetails));
         setOrdenes(leadData || []);
      } catch (error) {
         console.error("Error fetching client orders:", error);
      }
   }, [dispatch, leadDetails]);

   useEffect(() => {
      fetchOrdenes();
   }, [fetchOrdenes]);

   const handleOrdenClick = (idOrden, idLead) => {
      navigate(`/orden/view?data=${idOrden}&data2=${idLead}`);
   };

   return (
      <ProfileSection
         eyebrow="Cierre comercial"
         title="Órdenes de venta"
         description="Visualice las órdenes de venta asociadas al cliente y acceda a su detalle."
      >
         {ordenes.length === 0 ? (
            <ProfileEmptyState message="No hay órdenes de venta asociadas a este cliente." />
         ) : (
            <div className="lead-profile-table-wrap table-responsive">
               <table className="lead-profile-table">
                  <thead>
                     <tr>
                        <th>Cotización</th>
                        <th>Fecha de creación</th>
                     </tr>
                  </thead>
                  <tbody>
                     {ordenes.map((orden) => (
                        <tr
                           key={orden.id_ov_lead}
                           className="is-clickable"
                           onClick={() => handleOrdenClick(orden.id_ov_lead, orden.id_ov_netsuite)}
                        >
                           <td>{orden.id_ov_tranid}</td>
                           <td>{orden.creado_ov}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         )}
      </ProfileSection>
   );
};
