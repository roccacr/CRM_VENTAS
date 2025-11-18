import { useEffect, useState, useRef } from "react";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import Swal from "sweetalert2";
import { useDispatch, useSelector } from "react-redux";
import { getSpecificLead } from "../../../../store/leads/thunksLeads";
import {
   AplicarComicion,
   enviarReservaCaida,
   enviarReservaN,
   obtenerOrdendeventa,
   bitacoraOrdenDeventa,
   modifcarOrdenVenta,
   enviarCierreFirmando,
   modificarCierrreFirmandoThinks,
   bitacoraOrdenDeventaCierre,
} from "../../../../store/ordenVenta/thunkOrdenVenta";
import $ from "jquery";
import "datatables.net";
import "datatables.net-bs5";
import "datatables.net-searchpanes-bs5";
import "datatables.net-select-bs5";
import { useNavigate } from "react-router-dom";
import { ModalOrdenVenta } from "../../estimacion/ModalOrdenVenta";
import { OneDrive } from "./OneDrive";
import SticNotesContainer from "../../../../components/sticknotes/SticNotesContainer";
import { Box, Typography, Paper } from "@mui/material";
import { keyframes } from "@mui/system";

/**
 * Utility Functions
 */

/**
 * Formats a number as currency with specified decimal places.
 * @param {number} valor - The number to format
 * @returns {string|number} Formatted currency string or 0 if invalid input
 */
const formatoMoneda = (valor) => {
   if (!valor || isNaN(Number(valor)) || Number(valor) === 0) return 0;
   return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 5,
   }).format(valor);
};

/**
 * Extracts and parses URL query parameters.
 * @param {string} param - Parameter name to extract
 * @returns {string|number|null} Parsed parameter value
 */
const getQueryParam = (param) => {
   const value = new URLSearchParams(window.location.search).get(param);
   return value && !isNaN(value) && !isNaN(parseFloat(value)) ? Number(value) : value;
};

/**
 * Shows a loading indicator using SweetAlert2.
 */
const showLoadingIndicator = () => {
   Swal.fire({
      title: "Cargando datos...",
      text: "Por favor espera.",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
   });
};

/**
 * Data Fetching Functions
 */

/**
 * Fetches lead and transaction details from the backend.
 * @param {Object} params - Parameters for fetching data
 * @param {number} params.leadId - ID of the lead to fetch
 * @param {number} params.transaccion - ID of the transaction to fetch
 * @param {Function} params.dispatch - Redux dispatch function
 * @param {Function} params.setLeadDetails - Function to set lead details
 * @param {Function} params.setDatosOrdenVenta - Function to set order details
 * @param {Function} params.setValidarOrdenVenta - Function to set order details
 * @returns {Promise<void>}
 */
const fetchData = async ({ leadId, transaccion, dispatch, setLeadDetails, setDatosOrdenVenta, setValidarOrdenVenta }) => {
   try {
      const [leadData, ordenData] = await Promise.all([
         dispatch(getSpecificLead(leadId)), 
         dispatch(obtenerOrdendeventa(transaccion)),
      ]);





      setLeadDetails(leadData);
      if (ordenData?.data?.Detalle) {
         setDatosOrdenVenta(ordenData.data.Detalle);
      }
      if (ordenData?.data?.validarOrdenVenta) {
         setValidarOrdenVenta(ordenData?.data?.validarOrdenVenta.data[0]);
      }
   } catch (error) {
      console.error("Error fetching data:", error);
      Swal.fire({
         icon: "error",
         title: "Error",
         text: "Error al cargar los datos. Por favor, intente nuevamente.",
      });
   }
};

/**
 * Constants and configurations
 */
const TABLE_CONFIG = {
   language: {
      decimal: "",
      emptyTable: "No hay información disponible",
      info: "Mostrando _START_ a _END_ de _TOTAL_ registros",
      infoEmpty: "Mostrando 0 a 0 de 0 registros",
      infoFiltered: "(filtrado de _MAX_ registros totales)",
      infoPostFix: "",
      thousands: ",",
      lengthMenu: "Mostrar _MENU_ registros",
      loadingRecords: "Cargando...",
      processing: "Procesando...",
      search: "Buscar:",
      zeroRecords: "No se encontraron registros coincidentes",
      paginate: {
         first: "Primero",
         last: "Último",
         next: "Siguiente",
         previous: "Anterior",
      },
      aria: {
         sortAscending: ": activar para ordenar la columna ascendente",
         sortDescending: ": activar para ordenar la columna descendente",
      },
   },
   columns: [
      { data: "numero", title: "#" },
      { data: "articulo", title: "ARTÍCULO" },
      { data: "monto", title: "MONTO" },
      { data: "fechaPago", title: "FECHA DE PAGO PROYECTADO" },
      { data: "cantidad", title: "CANTIDAD" },
      { data: "descripcion", title: "DESCRIPCIÓN" },
   ],
};

/**
 * Handles commission application logic
 * @param {Function} dispatch - Redux dispatch function
 * @param {string|number} orderId - Order ID to apply commission to
 */
const handleCommissionAction = async (dispatch, orderId) => {
   const result = await Swal.fire({
      title: "Gestión de Comisión",
      text: "¿Qué acción desea realizar con la comisión?",
      icon: "question",
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: "Aplicar Comisión",
      denyButtonText: "Anular Comisión",
      cancelButtonText: "Cancelar",
   });

   if (result.isConfirmed) {
      await dispatch(AplicarComicion(1, orderId));
      Swal.fire("¡Aplicada!", "La comisión ha sido aplicada.", "success");
   } else if (result.isDenied) {
      await dispatch(AplicarComicion(0, orderId));
      Swal.fire("¡Anulada!", "La comisión ha sido anulada.", "info");
   }
};

/**
 * Processes sales order data for DataTable
 * @param {Object} datosOrdenVenta - Raw sales order data
 * @returns {Array} Processed data for DataTable
 */
const processTableData = (datosOrdenVenta) => {
   if (!datosOrdenVenta?.data?.sublists?.item) return [];

   return Object.entries(datosOrdenVenta.data.sublists.item)
      .filter(([key]) => key !== "currentline")
      .map(([key, linea], index) => ({
         numero:index + 1, // Use the index as the numero
         articulo: linea.item_display || linea.item,
         monto: formatoMoneda(linea.amount || 0),
         fechaPago: linea.custcolfecha_pago_proyectado || "No aplica",
         cantidad: linea.quantity,
         descripcion: linea.description,
      }));
};

/**
 * Custom hook for managing sales order actions
 * @param {Object} params - Parameters for action handlers
 * @returns {Object} Action handlers and configurations
 */
const useSalesOrderActions = ({ navigate, dispatch, datosOrdenVenta, setIsModalOpen, email_admin, validarOrdenVenta }) => {
   return {
      actions: {
         EnviarReserva: async () => {
            const idTrannsaccion = getQueryParam("data");
            const idTrannsaccion2 = getQueryParam("data2");

            const fecha_prereserva = datosOrdenVenta?.data?.fields?.custbody208;

            // Preguntar al usuario si está seguro de enviar el correo
            const result = await Swal.fire({
               title: "¿Está seguro?",
               text: "¿Desea enviar la reserva?",
               icon: "warning",
               showCancelButton: true,
               confirmButtonColor: "#3085d6",
               cancelButtonColor: "#d33",
               confirmButtonText: "Sí, enviar",
            });

            // Si el usuario confirma, solicitar el comentario de la caída
            if (result.isConfirmed) {
               showLoadingIndicator(); // Mostrar indicador de carga
               const result = await dispatch(enviarReservaN(idTrannsaccion2));

               let ExTraerResultado = result.data["Detalle"];
               if (ExTraerResultado.status === 200) {
                  await dispatch(bitacoraOrdenDeventa(idTrannsaccion));
                  await dispatch(modifcarOrdenVenta(idTrannsaccion2, fecha_prereserva));
                  //jacer un swal que sea wxito y luego hacer un reload de la pagina uando termine el swal despues de 2 segundos
                  Swal.fire("¡Enviado!", "La reserva ha sido enviada.", "success").then(() => {
                     setTimeout(() => {
                        window.location.reload();
                     }, 2000);
                  });
               } else {
                  Swal.fire("¡Error!", "La reserva no ha sido enviada.", "error");
               }
            }
            setTimeout(() => {
               Swal.close();
            }, 2000);
         },
         EnviarCierre: async () => {

            const idTrannsaccion = getQueryParam("data2");
            const idTrannsaccion2 = getQueryParam("data");

            const result = await Swal.fire({
               title: "¿Está seguro?",
               text: "¿Desea enviar el correo de CIERRE FIRMADO?",
               icon: "warning",
               showCancelButton: true,
               confirmButtonColor: "#3085d6",
               cancelButtonColor: "#d33",
               confirmButtonText: "Sí, enviar",
            });

            if (result.isConfirmed) {
               showLoadingIndicator(); // Mostrar indicador de carga
               await dispatch(enviarCierreFirmando(idTrannsaccion));
               await dispatch(modificarCierrreFirmandoThinks(idTrannsaccion));
               await dispatch(bitacoraOrdenDeventaCierre(idTrannsaccion2));

               Swal.fire("¡Enviado!", "El cierre firmado ha sido enviado.", "success").then(() => {
                  setTimeout(() => {
                     window.location.reload();
                  }, 2000);
               });
            }




         },
         EnviarReservaCaida: async () => {
            // Obtener el expediente y el id de la transacción
            const exp_correo = datosOrdenVenta?.Expediente;
            const idTrannsaccion = getQueryParam("data2");

            // Preguntar al usuario si está seguro de enviar el correo
            const result = await Swal.fire({
               title: "¿Está seguro?",
               text: "¿Desea enviar el correo de RESERVA CAIDA?",
               icon: "warning",
               showCancelButton: true,
               confirmButtonColor: "#3085d6",
               cancelButtonColor: "#d33",
               confirmButtonText: "Sí, enviar",
            });

            // Si el usuario confirma, solicitar el comentario de la caída
            if (result.isConfirmed) {
               const { value: formValues } = await Swal.fire({
                  width: "900px",
                  title: "Reserva Caida: " + exp_correo,
                  html:
                     '<label for="swal-textarea">Comentario de caida</label>' +
                     '<textarea id="swal-textarea" class="swal2-textarea" style="width: 100%; padding: 10px; box-sizing: border-box;"></textarea>',
                  focusConfirm: false,
                  preConfirm: () => {
                     // Obtener el valor del comentario
                     return document.getElementById("swal-textarea").value;
                  },
               });
               Swal.close();

               if (formValues) {
                  showLoadingIndicator(); // Mostrar indicador de carga

                  // Función que maneja el envío del correo
                  const mostrarMensaje = async () => {
                     Swal.close();
                     // Verificar si el usuario está en un dispositivo móvil
                     const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

                     if (isMobile) {
                        // En dispositivos móviles, mostrar un mensaje de advertencia
                        const respuesta = confirm(
                           "No se puede enviar la reserva caída desde un dispositivo móvil. Solo se puede enviar desde una computadora.\nPresiona 'Aceptar' para recordarlo más tarde.",
                        );
                        if (!respuesta) {
                           alert("Recuerda enviar el correo más tarde.");
                        }
                     } else {
                        // En una computadora, crear el enlace para abrir el cliente de correo
                        const destinatario = "abarrientos@roccacr.com";
                        const copia = email_admin;
                        const asunto = "Reserva Caida: " + exp_correo;
                        const cuerpo = formValues;
                        const mensajeCorreo = `Buen día compañeras,\n\nEspero que se encuentren bien. Les comento que la siguiente venta, ${exp_correo} ha sido cancelada debido a ${cuerpo}.\n\nSaludos cordiales,`;
                        const mailtoLink = `mailto:${destinatario}?cc=${copia}&subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(
                           mensajeCorreo,
                        )}`;
                        // Abrir el cliente de correo
                        window.location.href = mailtoLink;
                     }

                     // Confirmar si el correo fue enviado
                     const confirmacion = confirm(
                        "¿Has enviado el correo?\n\nHaz clic en 'Aceptar' si lo enviaste o en 'Cancelar' si aún no lo has enviado.",
                     );

                     if (confirmacion) {
                        // Si el correo fue enviado, ejecutar la acción
                        alert("Correo enviado y reserva caída con éxito. " + exp_correo);
                        dispatch(enviarReservaCaida(idTrannsaccion));
                        Swal.fire("¡Enviado!", "La reserva caída ha sido enviada.", "success").then(() => {
                           setTimeout(() => {
                              window.location.reload();
                           }, 2000);
                        });   
                     } else {
                        alert("Recuerda enviar el correo más tarde. " + exp_correo);
                     }

                     // Cerrar el modal después de 2 segundos
                     setTimeout(() => {
                        Swal.close();
                     }, 2000);
                  }

                  // Llamar a la función para mostrar el mensaje
                  await mostrarMensaje();
               }
            }
         },

         verPdf: () => {
            const goURL = `https://4552704.app.netsuite.com/app/accounting/print/hotprint.nl?regular=T&sethotprinter=T&formnumber=136&trantype=salesord&&id=${getQueryParam(
               "data2",
            )}&label=Orden+de+venta&printtype=transaction`;
            window.open(goURL, "PopupWindow", "width=900,height=800,scrollbars=yes");
         },
         verOportunidad: () => {
            navigate(`/oportunidad/ver?data=${getQueryParam("data")}&data2=${datosOrdenVenta?.data?.fields?.opportunity}&whence=`);
         },
         verEstimacion: () => {
            navigate(`/estimaciones/view?data=${getQueryParam("data")}&data2=${datosOrdenVenta?.data?.fields?.createdfrom}&whence=`);
         },
         editarOV: () => {
            setIsModalOpen(true);
         },
         aplicarComision: () => handleCommissionAction(dispatch, getQueryParam("data2")),
      },
      configs: {
         primary: [
            { icon: "ti-pencil", text: "EDITAR OV", action: "editarOV" },
            { icon: "ti-eye", text: "VER ESTIMACIÓN", action: "verEstimacion" },
            { icon: "ti-eye", text: "VER OPORTUNIDAD", action: "verOportunidad" },
            { icon: "ti-eye", text: "PDF OV", action: "verPdf" },
         ],
         secondary: [
            { icon: "ti-flag-3", text: "ENVIAR RESERVA", action: "EnviarReserva" , disabled: 
               validarOrdenVenta?.reserva_ov === 1 
               || !datosOrdenVenta?.data?.fields?.custbody207 
               || !datosOrdenVenta?.data?.fields?.custbody189
               || !datosOrdenVenta?.data?.fields?.custbody208
               || !datosOrdenVenta?.data?.fields?.custbody190
               || !datosOrdenVenta?.data?.fields?.custbody188

               ? true : false},   
            { icon: "ti-send", text: "CIERRE FIRMADO", action: "EnviarCierre", disabled: validarOrdenVenta?.reserva_ov !== 1 ? true : false},
            { icon: "ti-trending-down", text: "RESERVA CAÍDA", action: "EnviarReservaCaida", disabled: validarOrdenVenta?.caida_ov=== 1 ? true : false},
            { icon: "ti-brand-paypal", text: "APLICAR COMISIÓN", action: "aplicarComision" },   
         ],
      },
   };
};

/**
 * UI Components
 */

/**
 * Renders a button with an icon and text.
 * @param {Object} props - Component properties
 */
const ActionButton = ({ icon, text, onClick, disabled }) => {
   const isMobile = window.innerWidth <= 768;
   return (
      <div className={isMobile ? "col-12 mb-2" : "col-3"} hidden={disabled}> 
         <div className="d-grid">
            <button className="btn btn-dark" onClick={onClick} >
               <i className={`ti ${icon}`}></i> {text}
            </button>
         </div>
      </div>
   );
};

/**
 * Renders a panel of action buttons.  
 * @param {Object} props - Component properties
 */
const ActionPanel = ({ actions, buttonConfigs }) => (
   <div className="row">
      {buttonConfigs.map(({ icon, text, action, disabled }, index) => (
         
         <ActionButton key={index} icon={icon} text={text} onClick={() => actions[action](true)} disabled={disabled} /> 
      ))}
   </div>
);

/**
 * Renders an information field with icon and value.
 * @param {Object} props - Component properties
 */
const InfoField = ({ icon, label, value }) => (
   <div className="col-sm-4 col-6">
      <div className="mt-4">
         <h6 className="font-size-14">
            <i className={`ti ${icon}`}></i> {label}
         </h6>
         <p className="text-muted mb-0">{value}</p>
      </div>
   </div>
);

/**
 * Renders a card with a list of approval states.
 * @param {string} title - Title of the card.
 * @param {Array} labels - Array of labels for the approval states.
 */
const ApprovalCard = ({ title, approvals }) => (
   <div className="card">
      <div className="card-header">
         <h5>{title}</h5>
      </div>
      <div className="card-body">
         {approvals.map(({ label, checked }, index) => (
            <ApprovalCheckboxItem key={index} label={label} checked={checked} />
         ))}
      </div>
   </div>
);

/**
 * Renders a single approval checkbox item with a divider.
 * @param {Object} props - Component properties
 * @param {string} props.label - Checkbox label text
 * @returns {JSX.Element} A checkbox with label and horizontal line
 */
const ApprovalCheckboxItem = ({ label, checked }) => (
   <div>
      <div className="form-check">
         <input type="checkbox" id={label.toLowerCase().replace(/\s+/g, "")} className="form-check-input" disabled checked={checked} />
         <p>{label}</p>
      </div>
      <hr />
   </div>
);

/**
 * Calculates the progress percentage based on order validation fields
 * 
 * REQUISITOS DE VALIDACIÓN POR PASO:
 * 1. OV Creada = 10% - Siempre completado (requisito: OV creada)
 * 2. OV con Reserva = 20% - Requisito: reserva_ov === 1
 * 3. OV con Cierre Firmado = 30% - Requisito: cierre_firmado_ov === 1
 * 4. Aprobación Jefe Ventas = 50% (+20%) - Requisito: chekJefeVenta === 1
 * 5. Aprobación RDR = 70% (+20%) - Requisito: aprobacion__rdr_ov === 1
 * 6. Aprobación Formalizaciones = 80% - Requisito: aprobacion_forma_ov === 1 AND estado facturación pendiente
 * 7. Contrato Firmado = 100% - Requisito: contrado_frima_ov === 1
 * 
 * @param {Object} validarOrdenVenta - Order validation data
 * @param {Object} datosOrdenVenta - Order data for additional validations (facturación)
 * @returns {Object} Progress data with percentage and steps
 */
const calculateProgress = (validarOrdenVenta, datosOrdenVenta) => {
   if (!validarOrdenVenta) {
      return { percentage: 10, activeStep: 0, steps: [] };
   }

   // Verificar estado de facturación pendiente para Aprobación Formalizaciones
   // REQUISITO: Para que "Aprobación Formalizaciones" esté completa (80%), 
   // se requiere: aprobacion_forma_ov === 1 AND estado facturación pendiente
   // NOTA: Ajustar según el campo real disponible en datosOrdenVenta
   // Posibles campos a verificar:
   // - datosOrdenVenta?.data?.fields?.status
   // - datosOrdenVenta?.data?.fields?.billingstatus  
   // - datosOrdenVenta?.data?.fields?.custbody_estado_facturacion
   // - datosOrdenVenta?.data?.fields?.custbody_xxx (campo personalizado)
   const estadoFacturacionPendiente = 
      datosOrdenVenta?.data?.fields?.status === "Pending Billing" 
      || datosOrdenVenta?.data?.fields?.billingstatus === "Pending"
      || datosOrdenVenta?.data?.fields?.custbody_estado_facturacion === "Pendiente"
      || datosOrdenVenta?.data?.fields?.billingstatus === "Pending Billing"
      || false; // Si no se encuentra el campo, se considera como no pendiente

   const steps = [
      { 
         label: "OV Creada", 
         percentage: 10, 
         completed: true, // Siempre completado
         color: "#4caf50",
         requirement: "OV creada"
      },
      { 
         label: "OV con Reserva", 
         percentage: 20, 
         completed: validarOrdenVenta.reserva_ov === 1, 
         color: "#2196f3",
         requirement: "reserva_ov === 1"
      },
      { 
         label: "OV con Cierre Firmado", 
         percentage: 30, 
         completed: validarOrdenVenta.cierre_firmado_ov === 1, 
         color: "#ff9800",
         requirement: "cierre_firmado_ov === 1"
      },
      { 
         label: "Aprobación Jefe Ventas", 
         percentage: 50, 
         completed: validarOrdenVenta.chekJefeVenta === 1, 
         color: "#9c27b0",
         requirement: "chekJefeVenta === 1"
      },
      { 
         label: "Aprobación RDR", 
         percentage: 70, 
         completed: validarOrdenVenta.aprobacion__rdr_ov === 1, 
         color: "#f44336",
         requirement: "aprobacion__rdr_ov === 1"
      },
      { 
         label: "Aprobación Formalizaciones", 
         percentage: 80, 
         completed: validarOrdenVenta.aprobacion_forma_ov === 1 && estadoFacturacionPendiente, 
         color: "#00bcd4",
         requirement: "aprobacion_forma_ov === 1 && estado facturación pendiente"
      },
      { 
         label: "Contrato Firmado", 
         percentage: 100, 
         completed: validarOrdenVenta.contrado_frima_ov === 1, 
         color: "#4caf50",
         requirement: "contrado_frima_ov === 1"
      },
   ];

   let percentage = 10; // Siempre empieza con 10%
   let activeStep = 0;

   // Encontrar el último paso completado en secuencia (acumulativo)
   for (let i = 0; i < steps.length; i++) {
      // Verificar si este paso y todos los anteriores están completados
      let allCompleted = true;
      for (let j = 0; j <= i; j++) {
         if (!steps[j].completed) {
            allCompleted = false;
            break;
         }
      }
      
      if (allCompleted) {
         percentage = steps[i].percentage;
         activeStep = i;
      } else {
         break; // Si encontramos un paso no completado, detenemos
      }
   }

   return { percentage, activeStep, steps };
};

/**
 * Gets the color for the progress bar based on percentage
 * @param {number} percentage - Current progress percentage
 * @returns {string} Color hex code
 */
const getProgressColor = (percentage) => {
   if (percentage >= 100) return "#4caf50"; // Verde
   if (percentage >= 80) return "#00bcd4"; // Cyan
   if (percentage >= 70) return "#f44336"; // Rojo
   if (percentage >= 50) return "#9c27b0"; // Morado
   if (percentage >= 30) return "#ff9800"; // Naranja
   if (percentage >= 20) return "#2196f3"; // Azul
   return "#4caf50"; // Verde para el inicio
};

/**
 * Progress Component for Order Status
 * @param {Object} props - Component properties
 * @param {Object} props.validarOrdenVenta - Order validation data
 * @param {Object} props.datosOrdenVenta - Order data for additional validations
 * @param {boolean} props.isLoading - Loading state for animation
 */
// Animación sutil para el efecto de preload
const shimmer = keyframes`
  0% {
    opacity: 0.4;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 0.4;
  }
`;

// Pasos para la animación de carga (definidos fuera del componente para evitar recreación)
// Usando colores grises sutiles durante la carga
const loadingSteps = [
   { label: "OV Creada", percentage: 10, color: "#bdbdbd" },
   { label: "OV con Reserva", percentage: 20, color: "#bdbdbd" },
   { label: "OV con Cierre Firmado", percentage: 30, color: "#bdbdbd" },
   { label: "Aprobación Jefe Ventas", percentage: 50, color: "#bdbdbd" },
   { label: "Aprobación RDR", percentage: 70, color: "#bdbdbd" },
   { label: "Aprobación Formalizaciones", percentage: 80, color: "#bdbdbd" },
   { label: "Contrato Firmado", percentage: 100, color: "#bdbdbd" },
];

const OrderProgress = ({ validarOrdenVenta, datosOrdenVenta, isLoading = false }) => {
   const [loadingStep, setLoadingStep] = useState(0);
   const animationRef = useRef(null);

   // Animación de carga progresiva
   useEffect(() => {
      if (isLoading) {
         setLoadingStep(0);
         let currentStep = 0;
         
         const animate = () => {
            if (currentStep < loadingSteps.length) {
               setLoadingStep(currentStep);
               currentStep++;
               animationRef.current = setTimeout(animate, 400); // 400ms por paso
            }
         };
         
         animate();
      } else {
         if (animationRef.current) {
            clearTimeout(animationRef.current);
         }
      }

      return () => {
         if (animationRef.current) {
            clearTimeout(animationRef.current);
         }
      };
   }, [isLoading]);

   // Usar pasos de carga o datos reales
   const progressData = isLoading 
      ? { 
           percentage: loadingSteps[loadingStep]?.percentage || 10, 
           activeStep: loadingStep, 
           steps: loadingSteps.map((step, index) => ({
              ...step,
              completed: index <= loadingStep
           }))
        }
      : calculateProgress(validarOrdenVenta, datosOrdenVenta);
   
   const { percentage, activeStep, steps } = progressData;

   return (
      <Paper elevation={3} sx={{ p: 3, mt: 2, mb: 2 }}>
         <Typography variant="h6" gutterBottom sx={{ fontWeight: "bold", mb: 3 }}>
            Estado de la Orden de Venta
         </Typography>

         {/* Horizontal Timeline Steps */}
         <Box sx={{ position: "relative", width: "100%", overflowX: "auto", pb: 2 }}>
            <Box sx={{ 
               display: "flex", 
               alignItems: "flex-start", 
               position: "relative", 
               px: { xs: 1, md: 2 },
               justifyContent: "space-between",
               gap: { xs: 0.5, md: 0 },
            }}>
               {steps.map((step, index) => {
                  const isCompleted = step.completed;
                  const isActive = index === activeStep && isCompleted;
                  const isPast = index <= activeStep && isCompleted;
                  const nextStepCompleted = index < steps.length - 1 ? steps[index + 1].completed : false;
                  const shouldShowConnector = index < steps.length - 1;

                  return (
                     <Box
                        key={index}
                        sx={{
                           display: "flex",
                           flexDirection: "column",
                           alignItems: "center",
                           position: "relative",
                           flex: { xs: "0 0 auto", md: "1 1 0" },
                           minWidth: { xs: 85, sm: 100, md: "auto" },
                        }}
                     >
                        {/* Step Icon with Percentage */}
                        <Box
                           sx={{
                              width: { xs: 36, sm: 44, md: 48 },
                              height: { xs: 36, sm: 44, md: 48 },
                              borderRadius: "50%",
                              backgroundColor: isLoading 
                                 ? "#bdbdbd" 
                                 : (isCompleted ? step.color : "#e0e0e0"),
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              zIndex: 2,
                              border: isLoading 
                                 ? "none" 
                                 : (isActive ? `3px solid ${step.color}` : "none"),
                              boxShadow: isLoading 
                                 ? "none" 
                                 : (isCompleted ? `0 0 12px ${step.color}50` : "none"),
                              transition: "all 0.4s ease",
                              mb: 1,
                              position: "relative",
                              ...(isLoading && index === loadingStep && {
                                 animation: `${shimmer} 1.5s ease-in-out infinite`,
                                 opacity: 0.7,
                              }),
                              ...(isLoading && index < loadingStep && {
                                 opacity: 0.5,
                              }),
                              ...(isLoading && index > loadingStep && {
                                 opacity: 0.3,
                              }),
                           }}
                        >
                           <Typography
                              sx={{
                                 color: isLoading 
                                    ? "#757575" 
                                    : (isCompleted ? "white" : "#9e9e9e"),
                                 fontSize: { xs: "0.65rem", sm: "0.75rem", md: "0.85rem" },
                                 fontWeight: "bold",
                                 lineHeight: 1,
                              }}
                           >
                              {step.percentage}%
                           </Typography>
                        </Box>

                        {/* Step Label */}
                        <Box sx={{ textAlign: "center", width: "100%" }}>
                           <Typography
                              variant="caption"
                              sx={{
                                 fontWeight: isLoading 
                                    ? "normal" 
                                    : (isCompleted ? "bold" : "normal"),
                                 color: isLoading 
                                    ? "#9e9e9e" 
                                    : (isCompleted ? step.color : "#9e9e9e"),
                                 fontSize: { xs: "0.6rem", sm: "0.7rem", md: "0.75rem" },
                                 lineHeight: 1.2,
                                 display: "block",
                              }}
                           >
                              {step.label}
                           </Typography>
                        </Box>

                        {/* Horizontal Connector Line */}
                        {shouldShowConnector && (
                           <Box
                              sx={{
                                 position: "absolute",
                                 top: { xs: 18, sm: 22, md: 24 },
                                 left: { xs: "calc(50% + 18px)", sm: "calc(50% + 22px)", md: "calc(50% + 24px)" },
                                 right: { md: "calc(-50% + 24px)" },
                                 height: 3,
                                 backgroundColor: isCompleted 
                                    ? (nextStepCompleted ? steps[index + 1].color : step.color)
                                    : "#e0e0e0",
                                 zIndex: 1,
                                 transition: "all 0.4s ease",
                                 display: { xs: "none", md: "block" },
                                 ...(isLoading && index === loadingStep && {
                                    backgroundColor: "#d0d0d0",
                                    animation: `${shimmer} 1.5s ease-in-out infinite`,
                                    opacity: 0.6,
                                 }),
                                 ...(isLoading && index < loadingStep && {
                                    backgroundColor: "#c0c0c0",
                                    opacity: 0.4,
                                 }),
                                 ...(isLoading && index > loadingStep && {
                                    backgroundColor: "#e0e0e0",
                                    opacity: 0.3,
                                 }),
                              }}
                           />
                        )}
                     </Box>
                  );
               })}
            </Box>
         </Box>
      </Paper>
   );
};

/**
 * Information Section Components
 */

/**
 * Renders the primary information section.
 * @param {Object} props - Component properties
 */
const PrimaryInformation = ({ datosOrdenVenta }) => (
   <div className="row">
      <div className="alert alert-dark" role="alert">
         INFORMACIÓN PRIMARIA
      </div>
      <InfoField icon="ti-file-invoice" label="N.º DE PEDIDO" value={datosOrdenVenta?.data?.fields?.tranid || ""} />
      <InfoField icon="ti-calendar-time" label="FECHA" value={datosOrdenVenta?.data?.fields?.trandate || ""} />
      <InfoField icon="ti-blockquote" label="NOTA" value={datosOrdenVenta?.data?.fields?.memo || ""} />
   </div>
);

/**
 * Renders the sales information section.
 * @param {Object} datosOrdenVenta - Sales order data
 * @returns {JSX.Element} Sales information section
 */
const SalesInformation = ({ datosOrdenVenta }) => {

   const fields = [
      { label: "UNIDAD EXPEDIENTE LIGADO", value: datosOrdenVenta?.Expediente?.replace(/"/g, "") },
      { label: "PRECIO DE VENTA", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody_ix_total_amount) },
      { label: "ENTREGA ESTIMADA", value: datosOrdenVenta?.data?.fields?.custbody114 },
      { label: "MÉTODO DE PAGO", value: datosOrdenVenta?.METODO_PAGO?.replace(/"/g, "") },
      { label: "FONDOS DE COMPRA", value: datosOrdenVenta?.FONDOS?.replace(/"/g, "") },
      { label: "FECHA DE VIGENCIA DE LA VENTA", value: datosOrdenVenta?.data?.fields?.saleseffectivedate },
      { label: "CAMPAÑA DE MARKETING", value: datosOrdenVenta?.CAMPANA?.replace(/"/g, "") },
      { label: "CREADO", value: datosOrdenVenta?.data?.fields?.createddate },
      { label: "Clase", value: datosOrdenVenta?.Clase?.replace(/"/g, "")  },
      { label: "Departamento", value: datosOrdenVenta?.Departamento?.replace(/"/g, "") },
      { label: "FONDOS", value: datosOrdenVenta?.FONDOS?.replace(/"/g, "") },
      { label: "METODO PAGO", value: datosOrdenVenta?.METODO_PAGO?.replace(/"/g, "") },
      { label: "MOTIVO CANCE", value: datosOrdenVenta?.MOTIVO_CANCE?.replace(/"/g, "") },
      { label: "MOTIVO COMPRA", value: datosOrdenVenta?.MOTIVO_COMPRA?.replace(/"/g, "") },
      { label: "Oportunidad", value: datosOrdenVenta?.Oportunidad?.replace(/"/g, "") },
      { label: "Subsidaria", value: datosOrdenVenta?.Subsidaria?.replace(/"/g, "") },
      { label: "Ubi", value: datosOrdenVenta?.Ubi?.replace(/"/g, "") },
      { label: "REPRESENTANTE DE VENTAS", value: datosOrdenVenta?.vendedor?.replace(/"/g, "") },
      { label: "SOCIO", value: datosOrdenVenta?.socio?.replace(/"/g, "") },
      { label: "MOTI. DE CANCEL. DE RESER. O VENTA CAÍDA", value: datosOrdenVenta?.MOTIVO_CANCE?.replace(/"/g, "") },
      { label: "COMENTAR. CANCEL. DE RESERVA", value: datosOrdenVenta?.data?.fields?.custbody116 },
   ];

   return (
      <div className="row">
         <div className="alert alert-dark" role="alert">
            INFORMACIÓN DE VENTA
         </div>
         {fields.map(({ label, value }, index) => (
            <InfoField key={index} icon="ti-file-invoice" label={label} value={value ?? ""} />
         ))}
      </div>
   );
};

/**
 * Renders the sales information section.
 * @param {Object} datosOrdenVenta - Sales order data
 * @returns {JSX.Element} AUTORIZACION DE VENTA
 */
const AutorizacionVenta = ({ datosOrdenVenta }) => {
   const fields = [
      { label: "PRECIO DE LISTA", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody13) },
      { label: "MONTO DESCUENTO DIRECTO", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody132) },
      { label: "MONTO EXTRAS SOBRE EL PRECIO DE LISTA", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody46) },
      { label: "DESCRIPCIÓN DE EXTRAS SOBRE EL PRECIO DE LISTA", value: datosOrdenVenta?.data?.fields?.custbody47 },
      { label: "MONTO TOTAL DE CORTESÍAS", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody16) },
      { label: "DESCRIPCIÓN DE CORTESÍAS", value: datosOrdenVenta?.data?.fields?.custbody35 },
      { label: "PRIMA TOTAL", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody39) },
      { label: "MONTO RESERVA", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody52) },
      { label: "CASHBACK", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbodyix_salesorder_cashback) },
      { label: "% COMISIÓN DEL CORREDOR", value: datosOrdenVenta?.data?.fields?.custbody14 },
      { label: "PRECIO DE VENTA NETO", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody17) },
      { label: "PRECIO DE VENTA MÍNIMO", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody18) },
      { label: "COMISIÓN DEL ASESOR %", value: datosOrdenVenta?.data?.fields?.custbody20 },
      { label: "MONTO DE COMISIÓN DEL ASESOR", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody21) },
      { label: "PRECIO CÁLCULO COMISIÓN CORREDOR", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody22) },
      { label: "MONTO DE COMISIÓN SEGUNDO ASESOR", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody71) },
      { label: "MONTO DE COMISIÓN DE CORREDOR", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody15) },
      { label: "DIFERENCIA ENTRE EL PVN Y EL PVM", value: datosOrdenVenta?.data?.fields?.custbody19 },
   ];

   return (
      <div className="row">
         <div className="alert alert-dark" role="alert">
            AUTORIZACIÓN DE VENTA
         </div>
         {fields.map(({ label, value }, index) => (
            <InfoField key={index} icon="ti-file-invoice" label={label} value={value} />
         ))}
      </div>
   );
};

/**
 * Renders the sales information section.
 * @param {Object} datosOrdenVenta - Sales order data
 * @returns {JSX.Element} Sales information section
 */
const Reserva = ({ datosOrdenVenta }) => {
   const fields = [
      { label: "MEDIO DE PAGO", value: datosOrdenVenta?.METODO_PAGO?.replace(/"/g, "") },
      { label: "NÚMERO DE TRANSACCIÓN", value: datosOrdenVenta?.data?.fields?.custbody189 },
      { label: "MONTO RESERVA APLICADA", value: formatoMoneda(datosOrdenVenta?.data?.fields?.custbody207) },
      { label: "FECHA DE RESERVA APLICADA", value: datosOrdenVenta?.data?.fields?.custbody208 },
      { label: "MONTO PRE-RESERVA", value: datosOrdenVenta?.data?.fields?.custbody191 },
      { label: "FECHA DE PRE-RESERVA", value: datosOrdenVenta?.data?.fields?.custbody206 },
      { label: "OBSERVACIONES CONFIRMA RESERVA", value: datosOrdenVenta?.data?.fields?.custbody190 },
   ];

   return (
      <div className="row">
         <div className="alert alert-dark" role="alert">
            INFORMACIÓN DE RESERVA
         </div>
         {fields.map(({ label, value }, index) => (
            <InfoField key={index} icon="ti-file-invoice" label={label} value={value} />
         ))}
      </div>
   );
};

/**
 * DataTable Configuration
 */

/**
 * Initializes and configures the DataTable for displaying order items.
 * @param {Object} datosOrdenVenta - Sales order data
 * @returns {Object|null} DataTable instance
 */
const initializeDataTable = (datosOrdenVenta) => {
   if (!datosOrdenVenta?.data?.sublists?.item) return null;

   const tableData = Object.entries(datosOrdenVenta.data.sublists.item)
      .filter(([key]) => key !== "currentline")
      .map(([key, linea], index) => ({
         numero: index + 1, // Use the index as the numero
         articulo: linea.item_display || linea.item,
         monto: formatoMoneda(linea.rate || 0),
         fechaPago: linea.custcolfecha_pago_proyectado || "N/A",
         cantidad: linea.quantity,
         descripcion: linea.description,
      }));

   return $("#condicionesPrimaTable").DataTable({
      data: tableData,
      columns: [
         { data: "numero", title: "#" },
         { data: "articulo", title: "ARTÍCULO" },
         { data: "monto", title: "MONTO" },
         { data: "fechaPago", title: "FECHA DE PAGO PROYECTADO" },
         { data: "cantidad", title: "CANTIDAD" },
         { data: "descripcion", title: "DESCRIPCIÓN" },
      ],
      responsive: true,
      language: {
         decimal: "",
         emptyTable: "No hay información disponible",
         info: "Mostrando _START_ a _END_ de _TOTAL_ registros",
         infoEmpty: "Mostrando 0 a 0 de 0 registros",
         infoFiltered: "(filtrado de _MAX_ registros totales)",
         infoPostFix: "",
         thousands: ",",
         lengthMenu: "Mostrar _MENU_ registros",
         loadingRecords: "Cargando...",
         processing: "Procesando...",
         search: "Buscar:",
         zeroRecords: "No se encontraron registros coincidentes",
         paginate: {
            first: "Primero",
            last: "Último",
            next: "Siguiente",
            previous: "Anterior",
         },
         aria: {
            sortAscending: ": activar para ordenar la columna ascendente",
            sortDescending: ": activar para ordenar la columna descendente",
         },
      },
   });
};

/**
 * Main Component
 */

/**
 * Main component for displaying sales order information.
 * Manages data fetching, state, and renders all sub-components.
 * @returns {JSX.Element} Complete sales order view
 */
export const VistaOrdenVenta = () => {
   const navigate = useNavigate();
   const dispatch = useDispatch();
   const [leadDetails, setLeadDetails] = useState({});
   const [datosOrdenVenta, setDatosOrdenVenta] = useState({});
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [isLoading, setIsLoading] = useState(true);

   const [validarOrdenVenta, setValidarOrdenVenta] = useState({});

   const { email_admin } = useSelector((state) => state.auth);

   const { actions, configs } = useSalesOrderActions({
      navigate,
      dispatch,
      datosOrdenVenta,
      setIsModalOpen,
      email_admin,   
      validarOrdenVenta
   });

   // Initial data fetch
   useEffect(() => {
      const loadInitialData = async () => {
         setIsLoading(true);
         showLoadingIndicator();
         const leadId = getQueryParam("data");
         const transaccion = getQueryParam("data2");

         if (leadId && leadId > 0) {
            await fetchData({
               leadId,
               transaccion,
               dispatch,
               setLeadDetails,
               setDatosOrdenVenta,
               setValidarOrdenVenta
            });
         }
         Swal.close();
         // Esperar un poco para que se complete la animación antes de mostrar los datos reales
         setTimeout(() => {
            setIsLoading(false);
         }, 500);
      };

      loadInitialData();
   }, [dispatch]);

   // DataTable initialization with cleanup
   useEffect(() => {
      if (!datosOrdenVenta?.data?.sublists?.item) return;

      const table = $("#condicionesPrimaTable").DataTable({
         data: processTableData(datosOrdenVenta),
         columns: TABLE_CONFIG.columns,
         responsive: true,
         language: TABLE_CONFIG.language,
      });

      return () => table.destroy();
   }, [datosOrdenVenta]);

   return (
      <>
         {/* Sticky Notes Container */}
         <div style={{ position: 'relative', height: '0px', zIndex: 999 }}>
            <SticNotesContainer
               idinternoLead={leadDetails?.idinterno_lead}
               transactionType="ordersale"
               transactionId={getQueryParam("data2")}
            />
         </div>

         {/* Action Buttons Section */}
         <div className="col-xl-12 col-sm-12">
            <div className="card">
               <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                     <blockquote className="blockquote blockquote-reverse font-size-16 mb-0">
                        {Object.keys(leadDetails).length > 0 && <ButtonActions leadData={leadDetails} className="mb-4" />}
                     </blockquote>
                  </div>
                  <ActionPanel actions={actions} buttonConfigs={configs.primary}  />
                  <br />
                  <ActionPanel actions={actions} buttonConfigs={configs.secondary} />
               </div>
            </div>
         </div>

         {/* Main Content Section */}
         <div className="row">
            {/* Left Column - Order Information */}
            <div className="col-xl-9">
               <div className="card">
                  <div className="card-header">
                     <h5>Resumen de Información</h5>
                  </div>
                  <div className="card-header">
                     <h5>Cliente Relacioando: {datosOrdenVenta?.cli?.replace(/"/g, "") ?? ""}</h5>
                  </div>
                  <div className="card-body">
                     {/* Progress Component */}
                     <OrderProgress 
                        validarOrdenVenta={validarOrdenVenta} 
                        datosOrdenVenta={datosOrdenVenta} 
                        isLoading={isLoading}
                     />
                     
                     <PrimaryInformation datosOrdenVenta={datosOrdenVenta} />
                     <br />
                     <SalesInformation datosOrdenVenta={datosOrdenVenta} />
                     <br />
                     <AutorizacionVenta datosOrdenVenta={datosOrdenVenta} />
                     <br />
                     <Reserva datosOrdenVenta={datosOrdenVenta} />
                  </div>
               </div>
            </div>

            {/* Right Column - Approval Cards */}
            <div className="col-xl-3">
               <ApprovalCard
                  title="APROBACIONES ESTADOS"
                  approvals={[
                     { label: "CONTRATO FIRMADO", checked: datosOrdenVenta?.data?.fields?.custbody90 === "T" },
                     { label: "CIERRE FIRMADO", checked: datosOrdenVenta?.data?.fields?.custbody51 === "T" },
                     { label: "UNIDAD ENTREGADA", checked: datosOrdenVenta?.data?.fields?.custbody91 === "T" },
                     { label: "UNIDAD TRASPASADA", checked: datosOrdenVenta?.data?.fields?.custbody105 === "T" },
                     { label: "VENTA CAÍDA", checked: datosOrdenVenta?.data?.fields?.custbody43 === "T" },
                     { label: "COMISIÓN APROBADA", checked: datosOrdenVenta?.data?.fields?.custbody103 === "T" },
                     { label: "COMISIÓN CANCELADA", checked: datosOrdenVenta?.data?.fields?.custbody_ix_comision_pagada === "T" },
                  ]}
               />
               <ApprovalCard
                  title="APROBACIONES PAGOS"
                  approvals={[
                     { label: "NO PAGA TRASPASO S.A", checked: datosOrdenVenta?.data?.fields?.custbody141 === "T" },
                     { label: "NO PAGA CESIÓN DE ACCIONES", checked: datosOrdenVenta?.data?.fields?.custbody157 === "T" },
                  ]}
               />
               <ApprovalCard
                  title="APROBACIONES ESTADOS"
                  approvals={[
                     { label: "Aprobación Jefe de Ventas", checked: datosOrdenVenta?.data?.fields?.custbody_aprueba_jefe_ventas === "T" },
                     { label: "APROBACION FORMALIZACIÓN", checked: datosOrdenVenta?.data?.fields?.custbodyid_firma_rc === "T" },
                     { label: "APROBACION RDR", checked: datosOrdenVenta?.data?.fields?.custbodyid_firma_rocca === "T" },
                     { label: "CÁLCULO COMISIÓN ASESOR(AUTO)", checked: datosOrdenVenta?.data?.fields?.custbody74 === "T" },
                     { label: "CALCULO COMISIÓN CORREDOR(AUTO)", checked: datosOrdenVenta?.data?.fields?.custbody73 === "T" },
                  ]}
               />
            </div>
            
            <div className="card">
               <div className="card-header">
                  <h5>Resumen de Información</h5>
               </div>
               <div className="alert alert-danger" role="alert">
                  <h5 className="text-truncate font-size-15">CONDICIONES DE LA PRIMA</h5>
               </div>
               <div className="card-body">
                  <table id="condicionesPrimaTable" className="table table-striped table-bordered dt-responsive nowrap">
                     <thead>
                        <tr>
                           <th>#</th>
                           <th>ARTÍCULO</th>
                           <th>MONTO</th>
                           <th>FECHA DE PAGO PROYECTADO</th>
                           <th>CANTIDAD</th>
                           <th>DESCRIPCIÓN</th>
                        </tr>
                     </thead>
                  </table>
               </div>
               {isModalOpen && (
                  <ModalOrdenVenta open={isModalOpen} onClose={() => setIsModalOpen(false)} idEstimacion={getQueryParam("data2")} />
               )}
            </div>
            <OneDrive />
         </div>
      </>
   );
};
