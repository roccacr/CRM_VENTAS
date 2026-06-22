import React, { useCallback, useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { createNote, getSpecificLead } from "../../../../store/leads/thunksLeads";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import { PROFILE_PANEL_STYLES, PROFILE_THEME_STYLES } from "../perfil/profileTheme";

const NOTE_VIEW_STYLES = `
   ${PROFILE_THEME_STYLES}

   .lead-note-shell .lead-profile-panel {
      padding: 18px;
   }

   .lead-note-toolbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 12px;
   }

   .lead-note-helper {
      margin: 0;
      padding: 12px 14px;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      background: #fbfbfc;
      font-size: 12px;
      line-height: 1.55;
      color: #4b5563;
   }

   .lead-note-helper strong {
      color: #111827;
   }

   .lead-note-form {
      display: grid;
      gap: 12px;
   }

   .lead-note-field label {
      display: inline-block;
      margin-bottom: 6px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #6b7280;
   }

   .lead-note-field .form-select,
   .lead-note-field .form-control {
      border: 1px solid #d1d5db;
      border-radius: 12px;
      min-height: 44px;
      padding: 10px 12px;
      font-size: 13px;
      box-shadow: none;
   }

   .lead-note-field textarea.form-control {
      min-height: 150px;
      resize: vertical;
   }

   .lead-note-field .form-select:focus,
   .lead-note-field .form-control:focus {
      border-color: #111827;
      box-shadow: 0 0 0 4px rgba(17, 24, 39, 0.08);
   }

   .lead-note-submit {
      display: flex;
      justify-content: flex-end;
      margin-top: 4px;
   }

   .lead-note-submit .btn {
      min-width: 190px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
   }

   .lead-note-loading {
      padding: 20px 0 4px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
   }
`;

const QUICK_OPTIONS = [
   "Seguimiento inicial",
   "Seguimiento Avanzado",
   "Interés Alto",
   "Interés Medio",
   "Interés Bajo",
   "Quiere visitar",
   "Interés en otro proyecto",
   "Cliente en análisis bancario",
   "Se reactivó",
   "Interés en:",
   "Seguimiento 1",
   "Seguimiento 2",
   "Cliente potencial alto",
   "Cliente potencial medio",
   "Cliente potencial bajo",
   "Presupuesto aprobado",
   "Esperando respuesta",
   "Necesita más información",
   "Agendada cita",
   "Canceló cita",
];

export const View_note = () => {
   const dispatch = useDispatch();
   const navigate = useNavigate();
   const location = useLocation();
   const [leadData, setLeadData] = useState(null);
   const [leadName, setLeadName] = useState(null);
   const [note, setNote] = useState("");
   const [isLoading, setIsLoading] = useState(true);
   const [isTextareaError, setIsTextareaError] = useState(false);
   const [valueStatus, setValueStatus] = useState(null);
   const [leadId, setLeadId] = useState(null);
   const [selectedQuickOption, setSelectedQuickOption] = useState("");

   const getIdFromUrl = useCallback(() => {
      const params = new URLSearchParams(location.search);
      return params.get("id");
   }, [location.search]);

   const fetchLeadData = async (id) => {
      setIsLoading(true);
      const result = await dispatch(getSpecificLead(id));
      setLeadName(result?.nombre_lead || "Cliente");
      setValueStatus(result?.segimineto_lead || null);
      setLeadId(result?.idinterno_lead || null);
      setLeadData(result || null);
      setIsLoading(false);
   };

   const handleNoteChange = (event) => {
      const newValue = event.target.value;
      setNote(newValue);
      if (newValue.trim() !== "") {
         setIsTextareaError(false);
      }
   };

   const handleQuickOptionSelect = (event) => {
      const selectedValue = event.target.value;

      if (selectedValue) {
         setSelectedQuickOption(selectedValue);
         setNote((prevNote) => (prevNote.trim() ? `${prevNote} ${selectedValue}` : selectedValue));
         setIsTextareaError(false);
      } else {
         setSelectedQuickOption("");
      }
   };

   const handleGenerateNote = () => {
      if (note.trim() === "") {
         setIsTextareaError(true);
         return;
      }

      Swal.fire({
         title: "¿Está seguro?",
         text: "¿Desea generar la nota?",
         icon: "warning",
         showCancelButton: true,
         confirmButtonText: "Sí, crear nota",
         cancelButtonText: "Cancelar",
      }).then(async (result) => {
         if (!result.isConfirmed) {
            return;
         }

         try {
            await dispatch(createNote(note, leadId, valueStatus));

            Swal.fire({
               title: "¡Nota creada con éxito!",
               text: "La nota fue registrada correctamente.",
               icon: "question",
               iconHtml: "✔️",
               width: "40em",
               padding: "0 0 1.20em",
               showDenyButton: true,
               showCancelButton: true,
               confirmButtonText: "Volver la vista anterior",
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
            console.error("Error al crear la nota:", error);
            Swal.fire({
               title: "Error",
               text: "No se pudo crear la nota. Inténtelo nuevamente.",
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
      }
   }, [getIdFromUrl]);

   return (
      <div className="container-fluid lead-profile-shell lead-note-shell">
         <style>{NOTE_VIEW_STYLES}</style>
         <div className="row">
            <div className="col-12">
               <div className="card border-0 bg-transparent shadow-none">
                  <div className="card-body lead-profile-panel" style={PROFILE_PANEL_STYLES}>
                     <div className="lead-profile-hero">
                        <div>
                           <span className="lead-profile-eyebrow">Gestión comercial</span>
                           <h4 className="card-title lead-profile-page-title">Crear una nota del lead</h4>
                           <p className="lead-profile-page-copy">
                              Registre interacciones, avances y observaciones del cliente en una
                              vista más clara y ordenada para seguimiento futuro.
                           </p>
                        </div>
                     </div>

                     {isLoading ? (
                        <div className="lead-note-loading">
                           <p>Cargando datos del lead...</p>
                        </div>
                     ) : (
                        <>
                           <div className="lead-note-toolbar">
                              <ButtonActions leadData={leadData} />
                           </div>

                           <section className="lead-profile-section">
                              <div className="lead-profile-section-head">
                                 <span className="lead-profile-kicker">Registro manual</span>
                                 <h5 className="lead-profile-section-title">Nota para {leadName}</h5>
                                 <p className="lead-profile-section-copy">
                                    Use plantillas rápidas o escriba una nota libre para documentar la
                                    interacción del cliente.
                                 </p>
                              </div>

                              <p className="lead-note-helper">
                                 <strong>Importante:</strong> esta función permite mantener un
                                 registro claro de las acciones realizadas con el cliente y facilita
                                 consultas posteriores del equipo comercial.
                              </p>

                              <div className="lead-note-form">
                                 <div className="lead-note-field">
                                    <label>Opciones de llenado rápido</label>
                                    <select
                                       className="form-select"
                                       value={selectedQuickOption}
                                       onChange={handleQuickOptionSelect}
                                    >
                                       <option value="">Selecciona una opción rápida...</option>
                                       {QUICK_OPTIONS.map((option) => (
                                          <option key={option} value={option}>
                                             {option}
                                          </option>
                                       ))}
                                    </select>
                                 </div>

                                 <div className="lead-note-field">
                                    <label htmlFor="exampleFormControlTextarea1">Comentario o nota</label>
                                    <textarea
                                       rows="5"
                                       id="exampleFormControlTextarea1"
                                       className={`form-control ${isTextareaError ? "is-invalid" : ""}`}
                                       value={note}
                                       onChange={handleNoteChange}
                                       placeholder="Escriba aquí el detalle de la interacción, avance, acuerdo u observación relevante."
                                    ></textarea>
                                    {isTextareaError ? (
                                       <div className="invalid-feedback">La nota no puede estar vacía.</div>
                                    ) : null}
                                 </div>

                                 <div className="lead-note-submit">
                                    <button className="btn btn-dark" onClick={handleGenerateNote}>
                                       Generar nota
                                    </button>
                                 </div>
                              </div>
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
