import { useEffect, useState } from "react";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import Swal from "sweetalert2";
import { useDispatch } from "react-redux";
import { getSpecificLead } from "../../../../store/leads/thunksLeads";
import { AplicarComicion, obtenerOrdendeventa } from "../../../../store/ordenVenta/thunkOrdenVenta";
import $ from "jquery";
import "datatables.net";
import "datatables.net-bs5";
import "datatables.net-searchpanes-bs5";
import "datatables.net-select-bs5";
import { useNavigate } from "react-router-dom";
import { ModalOrdenVenta } from "../../estimacion/ModalOrdenVenta";
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
 * @returns {Promise<void>}
 */
const fetchData = async ({ leadId, transaccion, dispatch, setLeadDetails, setDatosOrdenVenta }) => {
   try {
      const [leadData, ordenData] = await Promise.all([dispatch(getSpecificLead(leadId)), dispatch(obtenerOrdendeventa(transaccion))]);

      setLeadDetails(leadData);
      if (ordenData?.data?.Detalle) {
         setDatosOrdenVenta(ordenData.data.Detalle);
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
   ]
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
      cancelButtonText: "Cancelar"
   });
   

   if (result.isConfirmed) {
      await dispatch(AplicarComicion(1, orderId));
      Swal.fire('¡Aplicada!', 'La comisión ha sido aplicada.', 'success');
   } else if (result.isDenied) {
      await dispatch(AplicarComicion(0, orderId));
      Swal.fire('¡Anulada!', 'La comisión ha sido anulada.', 'info');
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
      .map(([key, linea]) => ({
         numero: linea.line || key.replace("line ", ""),
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
const useSalesOrderActions = ({ navigate, dispatch, datosOrdenVenta, setIsModalOpen }) => {
   return {
      actions: {
         EnviarReserva: () => {},
         EnviarCierre: () => {},
         EnviarReservaCaida: async () => {
            const exp_correo = datosOrdenVenta?.Expediente;  
            const idTrannsaccion = getQueryParam("data2");
            const result = await Swal.fire({
               title: '¿Está seguro?',
               text: "¿Desea enviar el correo de RESERVA CAIDA?",
               icon: 'warning',
               showCancelButton: true,
               confirmButtonColor: '#3085d6',
               cancelButtonColor: '#d33',
               confirmButtonText: 'Sí, enviar'
           });
           if (result.isConfirmed) {
               const { value: formValues } = await Swal.fire({
                  width: '900px',
                  title: 'Reserva Caida: ' + exp_correo,
                  html:
                     '<label for="swal-textarea">Comentario de caida</label>' +
                     '<textarea id="swal-textarea" class="swal2-textarea" style="width: 100%; padding: 10px; box-sizing: border-box;"></textarea>',
                  focusConfirm: false,
                  preConfirm: () => {
                     const textareaValue = document.getElementById('swal-textarea').value;
                     return textareaValue;
                  }
            });

            if (formValues) {
               showLoadingIndicator();
               async function mostrarMensaje() {
                  // Verificar si el usuario está en un dispositivo móvil (celular)
                  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

                  if (isMobile) {
                      // Si está en un dispositivo móvil, mostrar un cuadro de diálogo de confirmación personalizado
                      const respuesta = confirm(
                          "No se puede enviar la reserva caída desde un dispositivo móvil. Solo se puede enviar desde una computadora.\nPresiona 'Aceptar' para recordarlo más tarde."
                      );

                      if (!respuesta) {
                          alert("Recuerda enviar el correo más tarde.");
                      }
                     } else {

                     }

               }

               // Llamar a la función cuando sea apropiado, por ejemplo, al hacer clic en un botón.
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
            { icon: "ti-flag-3", text: "ENVIAR RESERVA", action: "EnviarReserva" },
            { icon: "ti-send", text: "CIERRE FIRMADO", action: "EnviarCierre" },
            { icon: "ti-trending-down", text: "RESERVA CAÍDA", action: "EnviarReservaCaida" },
            { icon: "ti-brand-paypal", text: "APLICAR COMICION", action: "aplicarComision" },
         ],
      }
   };
};

/**
 * UI Components
 */

/**
 * Renders a button with an icon and text.
 * @param {Object} props - Component properties
 */
const ActionButton = ({ icon, text, onClick }) => {
   const isMobile = window.innerWidth <= 768
   return (
      <div className={isMobile ? "col-12" : "col-3"}>
         <div className="d-grid">
            <button className="btn btn-dark" onClick={onClick}>
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
      {buttonConfigs.map(({ icon, text, action }, index) => (
         <ActionButton key={index} icon={icon} text={text} onClick={() => actions[action](true)} />
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
      { label: "Clase", value: datosOrdenVenta?.data?.fields?.class },
      { label: "Departamento", value: datosOrdenVenta?.Departamento?.replace(/"/g, "")  },
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
         numero:index + 1, // Use the index as the numero
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

   const { actions, configs } = useSalesOrderActions({ 
      navigate, 
      dispatch, 
      datosOrdenVenta ,
      setIsModalOpen
   });

   // Initial data fetch
   useEffect(() => {
      const loadInitialData = async () => {
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
            });
         }
         Swal.close();
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
         {/* Action Buttons Section */}
         <div className="col-xl-12 col-sm-12">
            <div className="card">
               <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                     <blockquote className="blockquote blockquote-reverse font-size-16 mb-0">
                        {Object.keys(leadDetails).length > 0 && <ButtonActions leadData={leadDetails} className="mb-4" />}
                     </blockquote>
                  </div>
                  <ActionPanel actions={actions} buttonConfigs={configs.primary} />
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
         </div>
      </>
   );
};
