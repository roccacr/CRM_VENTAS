import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import Swal from "sweetalert2";

import SticNotesContainer from "../../../../components/sticknotes/SticNotesContainer";
import { getSpecificLead } from "../../../../store/leads/thunksLeads";
import {
   fetchOpportunityTraceability,
   getSpecificOportunidad,
   updateOpportunityProbability,
   updateOpportunityStatus,
} from "../../../../store/oportuinidad/thunkOportunidad";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import {
   PROFILE_PANEL_STYLES,
   PROFILE_THEME_STYLES,
} from "../../leads/perfil/profileTheme";
import { ModalEditarOportunidad } from "../EditarOportunidad/ModalEditarOportunidad";
import { EstimacionesOportunidad } from "./EstimacionesOportunidad";
import { InformacionBasicaExpedienteUnidad } from "./InformacionBasicaExpedienteUnidad";
import { InformacionBasicaOportunidad } from "./InformacionBasicaOportunidad";
import { TrazabilidadOportunidad } from "./TrazabilidadOportunidad";

const OPPORTUNITY_VIEW_STYLES = `
   ${PROFILE_THEME_STYLES}

   .opportunity-view-shell .lead-profile-panel {
      padding: 18px;
   }

   .opportunity-view-shell .lead-profile-hero {
      margin-bottom: 0;
      padding-bottom: 0;
      border-bottom: none;
   }

   .opportunity-view-layout {
      display: grid;
      grid-template-columns: minmax(290px, 340px) minmax(0, 1fr);
      gap: 16px;
      align-items: start;
   }

   .opportunity-view-sticky-notes {
      position: relative;
      z-index: 999;
      margin-bottom: 12px;
   }

   .opportunity-view-sidebar-card,
   .opportunity-view-main-card {
      border: 1px solid #d9dde3;
      border-radius: 20px;
      background: #ffffff;
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.06);
      overflow: hidden;
   }

   .opportunity-view-sidebar-body {
      padding: 18px;
   }

   .opportunity-view-hero-card {
      margin-bottom: 14px;
      border: 1px solid #d9dde3;
      border-radius: 20px;
      background: linear-gradient(135deg, #1f242b 0%, #29313b 100%);
      box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12);
      overflow: hidden;
   }

   .opportunity-view-hero-body {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      padding: 20px 22px;
   }

   .opportunity-view-hero-copy {
      flex: 1;
      min-width: 0;
   }

   .opportunity-view-hero-kicker {
      display: inline-block;
      margin-bottom: 5px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.68);
   }

   .opportunity-view-hero-title {
      margin: 0 0 6px;
      font-size: 20px;
      font-weight: 700;
      line-height: 1.1;
      color: #ffffff;
   }

   .opportunity-view-hero-copy p {
      margin: 0;
      max-width: 620px;
      font-size: 12px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.72);
   }

   .opportunity-view-hero-copy p,
   .opportunity-view-sidebar-copy,
   .lead-profile-section-copy,
   .lead-profile-page-copy,
   .opportunity-view-main-card .text-muted,
   .opportunity-view-main-card p.text-muted {
      display: none !important;
   }

   .opportunity-view-hero-figure {
      flex-shrink: 0;
      width: 82px;
      height: 82px;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
   }

   .opportunity-view-hero-figure img {
      width: 78px;
      height: 78px;
      object-fit: contain;
   }

   .opportunity-view-sidebar-top {
      text-align: center;
      padding-bottom: 14px;
      border-bottom: 1px solid #edf0f2;
   }

   .opportunity-view-sidebar-avatar {
      width: 92px;
      height: 92px;
      margin: 0 auto 12px;
      border-radius: 999px;
      border: 4px solid #f8fafc;
      background: linear-gradient(180deg, #ffffff 0%, #eef2f7 100%);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
   }

   .opportunity-view-sidebar-avatar img {
      width: 84px;
      height: 84px;
      object-fit: cover;
   }

   .opportunity-view-sidebar-title {
      margin: 0 0 4px;
      font-size: 18px;
      font-weight: 700;
      color: #111827;
   }

   .opportunity-view-sidebar-copy {
      margin: 0;
      font-size: 12px;
      color: #6b7280;
   }

   .opportunity-view-lead-actions {
      margin-top: 12px;
      padding: 12px;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
   }

   .opportunity-view-action-buttons {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 12px;
   }

   .opportunity-view-action-buttons .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 42px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
      box-shadow: none;
   }

   .opportunity-view-meta-grid {
      display: grid;
      gap: 10px;
      margin-top: 14px;
   }

   .opportunity-view-meta-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 11px 13px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #fbfbfc;
   }

   .opportunity-view-meta-label {
      margin: 0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #6b7280;
   }

   .opportunity-view-meta-value {
      margin: 0;
      font-size: 13px;
      font-weight: 600;
      color: #111827;
      text-align: right;
   }

   .opportunity-view-meta-value.is-active {
      color: #047857;
   }

   .opportunity-view-meta-value.is-inactive {
      color: #b91c1c;
   }

   .opportunity-view-main-card .lead-profile-panel {
      padding: 14px;
   }

   .opportunity-view-tablist {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 14px;
   }

   .opportunity-view-tab {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 44px;
      padding: 0 14px;
      border: 1px solid #d9dde3;
      border-radius: 12px;
      background: #ffffff;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
      transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
   }

   .opportunity-view-tab.is-active {
      border-color: #111827;
      background: #111827;
      color: #ffffff;
      box-shadow: 0 12px 26px rgba(15, 23, 42, 0.12);
   }

   .opportunity-view-main-card .card {
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      box-shadow: none;
      overflow: hidden;
   }

   .opportunity-view-main-card .card + .card {
      margin-top: 12px;
   }

   .opportunity-view-main-card .card-header {
      padding: 13px 16px;
      border-bottom: 1px solid #edf0f2;
      background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
   }

   .opportunity-view-main-card .card-header h5 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #111827;
   }

   .opportunity-view-main-card .card-body {
      padding: 14px 16px;
   }

   .opportunity-view-main-card .list-group-item {
      border-color: #edf0f2;
   }

   .opportunity-view-main-card .text-muted,
   .opportunity-view-main-card p.text-muted {
      color: #6b7280 !important;
   }

   .opportunity-view-main-card table thead th {
      background: #f8fafc;
      color: #6b7280;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
   }

   .opportunity-view-main-card table tbody td {
      vertical-align: middle;
   }

   @media (max-width: 1199px) {
      .opportunity-view-layout {
         grid-template-columns: 1fr;
      }
   }

   @media (max-width: 767px) {
      .opportunity-view-hero-body {
         flex-direction: column;
         align-items: flex-start;
      }

      .opportunity-view-tablist {
         grid-template-columns: 1fr;
      }
   }
`;

const getDisplayText = (value) => {
   if (value === null || value === undefined || value === "" || value === "null") {
      return "N/A";
   }

   return value;
};

const VIEW_TABS = [
   {
      key: "infoPot",
      icon: "ph-duotone ph-briefcase",
      label: "Información oportunidad",
   },
   {
      key: "Expediente",
      icon: "ph-duotone ph-buildings",
      label: "Expediente unidad",
   },
   {
      key: "Estimaciones",
      icon: "ph-duotone ph-file-text",
      label: "Estimaciones",
   },
];

export const View_oportuinidad_ver = () => {
   const dispatch = useDispatch();
   const previousUrlAtEntryRef = useRef(localStorage.getItem("previousUrl"));
   const [activeTab, setActiveTab] = useState("infoPot");
   const [leadDetails, setLeadDetails] = useState({});
   const [oportunidadDetails, setOportunidadDetails] = useState({});
   const [traceability, setTraceability] = useState({
      current: null,
      history: [],
      traceabilityEnabled: false,
   });
   const [isModalOpen, setIsModalOpen] = useState(false);

   useEffect(() => {
      const previousUrlAtEntry = previousUrlAtEntryRef.current;

      if (!previousUrlAtEntry) {
         return;
      }

      const currentPreviousUrl = localStorage.getItem("previousUrl");

      if (currentPreviousUrl !== previousUrlAtEntry) {
         localStorage.setItem("previousUrl", previousUrlAtEntry);
      }
   });

   const getQueryParam = (param) => {
      const value = new URLSearchParams(window.location.search).get(param);

      if (value && !Number.isNaN(Number(value))) {
         return Number(value);
      }

      return value;
   };

   const fetchLeadDetails = async (idLead) => {
      try {
         const leadData = await dispatch(getSpecificLead(idLead));
         setLeadDetails(leadData);
      } catch (error) {
         console.error("Error al obtener los detalles del lead:", error);
      }
   };

   const fetchOportunidadDetails = async (idOportunidad) => {
      try {
         const fetchedOportunidad = await dispatch(
            getSpecificOportunidad(idOportunidad)
         );
         setOportunidadDetails(fetchedOportunidad);
      } catch (error) {
         console.error("Error al obtener los detalles de la oportunidad:", error);
      }
   };

   const fetchOpportunityTraceabilityData = async (idOportunidad) => {
      try {
         const traceabilityData = await dispatch(
            fetchOpportunityTraceability(idOportunidad)
         );
         setTraceability(traceabilityData);
      } catch (error) {
         console.error(
            "Error al obtener la trazabilidad de la oportunidad:",
            error
         );
      }
   };

   useEffect(() => {
      const leadId = getQueryParam("data");
      const oportunidadId = getQueryParam("data2");

      if (leadId && leadId > 0) {
         fetchLeadDetails(leadId);
         fetchOportunidadDetails(oportunidadId);
         fetchOpportunityTraceabilityData(oportunidadId);
      }
   }, []);

   const handleStatusChange = (estado, idOportunidad) => {
      Swal.fire({
         title: "¿Deseas cambiar el estado de la oportunidad?",
         text: "Esta acción actualizará el estado de esta oportunidad.",
         icon: "warning",
         showCancelButton: true,
         confirmButtonText: "Sí, cambiar",
         cancelButtonText: "Cancelar",
      }).then((result) => {
         if (result.isConfirmed) {
            const motivoInactivacion = estado === 0 ? "MANUAL" : null;

            dispatch(
               updateOpportunityStatus(
                  estado,
                  idOportunidad,
                  motivoInactivacion
               )
            );

            Swal.fire({
               title: "¡Estado actualizado!",
               text: "El estado de la oportunidad ha sido cambiado con éxito.",
               icon: "success",
               timer: 1500,
               showConfirmButton: false,
            }).then(() => {
               fetchOportunidadDetails(idOportunidad);
               fetchOpportunityTraceabilityData(idOportunidad);
            });
         }
      });
   };

   const handleProbabilidadChange = (probabilidad, idOportunidad) => {
      Swal.fire({
         title: "¿Deseas cambiar la probabilidad?",
         text: "Esta acción actualizará la probabilidad de esta oportunidad.",
         icon: "warning",
         showCancelButton: true,
         confirmButtonText: "Sí, cambiar",
         cancelButtonText: "Cancelar",
      }).then((result) => {
         if (result.isConfirmed) {
            dispatch(updateOpportunityProbability(probabilidad, idOportunidad));

            Swal.fire({
               title: "¡Probabilidad actualizada!",
               text: "La probabilidad de la oportunidad ha sido cambiada.",
               icon: "success",
               timer: 1500,
               showConfirmButton: false,
            }).then(() => {
               fetchOportunidadDetails(idOportunidad);
               fetchOpportunityTraceabilityData(idOportunidad);
            });
         }
      });
   };

   const handleOpenModal = () => {
      setIsModalOpen(true);
   };

   const handleCloseModal = () => {
      setIsModalOpen(false);
   };

   const handleEditSuccess = () => {
      const oportunidadId = getQueryParam("data2");

      if (oportunidadId && oportunidadId > 0) {
         fetchOportunidadDetails(oportunidadId);
         fetchOpportunityTraceabilityData(oportunidadId);
      }
   };

   const leadName = getDisplayText(leadDetails?.nombre_lead);
   const opportunityCode = getDisplayText(oportunidadDetails?.tranid_oport || "");
   const statusIsActive = oportunidadDetails?.estatus_oport === 1;
   const probabilityIsPositive = oportunidadDetails?.chek_oport === 0;

   const sidebarSummary = [
      {
         label: "Código oportunidad",
         value: `#${opportunityCode}`,
      },
      {
         label: "Cliente relacionado",
         value: leadName,
      },
      {
         label: "Estado oportunidad",
         value: statusIsActive ? "Activa" : "Inactiva",
         stateClass: statusIsActive ? "is-active" : "is-inactive",
      },
      {
         label: "Método de pago",
         value: getDisplayText(oportunidadDetails?.nombre_motivo_pago),
      },
   ];

   return (
      <>
         <style>{OPPORTUNITY_VIEW_STYLES}</style>

         <div className="opportunity-view-sticky-notes">
            <SticNotesContainer
               idinternoLead={getQueryParam("data")}
               transactionType="opportunity"
               transactionId={getQueryParam("data2")}
               sourceUrl={window.location.href}
            />
         </div>

         <div className="lead-profile-shell opportunity-view-shell">
            <div className="opportunity-view-hero-card">
               <div className="opportunity-view-hero-body">
                  <div className="opportunity-view-hero-copy">
                     <span className="opportunity-view-hero-kicker">
                        Gestión comercial
                     </span>
                     <h1 className="opportunity-view-hero-title">
                        Oportunidad
                     </h1>
                     <p>
                        Revise el estado comercial, expediente, estimaciones y
                        trazabilidad de la oportunidad desde una vista
                        consolidada y más ejecutiva.
                     </p>
                  </div>

                  <div className="opportunity-view-hero-figure">
                     <img src="/opt.png" alt="Oportunidad" />
                  </div>
               </div>
            </div>

            <div className="opportunity-view-layout">
               <aside className="opportunity-view-sidebar-card">
                  <div className="opportunity-view-sidebar-body">
                     <div className="opportunity-view-sidebar-top">
                        <div className="opportunity-view-sidebar-avatar">
                           <img src="/opt.png" alt="Oportunidad" />
                        </div>

                        <h3 className="opportunity-view-sidebar-title">
                           #{opportunityCode}
                        </h3>
                        <p className="opportunity-view-sidebar-copy">
                           Cliente asociado: {leadName}
                        </p>
                     </div>

                     <div className="opportunity-view-lead-actions">
                        <div className="lead-profile-section-head">
                           <span className="lead-profile-kicker">
                              Lead vinculado
                           </span>
                           <h5 className="lead-profile-section-title">
                              Gestión del lead vinculado
                           </h5>
                           <p className="lead-profile-section-copy">
                              Acceda al perfil y a las acciones comerciales del
                              lead asociado a esta oportunidad.
                           </p>
                        </div>

                        {Object.keys(leadDetails).length > 0 ? (
                           <ButtonActions leadData={leadDetails} className="mb-0" />
                        ) : null}
                     </div>

                     <div className="opportunity-view-action-buttons">
                        <button
                           type="button"
                           className="btn btn-dark"
                           onClick={handleOpenModal}
                        >
                           <i className="ti ti-edit-circle f-24"></i>
                           Editar oportunidad
                        </button>

                        {probabilityIsPositive ? (
                           <button
                              type="button"
                              className="btn btn-success"
                              onClick={() =>
                                 handleProbabilidadChange(
                                    1,
                                    oportunidadDetails?.id_oportunidad_oport
                                 )
                              }
                           >
                              <i className="ti ti-check f-24"></i>
                              Oportunidad + probable
                           </button>
                        ) : (
                           <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() =>
                                 handleProbabilidadChange(
                                    0,
                                    oportunidadDetails?.id_oportunidad_oport
                                 )
                              }
                           >
                              <i className="ti ti-x f-24"></i>
                              Oportunidad - probable
                           </button>
                        )}

                        {statusIsActive ? (
                           <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() =>
                                 handleStatusChange(
                                    0,
                                    oportunidadDetails?.id_oportunidad_oport
                                 )
                              }
                           >
                              <i className="ti ti-x f-24"></i>
                              Inactivar oportunidad
                           </button>
                        ) : (
                           <button
                              type="button"
                              className="btn btn-success"
                              onClick={() =>
                                 handleStatusChange(
                                    1,
                                    oportunidadDetails?.id_oportunidad_oport
                                 )
                              }
                           >
                              <i className="ti ti-edit-circle f-24"></i>
                              Activar oportunidad
                           </button>
                        )}
                     </div>

                     <div className="opportunity-view-meta-grid">
                        {sidebarSummary.map((item) => (
                           <div
                              className="opportunity-view-meta-item"
                              key={item.label}
                           >
                              <p className="opportunity-view-meta-label">
                                 {item.label}
                              </p>
                              <p
                                 className={`opportunity-view-meta-value ${
                                    item.stateClass || ""
                                 }`.trim()}
                              >
                                 {item.value}
                              </p>
                           </div>
                        ))}
                     </div>
                  </div>
               </aside>

               <section className="opportunity-view-main-card">
                  <div
                     className="lead-profile-panel"
                     style={PROFILE_PANEL_STYLES}
                  >
                     <div className="lead-profile-hero">
                        <div>
                           <span className="lead-profile-eyebrow">
                              Resumen
                           </span>
                           <h2 className="lead-profile-page-title">
                              Información detallada de la oportunidad
                           </h2>
                           <p className="lead-profile-page-copy">
                              Consulte la información operativa, financiera y de
                              expediente usando pestañas más claras y una
                              presentación alineada al resto del CRM.
                           </p>
                        </div>
                     </div>

                     <div className="opportunity-view-tablist" role="tablist">
                        {VIEW_TABS.map((tab) => (
                           <button
                              key={tab.key}
                              type="button"
                              className={`opportunity-view-tab ${
                                 activeTab === tab.key ? "is-active" : ""
                              }`}
                              onClick={() => setActiveTab(tab.key)}
                           >
                              <i className={tab.icon}></i>
                              <span>{tab.label}</span>
                           </button>
                        ))}
                     </div>

                     <div className="tab-content">
                        {activeTab === "infoPot" ? (
                           <>
                              <InformacionBasicaOportunidad
                                 oportuinidadId={oportunidadDetails}
                                 cliente={leadName}
                              />
                              <TrazabilidadOportunidad
                                 traceability={traceability}
                              />
                           </>
                        ) : null}

                        {activeTab === "Expediente" ? (
                           <InformacionBasicaExpedienteUnidad
                              idExpediente={
                                 oportunidadDetails.exp_custbody38_oport
                              }
                           />
                        ) : null}

                        {activeTab === "Estimaciones" ? (
                           <EstimacionesOportunidad
                              OportunidadDetails={oportunidadDetails}
                              cliente={leadDetails}
                           />
                        ) : null}
                     </div>
                  </div>
               </section>
            </div>
         </div>

         <ModalEditarOportunidad
            open={isModalOpen}
            onClose={handleCloseModal}
            OportunidadDetails={oportunidadDetails}
            onSuccess={handleEditSuccess}
         />
      </>
   );
};
