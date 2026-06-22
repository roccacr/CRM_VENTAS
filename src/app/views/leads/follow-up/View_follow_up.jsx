import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
   createNoteFollow_up,
   getSpecificLead,
   getoptionLoss,
} from "../../../../store/leads/thunksLeads";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import { MODAL_TEXTS } from "../../../pages/modal/constants";
import {
   PROFILE_PANEL_STYLES,
   PROFILE_THEME_STYLES,
} from "../perfil/profileTheme";

const FOLLOW_UP_VIEW_STYLES = `
${PROFILE_THEME_STYLES}

.lead-followup-shell .lead-profile-panel {
   padding: 18px;
}

.lead-followup-toolbar {
   display: flex;
   justify-content: flex-end;
   margin-bottom: 12px;
}

.lead-followup-loading,
.lead-followup-empty {
   display: flex;
   align-items: center;
   justify-content: center;
   min-height: 180px;
   padding: 24px;
   border: 1px dashed #d1d5db;
   border-radius: 14px;
   text-align: center;
   font-size: 12px;
   color: #6b7280;
   background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
}

.lead-followup-helper {
   display: grid;
   gap: 6px;
   margin: 0 0 12px;
   padding: 12px 14px;
   border: 1px solid #e5e7eb;
   border-radius: 12px;
   background: #fbfbfc;
   font-size: 12px;
   line-height: 1.55;
   color: #4b5563;
}

.lead-followup-helper strong {
   color: #111827;
}

.lead-followup-form {
   display: grid;
   gap: 12px;
}

.lead-followup-field label {
   display: inline-block;
   margin-bottom: 6px;
   font-size: 10px;
   font-weight: 700;
   letter-spacing: 0.04em;
   text-transform: uppercase;
   color: #6b7280;
}

.lead-followup-field .form-select,
.lead-followup-field .form-control {
   border: 1px solid #d1d5db;
   border-radius: 12px;
   min-height: 44px;
   padding: 10px 12px;
   font-size: 13px;
   box-shadow: none;
}

.lead-followup-field .form-select:focus,
.lead-followup-field .form-control:focus {
   border-color: #111827;
   box-shadow: 0 0 0 4px rgba(17, 24, 39, 0.08);
}

.lead-followup-field textarea.form-control {
   min-height: 150px;
   resize: vertical;
}

.lead-followup-field .invalid-feedback {
   display: block;
   margin-top: 6px;
   font-size: 11px;
}

.lead-followup-grid {
   display: grid;
   grid-template-columns: repeat(2, minmax(0, 1fr));
   gap: 12px;
}

.lead-followup-submit {
   display: flex;
   justify-content: flex-end;
   margin-top: 4px;
}

.lead-followup-submit .btn {
   min-width: 200px;
   min-height: 44px;
   border-radius: 12px;
   padding: 0 18px;
   font-size: 12px;
   font-weight: 700;
   letter-spacing: 0.02em;
}

@media (max-width: 768px) {
   .lead-followup-grid {
      grid-template-columns: 1fr;
   }
}
`;

export const View_follow_up = () => {
   const dispatch = useDispatch();
   const navigate = useNavigate();
   const location = useLocation();
   const [leadData, setLeadData] = useState(null);
   const [leadName, setLeadName] = useState("Cliente");
   const [note, setNote] = useState("");
   const [isLoading, setIsLoading] = useState(true);
   const [isTextareaError, setIsTextareaError] = useState(false);
   const [isSelectError, setIsSelectError] = useState(false);
   const [isDateError, setIsDateError] = useState(false);
   const [isLeadStatusError, setIsLeadStatusError] = useState(false);
   const [leadId, setLeadId] = useState(null);
   const [lossOptions, setLossOptions] = useState([]);
   const [selectedLossOption, setSelectedLossOption] = useState("");
   const [followUpDate, setFollowUpDate] = useState("");
   const [leadStatus, setLeadStatus] = useState("1");

   const getIdFromUrl = useCallback(() => {
      const params = new URLSearchParams(location.search);
      return params.get("id");
   }, [location.search]);

   const fetchLeadData = useCallback(
      async (id) => {
         setIsLoading(true);

         try {
            const [optionsLoss, result] = await Promise.all([
               dispatch(getoptionLoss(2)),
               dispatch(getSpecificLead(id)),
            ]);

            setLossOptions(Array.isArray(optionsLoss) ? optionsLoss : []);
            setLeadName(result?.nombre_lead || "Cliente");
            setLeadId(result?.idinterno_lead || null);
            setLeadData(result || null);
         } catch (error) {
            console.error("Error al cargar la vista de seguimiento:", error);
            setLossOptions([]);
            setLeadData(null);
         } finally {
            setIsLoading(false);
         }
      },
      [dispatch]
   );

   const handleNoteChange = (event) => {
      const newValue = event.target.value;
      setNote(newValue);

      if (newValue.trim() !== "") {
         setIsTextareaError(false);
      }
   };

   const handleLossOptionChange = (event) => {
      const newValue = event.target.value;
      setSelectedLossOption(newValue);

      if (newValue !== "") {
         setIsSelectError(false);
      }
   };

   const handleDateChange = (event) => {
      const newValue = event.target.value;
      setFollowUpDate(newValue);

      if (newValue !== "") {
         setIsDateError(false);
      }
   };

   const handleLeadStatusChange = (event) => {
      const newValue = event.target.value;
      setLeadStatus(newValue);

      if (newValue !== "") {
         setIsLeadStatusError(false);
      }
   };

   const handleGenerateFollowUp = () => {
      const hasNote = note.trim() !== "";
      const hasReason = selectedLossOption !== "";
      const hasDate = followUpDate !== "";
      const hasLeadStatus = leadStatus !== "";

      if (!hasNote || !hasReason || !hasDate || !hasLeadStatus) {
         setIsTextareaError(!hasNote);
         setIsSelectError(!hasReason);
         setIsDateError(!hasDate);
         setIsLeadStatusError(!hasLeadStatus);

         Swal.fire({
            title: "Campos incompletos",
            text: "Debe llenar todos los campos antes de continuar.",
            icon: "warning",
            confirmButtonText: "Aceptar",
         });
         return;
      }

      Swal.fire({
         title: "Colocar lead en seguimiento",
         html: `
            <p style="margin-bottom: 10px;">${MODAL_TEXTS.CONFIRM_FOLLOW_UP}</p>
            <p style="margin: 0; text-align: left; line-height: 1.5;">
               ${MODAL_TEXTS.CONFIRM_FOLLOW_UP_NOTE}
            </p>
         `,
         icon: "warning",
         showCancelButton: true,
         confirmButtonText: "Si, dar seguimiento",
         cancelButtonText: "Cancelar",
      }).then(async (result) => {
         if (!result.isConfirmed) {
            return;
         }

         try {
            await dispatch(
               createNoteFollow_up(
                  note,
                  leadId,
                  selectedLossOption,
                  followUpDate,
                  leadStatus
               )
            );

            Swal.fire({
               title: "Seguimiento generado",
               text: "¿Que desea hacer continuacion?",
               icon: "question",
               iconHtml: "✔️",
               width: "40em",
               padding: "0 0 1.20em",
               showDenyButton: true,
               showCancelButton: true,
               confirmButtonText: "Volver a la vista anterior",
               denyButtonText: "Ir al perfil del cliente",
            }).then((response) => {
               if (response.isConfirmed) {
                  navigate(-1);
               } else if (response.isDenied) {
                  navigate(`/leads/perfil?data=${leadId}`);
               } else {
                  window.location.reload();
               }
            });
         } catch (error) {
            console.error("Error al crear el evento:", error);
            Swal.fire({
               title: "Error",
               text: "No se pudo crear el evento. Intentelo nuevamente.",
               icon: "error",
               confirmButtonText: "Aceptar",
            });
         }
      });
   };

   useEffect(() => {
      const id = getIdFromUrl();

      if (id) {
         fetchLeadData(id);
      } else {
         setIsLoading(false);
      }
   }, [fetchLeadData, getIdFromUrl]);

   return (
      <div className="container-fluid lead-profile-shell lead-followup-shell">
         <style>{FOLLOW_UP_VIEW_STYLES}</style>

         <div className="row">
            <div className="col-12">
               <div className="card border-0 bg-transparent shadow-none">
                  <div className="card-body lead-profile-panel" style={PROFILE_PANEL_STYLES}>
                     <div className="lead-profile-hero">
                        <div>
                           <span className="lead-profile-eyebrow">Gestion comercial</span>
                           <h4 className="card-title lead-profile-page-title">
                              Programar seguimiento del lead
                           </h4>
                           <p className="lead-profile-page-copy">
                              Registre la siguiente accion comercial del cliente con una
                              vista mas clara y ordenada para dar continuidad al proceso.
                           </p>
                        </div>
                     </div>

                     {isLoading ? (
                        <div className="lead-followup-loading">
                           <p>Cargando datos del lead...</p>
                        </div>
                     ) : (
                        <>
                           <div className="lead-followup-toolbar">
                              <ButtonActions leadData={leadData} />
                           </div>

                           <section className="lead-profile-section">
                              <div className="lead-profile-section-head">
                                 <span className="lead-profile-kicker">Seguimiento activo</span>
                                 <h5 className="lead-profile-section-title">
                                    Seguimiento para {leadName}
                                 </h5>
                                 <p className="lead-profile-section-copy">
                                    Defina la fecha, el motivo, el estado y la nota de
                                    seguimiento para dejar trazabilidad clara del caso.
                                 </p>
                              </div>

                              <div className="lead-followup-helper">
                                 <strong>Importante</strong>
                                 <span>
                                    Esta funcion permite dar seguimiento al cliente y generar
                                    una nota dentro de su perfil comercial.
                                 </span>
                                 <span>
                                    {MODAL_TEXTS.CONFIRM_FOLLOW_UP}{" "}
                                    {MODAL_TEXTS.CONFIRM_FOLLOW_UP_NOTE}
                                 </span>
                              </div>

                              {!leadId ? (
                                 <div className="lead-followup-empty">
                                    <p>No fue posible cargar la informacion del lead.</p>
                                 </div>
                              ) : (
                                 <div className="lead-followup-form">
                                    <div className="lead-followup-grid">
                                       <div className="lead-followup-field">
                                          <label htmlFor="followUpDate">
                                             Fecha de seguimiento
                                          </label>
                                          <input
                                             id="followUpDate"
                                             type="date"
                                             className={`form-control ${
                                                isDateError ? "is-invalid" : ""
                                             }`}
                                             value={followUpDate}
                                             onChange={handleDateChange}
                                          />
                                          {isDateError ? (
                                             <div className="invalid-feedback">
                                                Debe seleccionar una fecha.
                                             </div>
                                          ) : null}
                                       </div>

                                       <div className="lead-followup-field">
                                          <label htmlFor="leadStatus">
                                             Estado del lead
                                          </label>
                                          <select
                                             id="leadStatus"
                                             className={`form-select ${
                                                isLeadStatusError ? "is-invalid" : ""
                                             }`}
                                             value={leadStatus}
                                             onChange={handleLeadStatusChange}
                                          >
                                             <option value="" disabled>
                                                Seleccionar estado
                                             </option>
                                             <option value="1">Activo</option>
                                             <option value="0">Inactivo</option>
                                          </select>
                                          {isLeadStatusError ? (
                                             <div className="invalid-feedback">
                                                Debe seleccionar el estado del lead.
                                             </div>
                                          ) : null}
                                       </div>
                                    </div>

                                    <div className="lead-followup-field">
                                       <label htmlFor="followUpReason">
                                          Motivo de seguimiento
                                       </label>
                                       <select
                                          id="followUpReason"
                                          className={`form-select ${
                                             isSelectError ? "is-invalid" : ""
                                          }`}
                                          value={selectedLossOption}
                                          onChange={handleLossOptionChange}
                                       >
                                          <option value="" disabled>
                                             Seleccionar
                                          </option>
                                          {lossOptions.map((option) => (
                                             <option
                                                key={option.id_caida}
                                                value={option.id_caida}
                                             >
                                                {option.nombre_caida}
                                             </option>
                                          ))}
                                       </select>
                                       {isSelectError ? (
                                          <div className="invalid-feedback">
                                             Debe seleccionar un motivo de seguimiento.
                                          </div>
                                       ) : null}
                                    </div>

                                    <div className="lead-followup-field">
                                       <label htmlFor="followUpNote">Nota de seguimiento</label>
                                       <textarea
                                          id="followUpNote"
                                          rows="5"
                                          className={`form-control ${
                                             isTextareaError ? "is-invalid" : ""
                                          }`}
                                          value={note}
                                          onChange={handleNoteChange}
                                          placeholder="Escriba el contexto del seguimiento, acuerdos, condicion actual del cliente y cualquier detalle importante para el proximo contacto."
                                       />
                                       {isTextareaError ? (
                                          <div className="invalid-feedback">
                                             La nota no puede estar vacia.
                                          </div>
                                       ) : null}
                                    </div>

                                    <div className="lead-followup-submit">
                                       <button
                                          className="btn btn-dark"
                                          onClick={handleGenerateFollowUp}
                                       >
                                          Generar seguimiento
                                       </button>
                                    </div>
                                 </div>
                              )}
                           </section>
                        </>
                     )}
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};
