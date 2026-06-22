import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
   getBitacoraLeads,
   getSpecificLead,
   updateLeadStatus,
} from "../../../../store/leads/thunksLeads";
import SticNotesContainer from "../../../../components/sticknotes/SticNotesContainer";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import { Eventos } from "./Eventos";
import { HeaderContent } from "./HeaderContent";
import { InfromacionCompleta } from "./InfromacionCompleta";
import { OneDrive } from "./OneDrive";
import { Oportunidades } from "./Oportunidades";
import { Ordenes } from "./Ordenes";
import { PROFILE_THEME_STYLES, getDisplayText } from "./profileTheme";
import { Seguimiento } from "./Seguimiento";

const PROFILE_TABS = [
   { key: "LineTime", label: "Bitácora de Seguimiento", icon: "ph-duotone ph-user-circle" },
   { key: "Eventos", label: "Lista de eventos", icon: "ph-duotone ph-calendar" },
   { key: "Oportunidades", label: "Oportunidades", icon: "ph-duotone ph-notebook" },
   { key: "Informacion", label: "Información Completada", icon: "ph-duotone ph-identification-card" },
   { key: "ordenes", label: "Ordenes de Venta", icon: "ph-duotone ph-receipt" },
   { key: "OneDrive", label: "OneDrive", icon: "ph-duotone ph-folder-open" },
];

export const PerfilUsuario = () => {
   const dispatch = useDispatch();
   const navigate = useNavigate();
   const location = useLocation();
   const [leadDetails, setLeadDetails] = useState({});
   const [activeTab, setActiveTab] = useState("LineTime");
   const [bitacoraLeads, setBitacora] = useState([]);

   const getQueryParam = (param) => {
      const value = new URLSearchParams(location.search).get(param);
      return !Number.isNaN(Number(value)) && value !== null ? Number(value) : value;
   };

   const fetchLeadDetails = async (idLead) => {
      try {
         const leadData = await dispatch(getSpecificLead(idLead));
         setLeadDetails(leadData || {});
      } catch (error) {
         console.error("Error al obtener los detalles del lead:", error);
      }
   };

   const fetchBitacora = async (idLead) => {
      try {
         const result = await dispatch(getBitacoraLeads(idLead));
         setBitacora(result || []);
      } catch (error) {
         console.error("Error al obtener la bitácora del lead:", error);
      }
   };

   useEffect(() => {
      const leadId = getQueryParam("data");
      if (leadId && leadId > 0) {
         fetchLeadDetails(leadId);
         fetchBitacora(leadId);
      }
   }, [location.search]);

   const handleClienteStatusChange = async (estado, idCliente) => {
      const result = await Swal.fire({
         title: "¿Deseas cambiar el estado del cliente?",
         text: "Esta acción actualizará el estado del cliente seleccionado.",
         icon: "warning",
         showCancelButton: true,
         confirmButtonText: "Sí, cambiar",
         cancelButtonText: "Cancelar",
      });

      if (!result.isConfirmed) {
         return;
      }

      await dispatch(updateLeadStatus(estado, idCliente));

      await Swal.fire({
         title: "Estado actualizado",
         text: "El estado del cliente fue actualizado con éxito.",
         icon: "success",
         timer: 1500,
         showConfirmButton: false,
      });

      fetchLeadDetails(idCliente);
   };

   const irEditarCliente = (idCliente) => {
      navigate(`/leads/edit?id=${idCliente}`);
   };

   const renderActiveTab = () => {
      switch (activeTab) {
         case "Eventos":
            return <Eventos leadDetails={leadDetails.idinterno_lead} />;
         case "Oportunidades":
            return <Oportunidades leadDetails={leadDetails.idinterno_lead} />;
         case "Informacion":
            return <InfromacionCompleta leadDetails={leadDetails} />;
         case "ordenes":
            return <Ordenes leadDetails={leadDetails.idinterno_lead} />;
         case "OneDrive":
            return <OneDrive leadDetails={leadDetails} />;
         case "LineTime":
         default:
            return <Seguimiento BitacoraLeads={bitacoraLeads} />;
      }
   };

   return (
      <>
         <style>{PROFILE_THEME_STYLES}</style>

         <div style={{ position: "relative", zIndex: 999 }}>
            <SticNotesContainer
               idinternoLead={getQueryParam("data")}
               transactionType="lead"
               transactionId={getQueryParam("data")}
               sourceUrl={window.location.href}
            />
         </div>

         <HeaderContent leadInformations={leadDetails} />

         <div className="row">
            <div className="col-xxl-3 col-lg-4">
               <aside className="lead-profile-sidebar">
                  <div className="lead-profile-sidebar-body">
                     <div className="text-center">
                        <img
                           alt="Cliente"
                           loading="lazy"
                           width="100"
                           height="100"
                           className="lead-profile-avatar"
                           src="/avatar.webp"
                           style={{ color: "transparent" }}
                        />
                        <h5 className="lead-profile-sidebar-name">
                           {getDisplayText(leadDetails.nombre_lead)}
                        </h5>
                        <p className="lead-profile-sidebar-copy">
                           {getDisplayText(leadDetails.segimineto_lead)}
                        </p>
                     </div>

                     {Object.keys(leadDetails).length > 0 ? (
                        <div className="lead-profile-actions">
                           <ButtonActions leadData={leadDetails} className="mb-0" />
                           <button
                              onClick={() => irEditarCliente(leadDetails.idinterno_lead)}
                              className="btn btn-sm btn-dark"
                           >
                              <i className="ti ti-edit-circle f-24"></i> Editar Perfil
                           </button>

                           {leadDetails.estado_lead === 1 ? (
                              <button
                                 className="btn btn-sm btn-danger"
                                 onClick={() =>
                                    handleClienteStatusChange(0, leadDetails.idinterno_lead)
                                 }
                              >
                                 <i className="ti ti-x f-24"></i> Inactivar cliente
                              </button>
                           ) : (
                              <button
                                 className="btn btn-sm btn-success"
                                 onClick={() =>
                                    handleClienteStatusChange(1, leadDetails.idinterno_lead)
                                 }
                              >
                                 <i className="ti ti-checks f-24"></i> Activar cliente
                              </button>
                           )}
                        </div>
                     ) : null}
                  </div>

                  <div className="lead-profile-nav nav nav-pills flex-column" role="tablist">
                     {PROFILE_TABS.map((tab) => (
                        <button
                           key={tab.key}
                           type="button"
                           onClick={() => setActiveTab(tab.key)}
                           className={`nav-link text-start ${activeTab === tab.key ? "active" : ""}`}
                        >
                           <i className={`${tab.icon} m-r-10`}></i>
                           {tab.label}
                        </button>
                     ))}
                  </div>
               </aside>
            </div>

            <div className="col-xxl-9 col-lg-8">
               <div className="lead-profile-main-panel">{renderActiveTab()}</div>
            </div>
         </div>
      </>
   );
};
