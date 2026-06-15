import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setleadActive } from "../store/leads/leadSlice";
import { WhatsappAndNote } from "../store/leads/thunksLeads";
import Swal from "sweetalert2";
import { MODAL_TEXTS } from "../app/pages/modal/constants";

/**
 * Hook `useLeadActions`
 *
 * Este hook encapsula todas las acciones relacionadas con un lead, como navegar a vistas especificas,
 * interactuar con APIs externas (WhatsApp), mostrar mensajes de confirmacion y manejar datos asociados.
 *
 * @returns {Object} - Funciones para manejar acciones relacionadas con el lead.
 */
export const useLeadActions = () => {
     const dispatch = useDispatch();
     const navigate = useNavigate();

     /**
      * Abre WhatsApp con el numero proporcionado.
      * Si el numero no es valido o no esta definido, muestra un mensaje de error.
      *
      * @param {string} telefono - Numero de telefono del lead.
      */
     const handleWhatsappClick = (telefono) => {
          if (!telefono) {
               Swal.fire("Error", MODAL_TEXTS.NO_PHONE, "error");
               return Promise.reject("No phone number provided");
          }

          const cleanedPhone = telefono.trim().replace(/[^0-9+]/g, "");

          // Verificar si el numero ya tiene el formato correcto (+506...)
          if (!cleanedPhone.startsWith("+") &&
              (cleanedPhone.startsWith("506") || !cleanedPhone.startsWith("506"))) {

               // Determinar mensaje segun el formato del numero
               let message = "";
               if (cleanedPhone.startsWith("506")) {
                    message = "Este numero comienza con 506 pero le falta el signo +";
               } else {
                    message = "Este numero no tiene el codigo de pais +506";
               }

               // Retornar una promesa que se resolvera despues de la interaccion del usuario
               return new Promise((resolve) => {
                    // Mostrar SweetAlert para agregar codigo de pais
                    Swal.fire({
                         title: "Codigo de pais incompleto",
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
                              const addCode = document.getElementById("addCodeCheckbox").checked;
                              const phoneInputValue = document.getElementById("phoneInput").value.trim();
                              return {
                                   addCode,
                                   phone: phoneInputValue
                              };
                         }
                    }).then((result) => {
                         if (result.isConfirmed) {
                              let formattedPhone;
                              if (result.value.addCode) {
                                   // Si el numero ya comienza con 506, solo anadir el "+"
                                   if (result.value.phone.startsWith("506")) {
                                        formattedPhone = `+${result.value.phone}`;
                                   } else {
                                        formattedPhone = `+506${result.value.phone}`;
                                   }
                              } else {
                                   formattedPhone = result.value.phone;
                              }

                              if (formattedPhone.length > 8) {
                                   const whatsappUrl = `https://wa.me/${formattedPhone.replace(/^\+/, "")}`;
                                   window.open(whatsappUrl, "_blank");
                                   resolve(true); // Resuelve la promesa despues de abrir WhatsApp
                              } else {
                                   Swal.fire("Error", "El numero de telefono no es valido para WhatsApp.", "error")
                                        .then(() => resolve(false)); // Resuelve con false en caso de error
                              }
                         } else {
                              resolve(false); // El usuario cancelo
                         }
                    });
               });
          } else {
               // Si ya tiene el formato correcto (+xxx), usar directamente
               const formattedPhone = cleanedPhone;

               if (formattedPhone.length > 8) {
                    const whatsappUrl = `https://wa.me/${formattedPhone.replace(/^\+/, "")}`;
                    window.open(whatsappUrl, "_blank");
                    return Promise.resolve(true); // Resuelve inmediatamente
               } else {
                    Swal.fire("Error", "El numero de telefono no es valido para WhatsApp.", "error");
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
      * Abre la creación de eventos asociada al lead.
      * Si el caller inyecta un handler inline, se usa ese flujo; si no, se mantiene
      * la navegación legacy para no romper pantallas existentes.
      *
      * @param {Object} leadData - Datos del lead.
      * @param {Function} [openInlineEventModal] - Apertura inline opcional.
      */
     const handleEvents = (leadData, openInlineEventModal) => {
          dispatch(setleadActive(leadData));

          if (typeof openInlineEventModal === "function") {
               openInlineEventModal(leadData);
               return;
          }

          navigate(`/events/actions?idCalendar=0&idLead=${leadData?.idinterno_lead}&idDate=0`);
     };

     /**
      * Abre WhatsApp y genera una nota asociada al lead despues de confirmar la accion.
      *
      * @param {Object} leadData - Datos del lead.
      */
     const handleWhatsappAndNote = async (leadData) => {
          const result = await Swal.fire({
               title: "¿Esta seguro?",
               text: MODAL_TEXTS.WHATSAPP_CONFIRM,
               icon: "warning",
               showCancelButton: true,
               confirmButtonText: "Si, quiero hacerlo",
               cancelButtonText: "No",
          });

          if (result.isConfirmed) {
               const note = "Contacto generado desde el boton de WhatsApp";
               await dispatch(WhatsappAndNote(note, leadData?.idinterno_lead, leadData?.segimineto_lead));

               // Esperar a que se complete la validacion y apertura de WhatsApp
               const whatsappOpened = await handleWhatsappClick(leadData?.telefono_lead);

               // Solo recargar si se abrio WhatsApp con exito
               if (whatsappOpened) {
                    window.location.reload();
               }
          }
     };

     /**
      * Marca un lead como perdido despues de confirmar la accion.
      *
      * @param {Object} leadData - Datos del lead.
      */
     const handleLoss = (leadData) => {
          Swal.fire({
               title: "¿Esta seguro?",
               text: MODAL_TEXTS.CONFIRM_LOSS,
               icon: "warning",
               showCancelButton: true,
               confirmButtonText: "Si, marcar como perdido",
               cancelButtonText: "Cancelar",
          }).then((result) => {
               if (result.isConfirmed) {
                    navigate(`/leads/loss?id=${leadData?.idinterno_lead}`);
               }
          });
     };

     /**
      * Coloca un lead en seguimiento despues de confirmar la accion.
      *
      * @param {Object} leadData - Datos del lead.
      */
     const handfollow_up = (leadData) => {
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
               confirmButtonText: "Si, colocar en seguimiento",
               cancelButtonText: "Cancelar",
          }).then((result) => {
               if (result.isConfirmed) {
                    navigate(`/leads/follow_up?id=${leadData?.idinterno_lead}`);
               }
          });
     };

     /**
      * Crea una oportunidad asociada al lead despues de confirmar la accion.
      *
      * @param {Object} leadData - Datos del lead.
      */
     const crearOportunidad = (leadData) => {
          Swal.fire({
               title: "¿Esta seguro?",
               text: MODAL_TEXTS.CONFIRM_OPPORTUNITY,
               icon: "warning",
               showCancelButton: true,
               confirmButtonText: "Si, crear oportunidad",
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
          navigate(`/oportunidad/lista?oportuinidad=2&idLead=${leadData?.idinterno_lead}`);
     };

     /**
      * Realiza una llamada al numero proporcionado.
      * Si el numero no esta definido, muestra un mensaje de error.
      *
      * @param {string} telefono - Numero de telefono del lead.
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
      * Navega hacia atras en el historial de navegacion.
      */
     const handleBck = () => {
          navigate(-1);
     };

     /**
      * Navega a la pantalla de edicion del lead.
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
