import { useEffect, useState } from "react";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import { useDispatch } from "react-redux";
import { getSpecificLead } from "../../../../store/leads/thunksLeads";
import {
   caidaReserva,
   crearBitacoraEstimacionCaida,
   enviarEstimacionComoPreReserva,
   extarerEstimacion,
   ModificarEstimacion,
} from "../../../../store/estimacion/thunkEstimacion";
import Swal from "sweetalert2";
import { cleanAndParseFloat } from "../../../../hook/useInputFormatter";
import { ModalEstimacionEdit } from "../ModalEstimacionEdit";
import $ from "jquery";
import "datatables.net";
import "datatables.net-bs5";
import "datatables.net-searchpanes-bs5";
import "datatables.net-select-bs5";
import { crearOrdenVenta } from "../../../../store/ordenVenta/thunkOrdenVenta";
import { useNavigate } from "react-router-dom";
/**
 * Componente principal para visualizar y gestionar estimaciones.
 * Permite ver detalles de estimaciones, convertirlas en pre-reservas,
 * y realizar diversas acciones relacionadas.
 *
 * @component
 * @returns {JSX.Element} Componente renderizado
 */
export const VerEstimacion = () => {
   const navigate = useNavigate();
   // Estado para almacenar los detalles del lead.
   const [leadDetails, setLeadDetails] = useState({});
   // Estado para almacenar los datos de la estimación.
   const [datosEstimacion, setDatosEstimacion] = useState({});

   const [totalOredenes, setTotalOredenes] = useState(0);


   const [datosCrm, setDatosCrm] = useState({});

   // Hook para despachar acciones de Redux.
   const dispatch = useDispatch();

   const [isModalOpen, setIsModalOpen] = useState(false); // Control del modal

   /**
    * Obtiene el valor de un parámetro específico de la URL.
    * @param {string} param - Nombre del parámetro a extraer.
    * @returns {string|number|null} - Retorna el valor del parámetro (convertido a número si es posible) o null si no existe.
    */
   const getQueryParam = (param) => {
      const value = new URLSearchParams(window.location.search).get(param);
      return value && !isNaN(value) && !isNaN(parseFloat(value)) ? Number(value) : value;
   };

   /**
    * Solicita los detalles de un lead desde el backend.
    * @param {number} idLead - ID del lead a buscar.
    */
   const fetchLeadDetails = async (idLead) => {
      try {
         const leadData = await dispatch(getSpecificLead(idLead));

         setLeadDetails(leadData);
      } catch (error) {
         console.error("Error al obtener los detalles del lead:", error);
      }
   };

   /**
    * Solicita los detalles de una estimación desde el backend.
    * @param {number} idEstimacion - ID de la estimación a buscar.
    */
   const fetchEstimacionDetails = async (idEstimacion) => {
      try {
         const estimacionData = await dispatch(extarerEstimacion(idEstimacion));

         setDatosEstimacion(estimacionData.netsuite.Detalle);
         setDatosCrm(estimacionData.crm);

   
         setTotalOredenes(estimacionData.totalOredenes.data);
      } catch (error) {
         console.error("Error al obtener los detalles de la estimación:", error);
      }
   };

   /**
    * Formatea un valor numérico a formato de moneda.
    *
    * @param {number} valor - Valor a formatear
    * @returns {string} Valor formateado como moneda
    */
   const formatoMoneda = (valor) => {
      return new Intl.NumberFormat("en-US", {
         minimumFractionDigits: 2,
         maximumFractionDigits: 5,
      }).format(valor);
   };

   /**
    * Calcula el precio de venta neto basado en varios parámetros.
    *
    * @param {number|string} custbody13 - Precio de lista
    * @param {number|string} custbody132 - Descuento directo
    * @param {number|string} custbody46 - Extras pagados por el cliente
    * @param {number|string} custbodyix_salesorder_cashback - Cashback
    * @param {number|string} custbody16 - Monto de cortesías
    * @returns {number} Precio de venta neto calculado
    */
   const CalculoPvtaNeto = (custbody13, custbody132, custbody46, custbodyix_salesorder_cashback, custbody16) => {
      const parseNumber = (value) => {
         if (typeof value === "string") {
            return parseFloat(value.replace(/[^0-9.-]/g, "")) || 0;
         }
         return Number(value) || 0;
      };
   
      // Convertir valores a números
      custbody13 = parseNumber(custbody13);
      custbody132 = parseNumber(custbody132);
      custbody46 = parseNumber(custbody46);
      custbodyix_salesorder_cashback = parseNumber(custbodyix_salesorder_cashback);
      custbody16 = parseNumber(custbody16);
   
      // Asegurar que la resta se haga correctamente
      return custbody13 - Math.abs(custbody132) + custbody46 - custbodyix_salesorder_cashback - custbody16;
   };

   /**
    * Configura y retorna las opciones de DataTables.
    *
    * @returns {Object} Configuración de DataTables
    */
   const getDataTableConfig = () => ({
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

   /**
    * Procesa los datos de la estimación para su visualización en la tabla.
    *
    * @param {Object} datosEstimacion - Datos crudos de la estimación
    * @returns {Array} Datos procesados listos para DataTables
    */
   const processTableData = (datosEstimacion) => {
      if (!datosEstimacion?.data?.sublists?.item) return [];

      return Object.entries(datosEstimacion.data.sublists.item)
         .filter(([key]) => key !== "currentline")
         .map(([key, linea], index) => ({
            numero:index + 1, // Use the index as the numero
            articulo: linea.item_display || linea.item,
            monto: formatoMoneda(linea.rate || 0),
            fechaPago: linea.custcolfecha_pago_proyectado || "N/A",
            cantidad: linea.quantity,
            descripcion: linea.description,
         }));
   };

   /**
    * Inicializa y configura la tabla de DataTables.
    */
   const initializeDataTable = () => {
      if (!datosEstimacion?.data?.sublists?.item) return;

      const tableConfig = {
         ...getDataTableConfig(),
         data: processTableData(datosEstimacion),
         columns: [
            { data: "numero", title: "#" },
            { data: "articulo", title: "ARTÍCULO" },
            { data: "monto", title: "MONTO" },
            { data: "fechaPago", title: "FECHA DE PAGO PROYECTADO" },
            { data: "cantidad", title: "CANTIDAD" },
            { data: "descripcion", title: "DESCRIPCIÓN" },
         ],
      };

      const table = $("#estimacionTable").DataTable(tableConfig);

      return () => table.destroy();
   };

   /**
    * Maneja la visualización del PDF de la estimación.
    */
   const vistaDePdf = () => {
      const estimacionId = getQueryParam("data2");
      window.open(
         `https://4552704.app.netsuite.com/app/accounting/print/hotprint.nl?regular=T&sethotprinter=T&formnumber=342&trantype=estimate&id=${estimacionId}`,
         "_blank",
      );
   };

   /**
    * Renderiza la sección de información del cliente y detalles básicos.
    *
    * @returns {JSX.Element} Sección de información básica
    */
   const renderBasicInfo = () => (
      <div className="row">
         <div className="col-md-2">
            <p className="mb-1 text-muted">
               <i className="fas fa-user"></i> CLIENTE:
            </p>
            <p className="mb-0">{datosEstimacion?.cli || ""}</p>
         </div>
         <div className="col-md-2">
            <p className="mb-1 text-muted">
               {" "}
               <i className="fas fa-archway"></i> UNIDAD EXPEDIENTE LIGADO VTA
            </p>
            <p className="mb-0">{datosEstimacion?.Exp || ""}</p>
         </div>
         <div className="col-md-2">
            <p className="mb-1 text-muted">
               {" "}
               <i className="fas fa-archway"></i> SUBSIDIARIA
            </p>
            <p className="mb-0">{datosEstimacion?.Subsidaria || ""}</p>
         </div>
         <div className="col-md-2">
            <p className="mb-1 text-muted">
               {" "}
               <i className="fas fa-certificate"></i> ESTADO
            </p>
            <p className="mb-0">{datosEstimacion?.Estado || ""}</p>
         </div>
         <div className="col-md-2">
            <p className="mb-1 text-muted">
               {" "}
               <i className="fas fa-chevron-circle-up"></i> OPORTUNIDAD
            </p>
            <p className="mb-0">{datosEstimacion?.opportunity_name || ""}</p>
         </div>
         <div className="col-md-2">
            <p className="mb-1 text-muted">
               {" "}
               <i className="fas fa-calendar-plus"></i> CIERRE DE PREVISTO
            </p>
            <p className="mb-0">{datosCrm?.caduca || ""}</p>
         </div>
      </div>
   );

   /**
    * Renderiza la sección de información financiera.
    *
    * @returns {JSX.Element} Sección de información financiera
    */
   const renderFinancialInfo = () => (
      <div className="row">
         <div className="col-md-2">
            <p className="mb-1 text-muted">
               <i className="fas fa-money-bill-wave"></i> PRECIO DE LISTA:
            </p>
            <p className="mb-0">{formatoMoneda(datosEstimacion?.data?.fields?.custbody13 || "")}</p>
         </div>
         <div className="col-md-2">
            <p className="mb-1 text-muted">
               {" "}
               <i className="fas fa-money-bill-wave"></i> MONTO DESCUENTO DIRECTO
            </p>
            <p className="mb-0">{formatoMoneda(datosEstimacion?.data?.fields?.custbody132 || "")}</p>
         </div>
         <div className="col-md-2">
            <p className="mb-1 text-muted">
               {" "}
               <i className="fas fa-money-bill-wave"></i> MONTO EXTRAS SOBRE EL PRECIO DE LISTA
            </p>
            <p className="mb-0">{formatoMoneda(datosEstimacion?.data?.fields?.custbody46 || "")}</p>
         </div>
         <div className="col-md-2">
            <p className="mb-1 text-muted">
               {" "}
               <i className="fas fa-list-ul"></i> DESCRIPCIÓN EXTRAS
            </p>
            <p className="mb-0">{datosEstimacion?.data?.fields?.custbody47 || "--"}</p>
         </div>
         <div className="col-md-2">
            <p className="mb-1 text-muted">
               {" "}
               <i className="fas fa-money-bill-wave"></i> CASHBACK
            </p>
            <p className="mb-0">{formatoMoneda(datosEstimacion?.data?.fields?.custbodyix_salesorder_cashback || "")}</p>
         </div>
         <div className="col-md-2">
            <p className="mb-1 text-muted">
               {" "}
               <i className="fas fa-money-bill-wave"></i> MONTO RESERVA
            </p>
            <p className="mb-0">{formatoMoneda(datosEstimacion?.data?.fields?.custbody52 || "")}</p>
         </div>
      </div>
   );

   // Effect hooks
   useEffect(() => {
      const loadInitialData = async () => {
         Swal.fire({
            title: "Cargando datos...",
            text: "Por favor espera.",
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => Swal.showLoading(),
         });

         const leadId = getQueryParam("data");
         const estimacionId = getQueryParam("data2");

         if (leadId && leadId > 0) {
            await Promise.all([fetchLeadDetails(leadId), fetchEstimacionDetails(estimacionId)]);
         }

         Swal.close();
      };

      loadInitialData();
   }, [dispatch]);

   useEffect(() => {
      return initializeDataTable();
   }, [datosEstimacion]);

   const [sortConfig, setSortConfig] = useState({
      column: null,
      direction: "asc", // 'asc' o 'desc'
   });

   const handleSort = (column) => {
      let direction = "asc";
      if (sortConfig.column === column && sortConfig.direction === "asc") {
         direction = "desc";
      }
      setSortConfig({ column, direction });
   };

   /**
    * Handles the process of sending an estimation as a pre-reservation.
    * This function prompts the user for confirmation, shows a loading indicator,
    * and dispatches an action to send the estimation as a pre-reservation.
    *
    * @async
    * @function EnviarReserva
    * @returns {Promise<void>} - A promise that resolves when the process is complete.
    * @throws Will log an error and show an alert if the process fails.
    */
   const EnviarReserva = async () => {

    
      try {
         // Prompt user for confirmation using SweetAlert
         const result = await Swal.fire({
            title: "¿Estás seguro?",
            text: "Esta acción enviará la estimación como una Pre-reserva.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#3085d6",
            cancelButtonColor: "#d33",
            confirmButtonText: "Sí, enviar Pre-reserva",
         });

         // Exit if the user cancels the action
         if (!result.isConfirmed) return;

         // Show loading indicator
         Swal.fire({
            title: "Enviando...",
            text: "Por favor, espere un momento.",
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => Swal.showLoading(),
         });

         // Retrieve necessary IDs from the URL
         const idEstimacion = getQueryParam("data2");
         const idCliente = getQueryParam("data");
         const fecha_prereserva = datosEstimacion?.data?.fields?.custbody206;

         // Dispatch action to send the estimation as a pre-reservation
         await dispatch(enviarEstimacionComoPreReserva(idEstimacion, idCliente, fecha_prereserva));

         // Close loading indicator and show success message
         Swal.close();
         Swal.fire("Enviado", "La estimación ha sido enviada como Pre-reserva.", "success");


         // hacer un swal alert que refresque la pagina despues de 3 segundos
         Swal.fire({
            title: "Refrescando...",
            text: "Por favor, espere un momento.",
            allowOutsideClick: false,
            allowEscapeKey: false,
         });
         setTimeout(() => {
            window.location.reload();
         }, 3000);
      } catch (error) {
         // Error handling: log error and show alert
         console.error("Error al enviar la estimación como Pre-reserva:", error);
         Swal.close();
         Swal.fire("Error", "Hubo un problema al enviar la estimación.", "error");
      }
   };

   /**
    * Función asincrónica para manejar el proceso de envío de una pre-reserva caída.
    *
    * 1. Solicita confirmación al usuario antes de proceder.
    * 2. Si el usuario confirma, solicita detalles adicionales como comentario y motivo.
    * 3. Valida que los datos requeridos hayan sido ingresados correctamente.
    * 4. Envía la solicitud de pre-reserva caída al servidor.
    * 5. Si el envío es exitoso, solicita confirmación para marcar al cliente como perdido.
    * 6. Registra la acción en la bitácora y modifica el estado de la estimación.
    */
   const EnviarTransaccionCaida = async () => {
      // Paso 1: Confirmación inicial
      const result = await Swal.fire({
         title: "¿Está seguro?",
         text: "¿Desea enviar la pre-reserva caída?",
         icon: "warning",
         showCancelButton: true,
         confirmButtonColor: "#3085d6",
         cancelButtonColor: "#d33",
         confirmButtonText: "Sí, enviar",
      });

      if (result.isConfirmed) {
         // Paso 2: Solicitud de datos adicionales
         const { value: formValues } = await Swal.fire({
            title: "Estimación Caída",
            html: `
               <label for="swal-input1">Comentario de caída</label>
               <input id="swal-input1" class="swal2-input" required>
               <label for="swal-select">Seleccione el motivo</label>
               <select id="swal-select" class="swal2-select" required>
                   <option value="">Escoger</option>
                   <option value="2">Inconformidad - Cambios en proyecto</option>
                   <option value="3">Inconformidad - Distribución</option>
                   <option value="1">Inconformidad - Fecha de entrega</option>
                   <option value="12">Incumplimiento contractual</option>
                   <option value="10">Mejor Oferta</option>
                   <option value="13">Motivo de empresa - Proyecto pospuesto</option>
                   <option value="9">Motivo Financiero - Condiciones bancarias</option>
                   <option value="8">Motivo Financiero - Venta de propiedad</option>
                   <option value="14">Motivo Laboral</option>
                   <option value="6">Motivo Personal - Económico</option>
                   <option value="5">Motivo Personal - Familiar</option>
                   <option value="4">Motivo Personal - Salud</option>
                   <option value="7">Motivo Personal - Sin Especificar</option>
                   <option value="11">No sujeto a crédito</option>
                   <option value="15">Traslado de FF/proyecto</option>
               </select>
           `,
            preConfirm: () => {
               const input1Value = document.getElementById("swal-input1").value;
               const selectValue = document.getElementById("swal-select").value;
               return [input1Value, selectValue];
            },
         });

         // Paso 3: Validación de entrada
         if (!formValues[0] || !formValues[1]) {
            Swal.fire("Error", "Debe ingresar un comentario y seleccionar un motivo para continuar.", "error");
            return;
         }

         // Paso 4: Mostrar mensaje de carga
         Swal.fire({
            title: "Enviando...",
            text: "Por favor, espere un momento.",
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => Swal.showLoading(),
         });

         // Obtención de parámetros necesarios
         const idEstimacion = getQueryParam("data2");
         const leadId = getQueryParam("data");
         const motivo = formValues[1];
         const comentario = formValues[0];

         // Paso 5: Envío de la pre-reserva caída
         const result = await dispatch(caidaReserva(idEstimacion, motivo, comentario));
         const xTraerResultado = result.data["Detalle"];

         if (xTraerResultado.status === 200) {
            // Paso 6: Confirmar si se debe marcar al cliente como perdido
            const result = await Swal.fire({
               title: "¿Quiere enviar como perdido este cliente?",
               text: "Al perder el cliente se perderán todas sus transacciones!",
               icon: "warning",
               showCancelButton: true,
               confirmButtonColor: "#3085d6",
               cancelButtonColor: "#d33",
               confirmButtonText: "Sí, perder",
            });

            let estadoValor = result.isConfirmed ? 1 : 0;

            // Paso 7: Registrar en bitácora y actualizar estimación
            await dispatch(crearBitacoraEstimacionCaida(leadId, comentario));
            await dispatch(ModificarEstimacion(idEstimacion, leadId, estadoValor));

            // Cerrar carga y mostrar éxito
            Swal.close();
            Swal.fire("Enviado", "La estimación ha sido enviada como Pre-reserva.", "success");
            Swal.fire({
               title: "Refrescando...",
               text: "Por favor, espere un momento.",
               allowOutsideClick: false,
               allowEscapeKey: false,
            });
            setTimeout(() => {
               window.location.reload();
            }, 3000);
         } else {
            Swal.fire("Algo no está bien.", "No se pudo hacer la pre reserva caída.", "question");
         }
      }
   };
   
   const crearOrdenVentas = async () => {
      const { isConfirmed } = await Swal.fire({
         title: "¿Está seguro?",
         text: "¿Desea crear la orden de venta?",
         icon: "warning",
         showCancelButton: true,
         confirmButtonColor: "#3085d6",
         cancelButtonColor: "#d33",
         confirmButtonText: "Sí, crear",
      });
   
      if (isConfirmed) {
         const idEstimacion = getQueryParam("data2");
         const leadId = getQueryParam("data");

         // Paso 4: Mostrar mensaje de carga
         Swal.fire({
            title: "Enviando...",
            text: "Por favor, espere un momento.",
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => Swal.showLoading(),
         });

         const resultado = await dispatch(crearOrdenVenta(idEstimacion, leadId));

         if(resultado.statusNormal !== 200){
            Swal.fire("Algo no está bien.", "No se pudo crear la orden de venta.", "question");
            return;
         }
         
         await Swal.fire({
            title: "¡Éxito!",
            text: "Orden de venta creada correctamente",
            icon: "success",
            timer: 3000,
            showConfirmButton: false
         });

         navigate(`/orden/view?data=${leadId}&data2=${resultado.data.id}`);
      }
   };
   
   const navigateToOrder = (orderId) => {
      const leadId = getQueryParam("data");

      navigate(`/orden/view?data=${leadId}&data2=${orderId[0].id_ov_netsuite}`);
   };

   return (
      <>
         <div className="col-xl-12 col-sm-12">
            <div className="card">
               <div className="card-body">
                  <div className="d-flex align-items-center justify-content-between mb-2">
                     <blockquote className="blockquote blockquote-reverse font-size-16 mb-0">
                        {Object.keys(leadDetails).length > 0 && <ButtonActions leadData={leadDetails} className="mb-4" />}
                     </blockquote>
                  </div>
                  <div className="row">
                     <div className="col-3" hidden={totalOredenes.length > 0}>
                        <div className="d-grid">
                           <button className="btn btn-dark" onClick={() => setIsModalOpen(true)}>
                              <i className="ti ti-pencil"></i> Editar estimacion
                           </button>
                        </div>
                     </div>
                     <div className="col-3" hidden={totalOredenes.length > 0}>
                        <div className="d-grid">
                           <button className="btn btn-dark" onClick={() => crearOrdenVentas()}>
                              <i className="ti ti-color-swatch"></i> ORDEN DE VENTA
                           </button>
                        </div>
                     </div>
                     {totalOredenes.length > 0 && (
                        <div className="col-3">
                           <div className="d-grid">
                              <button className="btn btn-dark" onClick={() => navigateToOrder(totalOredenes)}>
                                 <i className="ti ti-eye"></i> Ver Orden de Venta
                              </button>
                           </div>
                        </div>
                     )}
                     <div className="col-3">
                        <div className="d-grid">
                           <button className="btn btn-dark" onClick={() => vistaDePdf()}>
                              <i className="ti ti-ad-2"></i> PDF ESTIMACION
                           </button>
                        </div>
                     </div>
                  </div>
                  <br />
                  <div className="row">
                     <div className="col-3" hidden={
                        datosCrm?.pre_reserva === 1 || 
                        !datosEstimacion?.data?.fields?.custbody191 ||
                        !datosEstimacion?.data?.fields?.custbody189 ||
                        !datosEstimacion?.data?.fields?.custbody206 ||
                        !datosEstimacion?.data?.fields?.custbody190 ||
                        !datosEstimacion?.data?.fields?.custbody188
                     }>
                        <div className="d-grid">
                           <button className="btn btn-dark" onClick={() => EnviarReserva()}>
                              {" "}
                              <i className="ti ti-flag-3"></i> PRE - RESERVA
                           </button>
                        </div>
                     </div>
                     <div className="col-3" hidden={datosCrm?.pre_caida ===1 ? true : false }>
                        <div className="d-grid">
                           <button className="btn btn-dark" onClick={() => EnviarTransaccionCaida()}>
                              {" "}
                              <i className="ti ti-file-shredder"></i> ESTIMACION CAIDA
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
         <div className="card">
            <div className="card-header">
               <h5>Resumen de Información</h5>
            </div>
            <div className="alert alert-success" role="alert">
               <h5 className="text-truncate font-size-15">
                  ID ESTIMACION:
                  <p className="text-muted mb-0" id="train_id">
                     {datosCrm?.tranid_est || ""}
                  </p>
               </h5>
            </div>
            <div className="card-body">
               <ul className="list-group list-group-flush">
                  <li className="list-group-item px-0">{renderBasicInfo()}</li>
               </ul>
               <ul className="list-group list-group-flush">{renderFinancialInfo()}</ul>
               <ul className="list-group list-group-flush">
                  <li className="list-group-item px-0">
                     <div className="row">
                        <div className="col-md-2">
                           <p className="mb-1 text-muted">
                              <i className="fas fa-money-bill-wave"></i> MONTO TOTAL DE CORTESÍAS
                           </p>
                           <p className="mb-0">{formatoMoneda(datosEstimacion?.data?.fields?.custbody16 || "")}</p>
                        </div>
                        <div className="col-md-2">
                           <p className="mb-1 text-muted">
                              {" "}
                              <i className="fas fa-list-ul"></i> DESCRIPCIÓN DE LAS CORTESIAS
                           </p>
                           <p className="mb-0">{datosEstimacion?.data?.fields?.custbody35 || "--"}</p>
                        </div>
                        <div className="col-md-2">
                           <p className="mb-1 text-muted">
                              {" "}
                              <i className="fas fa-money-bill-wave"></i> PREC. DE VENTA MÍNIMO:
                           </p>
                           <p className="mb-0">{formatoMoneda(datosEstimacion?.data?.fields?.custbody18 || "")}</p>
                        </div>
                        <div className="col-md-2">
                           <p className="mb-1 text-muted">
                              {" "}
                              <i className="fas fa-money-bill-wave"></i> PEC. DE VENTA NETO:
                           </p>
                           <p className="mb-0">
                              {formatoMoneda(
                                 CalculoPvtaNeto(
                                    datosEstimacion?.data?.fields?.custbody13,
                                    datosEstimacion?.data?.fields?.custbody132,
                                    datosEstimacion?.data?.fields?.custbody46,
                                    datosEstimacion?.data?.fields?.custbodyix_salesorder_cashback,
                                    datosEstimacion?.data?.fields?.custbody16,
                                 ) || "",
                              )}
                           </p>
                        </div>
                        <div className="col-md-2" hidden>
                           <p className="mb-1 text-muted">
                              {" "}
                              <i className="fas fa-money-bill-wave"></i> EXTRAS SOBRE EL PRECIO DE LISTA
                           </p>
                           <p className="mb-0">{formatoMoneda(datosEstimacion?.data?.fields?.custbody185 || "")}</p>
                        </div>
                        <div className="col-md-2">
                           <p className="mb-1 text-muted">
                              {" "}
                              <i className="fas fa-money-bill-wave"></i> MONTO TOTAL
                           </p>
                           <p className="mb-0">{formatoMoneda(datosEstimacion?.data?.fields?.custbody_ix_total_amount || "")}</p>
                        </div>
                     </div>
                  </li>
               </ul>
            </div>
         </div>

         <div className="card">
            <div className="card-header">
               <h5>Resumen de Información</h5>
            </div>
            <div className="alert alert-dark" role="alert">
               <h5 className="text-truncate font-size-15">CONDICIONES DE LA PRIMA</h5>
            </div>
            <div className="card-body">
               <ul className="list-group list-group-flush">
                  <li className="list-group-item px-0">
                     <div className="row">
                        <div className="col-md-3">
                           <p className="mb-1 text-muted">
                              <i className="fas fa-money-bill-alt"></i> PRIMA TOTAL
                           </p>
                           <p className="mb-0">{formatoMoneda(datosEstimacion?.data?.fields?.custbody39 || "")}</p>
                        </div>
                        <div className="col-md-3">
                           <p className="mb-1 text-muted">
                              {" "}
                              <i className="fas fa-money-bill-alt"></i> PRIMA%
                           </p>
                           <p className="mb-0">{datosEstimacion?.data?.fields?.custbody60 || ""}%</p>
                        </div>
                        <div className="col-md-3">
                           <p className="mb-1 text-muted">
                              {" "}
                              <i className="fas fa-money-bill-alt"></i> MONTO PRIMA NETA
                           </p>
                           <p className="mb-0">{formatoMoneda(datosEstimacion?.data?.fields?.custbody_ix_salesorder_monto_prima || "")}</p>
                        </div>
                        <div className="col-md-3" hidden>
                           <p className="mb-1 text-muted">
                              {" "}
                              <i className="fas fa-money-bill-alt"></i> MONTO ASIGNABLE PRIMA NETA:
                           </p>
                           <p className="mb-0">{formatoMoneda(datosEstimacion?.data?.fields?.custbody211 || "")}</p>
                        </div>
                     </div>
                  </li>
               </ul>
            </div>
         </div>
         <div className="card">
            <div className="card-header">
               <h5>Resumen de Información</h5>
            </div>
            <div className="alert alert-danger" role="alert">
               <h5 className="text-truncate font-size-15">CONDICIONES DE LA PRIMA</h5>
            </div>
            <div className="card-body">
               <table id="estimacionTable" className="table table-striped table-bordered dt-responsive nowrap">
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
            {/* Modal */}
            {isModalOpen && (
               <ModalEstimacionEdit open={isModalOpen} onClose={() => setIsModalOpen(false)} idEstimacion={getQueryParam("data2")} />
            )}
         </div>
      </>
   );
};
