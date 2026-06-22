import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
   createNoteLoss,
   getSpecificLead,
   getoptionLoss,
} from "../../../../store/leads/thunksLeads";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import {
   PROFILE_PANEL_STYLES,
   PROFILE_THEME_STYLES,
} from "../perfil/profileTheme";

const LOSS_VIEW_STYLES = `
${PROFILE_THEME_STYLES}

.lead-loss-shell .lead-profile-panel {
   padding: 18px;
}

.lead-loss-toolbar {
   display: flex;
   justify-content: flex-end;
   margin-bottom: 12px;
}

.lead-loss-loading,
.lead-loss-empty {
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

.lead-loss-alert {
   display: grid;
   gap: 6px;
   margin: 0 0 12px;
   padding: 14px 16px;
   border: 1px solid #e5e7eb;
   border-radius: 12px;
   background: #fbfbfc;
}

.lead-loss-alert strong {
   font-size: 11px;
   letter-spacing: 0.06em;
   text-transform: uppercase;
   color: #111827;
}

.lead-loss-alert p {
   margin: 0;
   font-size: 12px;
   line-height: 1.55;
   color: #4b5563;
}

.lead-loss-form {
   display: grid;
   gap: 12px;
}

.lead-loss-field label {
   display: inline-block;
   margin-bottom: 6px;
   font-size: 10px;
   font-weight: 700;
   letter-spacing: 0.04em;
   text-transform: uppercase;
   color: #6b7280;
}

.lead-loss-field .form-select,
.lead-loss-field .form-control {
   border: 1px solid #d1d5db;
   border-radius: 12px;
   min-height: 44px;
   padding: 10px 12px;
   font-size: 13px;
   box-shadow: none;
}

.lead-loss-field .form-select:focus,
.lead-loss-field .form-control:focus {
   border-color: #111827;
   box-shadow: 0 0 0 4px rgba(17, 24, 39, 0.08);
}

.lead-loss-field textarea.form-control {
   min-height: 160px;
   resize: vertical;
}

.lead-loss-field .invalid-feedback {
   display: block;
   margin-top: 6px;
   font-size: 11px;
}

.lead-loss-submit {
   display: flex;
   justify-content: flex-end;
   margin-top: 4px;
}

.lead-loss-submit .btn {
   min-width: 180px;
   min-height: 44px;
   border-radius: 12px;
   padding: 0 18px;
   font-size: 12px;
   font-weight: 700;
   letter-spacing: 0.02em;
}
`;

export const View_loss_lead = () => {
   const dispatch = useDispatch();
   const navigate = useNavigate();
   const location = useLocation();
   const [leadData, setLeadData] = useState(null);
   const [leadName, setLeadName] = useState("Cliente");
   const [note, setNote] = useState("");
   const [isLoading, setIsLoading] = useState(true);
   const [isTextareaError, setIsTextareaError] = useState(false);
   const [isSelectError, setIsSelectError] = useState(false);
   const [leadId, setLeadId] = useState(null);
   const [lossOptions, setLossOptions] = useState([]);
   const [selectedLossOption, setSelectedLossOption] = useState("");

   const getIdFromUrl = useCallback(() => {
      const params = new URLSearchParams(location.search);
      return params.get("id");
   }, [location.search]);

   const fetchLeadData = useCallback(
      async (id) => {
         setIsLoading(true);

         try {
            const [leadResult, lossResult] = await Promise.all([
               dispatch(getSpecificLead(id)),
               dispatch(getoptionLoss(3)),
            ]);

            setLeadName(leadResult?.nombre_lead || "Cliente");
            setLeadId(leadResult?.idinterno_lead || null);
            setLeadData(leadResult || null);
            setLossOptions(Array.isArray(lossResult) ? lossResult : []);
         } catch (error) {
            console.error("Error al cargar la vista de lead perdido:", error);
            setLeadData(null);
            setLossOptions([]);
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

   const handleGenerateNote = () => {
      const hasNote = note.trim() !== "";
      const hasLossReason = selectedLossOption !== "";

      if (!hasNote || !hasLossReason) {
         setIsTextareaError(!hasNote);
         setIsSelectError(!hasLossReason);

         Swal.fire({
            title: "Campos incompletos",
            text: "Debe completar el motivo de pérdida y la nota antes de continuar.",
            icon: "warning",
            confirmButtonText: "Aceptar",
         });
         return;
      }

      Swal.fire({
         title: "¿Está seguro que desea marcar este lead como perdido?",
         text: "Esta acción actualizará el registro comercial y marcará sus transacciones relacionadas como perdidas.",
         icon: "warning",
         showCancelButton: true,
         confirmButtonText: "Sí, marcar como perdido",
         cancelButtonText: "Cancelar",
      }).then(async (result) => {
         if (!result.isConfirmed) {
            return;
         }

         try {
            await dispatch(createNoteLoss(note, leadId, selectedLossOption));

            Swal.fire({
               title: "Lead marcado como perdido",
               text: "La información fue registrada correctamente.",
               icon: "question",
               iconHtml: "✔️",
               width: "40em",
               padding: "0 0 1.2em",
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
            console.error("Error al marcar el lead como perdido:", error);
            Swal.fire({
               title: "Error",
               text: "No se pudo completar la acción. Inténtelo nuevamente.",
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
      <div className="container-fluid lead-profile-shell lead-loss-shell">
         <style>{LOSS_VIEW_STYLES}</style>

         <div className="row">
            <div className="col-12">
               <div className="card border-0 bg-transparent shadow-none">
                  <div className="card-body lead-profile-panel" style={PROFILE_PANEL_STYLES}>
                     <div className="lead-profile-hero">
                        <div>
                           <span className="lead-profile-eyebrow">Gestión comercial</span>
                           <h4 className="card-title lead-profile-page-title">
                              Marcar lead como perdido
                           </h4>
                           <p className="lead-profile-page-copy">
                              Registre el motivo comercial y el contexto de cierre para
                              mantener el historial del cliente claro, ordenado y útil para
                              seguimiento posterior.
                           </p>
                        </div>
                     </div>

                     {isLoading ? (
                        <div className="lead-loss-loading">
                           <p>Cargando información del lead...</p>
                        </div>
                     ) : (
                        <>
                           <div className="lead-loss-toolbar">
                              <ButtonActions leadData={leadData} />
                           </div>

                           <section className="lead-profile-section">
                              <div className="lead-profile-section-head">
                                 <span className="lead-profile-kicker">Cierre comercial</span>
                                 <h5 className="lead-profile-section-title">
                                    Gestión de pérdida para {leadName}
                                 </h5>
                                 <p className="lead-profile-section-copy">
                                    Documente el motivo de pérdida y una nota cualitativa para
                                    dar contexto al cierre del proceso.
                                 </p>
                              </div>

                              <div className="lead-loss-alert">
                                 <strong>Importante</strong>
                                 <p>
                                    Esta acción no se puede deshacer desde esta vista. Además de
                                    generar la nota, el sistema actualizará el estado del lead y
                                    de sus transacciones relacionadas.
                                 </p>
                              </div>

                              {!leadId ? (
                                 <div className="lead-loss-empty">
                                    <p>No fue posible cargar la información del lead.</p>
                                 </div>
                              ) : (
                                 <div className="lead-loss-form">
                                    <div className="lead-loss-field">
                                       <label htmlFor="lossReason">Motivo de pérdida</label>
                                       <select
                                          id="lossReason"
                                          className={`form-select ${
                                             isSelectError ? "is-invalid" : ""
                                          }`}
                                          value={selectedLossOption}
                                          onChange={handleLossOptionChange}
                                       >
                                          <option value="">Seleccione un motivo...</option>
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
                                             Debe seleccionar un motivo de pérdida.
                                          </div>
                                       ) : null}
                                    </div>

                                    <div className="lead-loss-field">
                                       <label htmlFor="lossNote">Nota de cierre</label>
                                       <textarea
                                          id="lossNote"
                                          rows="5"
                                          className={`form-control ${
                                             isTextareaError ? "is-invalid" : ""
                                          }`}
                                          value={note}
                                          onChange={handleNoteChange}
                                          placeholder="Describa el contexto de la pérdida, objeciones relevantes, razones identificadas y cualquier información útil para el equipo comercial."
                                       />
                                       {isTextareaError ? (
                                          <div className="invalid-feedback">
                                             La nota no puede estar vacía.
                                          </div>
                                       ) : null}
                                    </div>

                                    <div className="lead-loss-submit">
                                       <button className="btn btn-dark" onClick={handleGenerateNote}>
                                          Dar como perdido
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
