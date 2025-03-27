import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setleadActive } from "../store/leads/leadSlice";
import { WhatsappAndNote } from "../store/leads/thunksLeads";
import Swal from "sweetalert2";
import { MODAL_TEXTS } from "../app/pages/modal/constants";

/**
 * Hook `useLeadActions`
 *
 * Este hook encapsula todas las acciones relacionadas con un lead, como navegar a vistas específicas,
 * interactuar con APIs externas (WhatsApp), mostrar mensajes de confirmación y manejar datos asociados.
 *
 * @returns {Object} - Funciones para manejar acciones relacionadas con el lead.
 */
export const useLeadActions = () => {
     const dispatch = useDispatch();
     const navigate = useNavigate();

     /**
      * Abre WhatsApp con el número proporcionado.
      * Si el número no es válido o no está definido, muestra un mensaje de error.
      *
      * @param {string} telefono - Número de teléfono del lead.
      */
     const handleWhatsappClick = (telefono) => {
          if (!telefono) {
               Swal.fire("Error", MODAL_TEXTS.NO_PHONE, "error");
               return Promise.reject("No phone number provided");
          }

          const cleanedPhone = telefono.trim().replace(/[^0-9+]/g, "");
          
          // Verificar si el número ya tiene el formato correcto (+506...)
          if (!cleanedPhone.startsWith("+") && 
              (cleanedPhone.startsWith("506") || !cleanedPhone.startsWith("506"))) {
               
               // Determinar mensaje según el formato del número
               let message = "";
               if (cleanedPhone.startsWith("506")) {
                    message = "Este número comienza con 506 pero le falta el signo +";
               } else {
                    message = "Este número no tiene el código de país +506";
               }
               
               // Retornar una promesa que se resolverá después de la interacción del usuario
               return new Promise((resolve) => {
                    // Mostrar SweetAlert para agregar código de país
                    Swal.fire({
                         title: "Código de país incompleto",
                         html: `
                              <p>${message}</p>
                              <div style="margin-bottom: 15px; display: flex; align-items: center; justify-content: center;">
                                   <input class="form-check-input" type="checkbox" id="addCodeCheckbox" checked style="margin-right: 10px;">
                                   <label class="form-check-label" for="addCodeCheckbox">
                                        Agregar +506
                                   </label>
                              </div>
                              <div style="margin-bottom: 10px;">
                                   <input id="phoneInput" class="swal2-input" value="${cleanedPhone}" style="width: 250px;">
                              </div>
                         `,
                         showCancelButton: true,
                         confirmButtonText: "Ir a WhatsApp",
                         cancelButtonText: "Cancelar",
                         preConfirm: () => {
                              const addCode = document.getElementById('addCodeCheckbox').checked;
                              const phoneInputValue = document.getElementById('phoneInput').value.trim();
                              return {
                                   addCode,
                                   phone: phoneInputValue
                              };
                         }
                    }).then((result) => {
                         if (result.isConfirmed) {
                              let formattedPhone;
                              if (result.value.addCode) {
                                   // Si el número ya comienza con 506, solo añadir el "+"
                                   if (result.value.phone.startsWith("506")) {
                                        formattedPhone = `+${result.value.phone}`;
                                   } else {
                                        formattedPhone = `+506${result.value.phone}`;
                                   }
                              } else {
                                   formattedPhone = result.value.phone;
                              }
                              
                              if (formattedPhone.length > 8) {
                                   const whatsappUrl = `https://wa.me/${formattedPhone.replace(/^\+/, '')}`;
                                   window.open(whatsappUrl, "_blank");
                                   resolve(true); // Resuelve la promesa después de abrir WhatsApp
                              } else {
                                   Swal.fire("Error", "El número de teléfono no es válido para WhatsApp.", "error")
                                        .then(() => resolve(false)); // Resuelve con false en caso de error
                              }
                         } else {
                              resolve(false); // El usuario canceló
                         }
                    });
               });
          } else {
               // Si ya tiene el formato correcto (+xxx), usar directamente
               const formattedPhone = cleanedPhone;
               
               if (formattedPhone.length > 8) {
                    const whatsappUrl = `https://wa.me/${formattedPhone.replace(/^\+/, '')}`;
                    window.open(whatsappUrl, "_blank");
                    return Promise.resolve(true); // Resuelve inmediatamente
               } else {
                    Swal.fire("Error", "El número de teléfono no es válido para WhatsApp.", "error");
                    return Promise.resolve(false);
               }
          }
     };

     /**
      * Navega a la pantalla para agregar una nota asociada al lead.
      *
      * @param {Object} leadData - Datos del lead.
      */
     const handleNote = (leadData) => {
          dispatch(setleadActive(leadData));
          navigate(`/leads/note?id=${leadData?.idinterno_lead}`);
     };

     /**
      * Navega a la pantalla para crear o ver eventos asociados al lead.
      *
      * @param {Object} leadData - Datos del lead.
      */
     const handleEvents = (leadData) => {
          dispatch(setleadActive(leadData));
          navigate(`/events/actions?idCalendar=0&idLead=${leadData?.idinterno_lead}&idDate=0`);
     };

     /**
      * Abre WhatsApp y genera una nota asociada al lead después de confirmar la acción.
      *
      * @param {Object} leadData - Datos del lead.
      */
     const handleWhatsappAndNote = async (leadData) => {
          const result = await Swal.fire({
               title: "¿Está seguro?",
               text: MODAL_TEXTS.WHATSAPP_CONFIRM,
               icon: "warning",
               showCancelButton: true,
               confirmButtonText: "Sí, quiero hacerlo",
               cancelButtonText: "No",
          });

          if (result.isConfirmed) {
               const note = "Contacto generado desde el botón de WhatsApp";
               await dispatch(WhatsappAndNote(note, leadData?.idinterno_lead, leadData?.segimineto_lead));
               
               // Esperar a que se complete la validación y apertura de WhatsApp
               const whatsappOpened = await handleWhatsappClick(leadData?.telefono_lead);
               
               // Solo recargar si se abrió WhatsApp con éxito
               if (whatsappOpened) {
                    window.location.reload();
               }
          }
     };

     /**
      * Marca un lead como perdido después de confirmar la acción.
      *
      * @param {Object} leadData - Datos del lead.
      */
     const handleLoss = (leadData) => {
          Swal.fire({
               title: "¿Está seguro?",
               text: MODAL_TEXTS.CONFIRM_LOSS,
               icon: "warning",
               showCancelButton: true,
               confirmButtonText: "Sí, marcar como perdido",
               cancelButtonText: "Cancelar",
          }).then((result) => {
               if (result.isConfirmed) {
                    navigate(`/leads/loss?id=${leadData?.idinterno_lead}`);
               }
          });
     };

     /**
      * Coloca un lead en seguimiento después de confirmar la acción.
      *
      * @param {Object} leadData - Datos del lead.
      */
     const handfollow_up = (leadData) => {
          Swal.fire({
               title: "¿Está seguro?",
               text: MODAL_TEXTS.CONFIRM_FOLLOW_UP,
               icon: "warning",
               showCancelButton: true,
               confirmButtonText: "Sí, colocar en seguimiento",
               cancelButtonText: "Cancelar",
          }).then((result) => {
               if (result.isConfirmed) {
                    navigate(`/leads/follow_up?id=${leadData?.idinterno_lead}`);
               }
          });
     };

     /**
      * Crea una oportunidad asociada al lead después de confirmar la acción.
      *
      * @param {Object} leadData - Datos del lead.
      */
     const crearOportunidad = (leadData) => {
          Swal.fire({
               title: "¿Está seguro?",
               text: MODAL_TEXTS.CONFIRM_OPPORTUNITY,
               icon: "warning",
               showCancelButton: true,
               confirmButtonText: "Sí, crear oportunidad",
               cancelButtonText: "Cancelar",
          }).then((result) => {
               if (result.isConfirmed) {
                    navigate(`/oportunidad/crear?idExpediente=0&idLead=${leadData?.idinterno_lead}`);
               }
          });
     };

     /**
      * Navega a la lista de oportunidades asociadas al lead.
      *
      * @param {Object} leadData - Datos del lead.
      */
     const handleOpportunityList = (leadData) => {
          navigate(`/oportunidad/list?idLead=${leadData?.idinterno_lead}`);
     };

     /**
      * Realiza una llamada al número proporcionado.
      * Si el número no está definido, muestra un mensaje de error.
      *
      * @param {string} telefono - Número de teléfono del lead.
      */
     const handleCallClient = (telefono) => {
          if (telefono) {
               window.open(`tel:${telefono}`, "_self");
          } else {
               Swal.fire("Error", MODAL_TEXTS.NO_PHONE, "error");
          }
     };

     /**
      * Navega al perfil del usuario asociado al lead.
      *
      * @param {Object} leadData - Datos del lead.
      */
     const PerfilUsuario = (leadData) => {
          navigate(`/leads/perfil?data=${leadData?.idinterno_lead}`);
     };

     /**
      * Navega hacia atrás en el historial de navegación.
      */
     const handleBck = () => {
          navigate(-1);
     };

     /**
      * Navega a la pantalla de edición del lead.
      *
      * @param {Object} leadData - Datos del lead.
      */
     const handedit = (leadData) => {
          navigate(`/leads/edit?id=${leadData?.idinterno_lead}`);
     };

     return {
          handleWhatsappClick,
          handleNote,
          handleEvents,
          handleWhatsappAndNote,
          handleLoss,
          handfollow_up,
          crearOportunidad,
          handleOpportunityList,
          handleCallClient,
          PerfilUsuario,
          handleBck,
          handedit,
     };
};
