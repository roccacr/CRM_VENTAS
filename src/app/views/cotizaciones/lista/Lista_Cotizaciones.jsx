import React, { useEffect, useRef, useState } from "react";
import $ from "jquery";
import "datatables.net";
import "datatables.net-bs5";
import "datatables.net-searchpanes-bs5";
import "datatables.net-select-bs5";
import "../../FiltrosTabla/style.css";
import { getDefaultDatesMeses } from "../../FiltrosTabla/dataTableConfig";
import { useDispatch, useSelector } from "react-redux";
import { apiUrlImg, commonRequestData } from "../../../../api";
import { ESTIMATE_PRE_RESERVE_COLUMNS, TABLE_COLUMNS } from "./tableColumns";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { AplicarComicion } from "../../../../store/ordenVenta/thunkOrdenVenta";
/**
 * Componente para el encabezado de la vista de leads
 * @returns {JSX.Element} Encabezado con mensaje informativo
 */
const Header = () => {
   const title = window.location.pathname === "/estimaciones/lista"
      ? "Usted esta en la vista de Estimaciones en Pre-Reserva"
      : "Usted esta en la vista de Cotizaciones";

   return (
      <div className="card-header table-card-header">
         <div role="alert" className="fade alert alert-success show">
            {title}
         </div>
      </div>
   );
};

/**
 * Componente para los controles de fecha
 * @param {Object} props - Propiedades del componente
 * @param {string} props.inputStartDate - Fecha inicial
 * @param {string} props.inputEndDate - Fecha final
 * @param {Function} props.setInputStartDate - Función para actualizar fecha inicial
 * @param {Function} props.setInputEndDate - Función para actualizar fecha final
 * @param {number} props.filterOption - Opción de filtrado actual
 * @returns {JSX.Element} Controles de fecha
 */
const DateControls = ({ inputStartDate, inputEndDate, setInputStartDate, setInputEndDate, filterOption }) => {
   // Determinar si los campos deben estar deshabilitados
   const isDisabled = filterOption === 1 || filterOption === 2;

   return (
      <div className="row g-4">
         <div className="col-md-6">
            <div className="form-floating mb-0">
               <input 
                  type="date" 
                  className="form-control" 
                  value={inputStartDate || ''} 
                  onChange={(e) => setInputStartDate(e.target.value)}
                  disabled={isDisabled}
               />
               <label htmlFor="startDate">Fecha de inicio de filtro</label>
            </div>
         </div>
         <div className="col-md-6">
            <div className="form-floating mb-0">
               <input 
                  type="date" 
                  className="form-control" 
                  value={inputEndDate || ''} 
                  onChange={(e) => setInputEndDate(e.target.value)}
                  disabled={isDisabled}
               />
               <label htmlFor="endDate">Fecha de final de filtro</label>
            </div>
         </div>
      </div>
   );
};

/**
 * Componente para los controles de filtrado
 * @param {Object} props - Propiedades del componente
 * @param {number} props.filterOption - Opción de filtrado actual
 * @param {Function} props.handleCheckboxChange - Manejador de cambio de filtro
 * @param {Function} props.onClearDates - Manejador para limpiar fechas
 * @returns {JSX.Element} Controles de filtrado
 */
const FilterControls = ({ filterOption, handleCheckboxChange, onClearDates }) => (
   <div className="row g-4 mt-3">
      <div className="col-md-6">
         <FilterOption
            id="creationDate"
            label="Ordenes de Venta con Pendientes"
            checked={filterOption === 1}
            onChange={() => handleCheckboxChange(1)}
         />
         <FilterOption
            id="lastActionDate"
            label="Ordenes de Venta lista para Cobrar"
            checked={filterOption === 2}
            onChange={() => handleCheckboxChange(2)}
         />
         <FilterOption
            id="pendingPayment"
            label="Comiciones Canceladas"
            checked={filterOption === 3}
            onChange={() => handleCheckboxChange(3)}
         />
         <FilterOption
            id="pendingPayment"
            label="Todos los contratos"
            checked={filterOption === 4}
            onChange={() => handleCheckboxChange(4)}
         />
         <button
            className="btn btn-outline-danger btn-sm mt-2"
            type="button"
            onClick={onClearDates}
            aria-label="Limpiar filtro de fecha"
            style={{ width: 'auto', minWidth: '120px', padding: '0.25rem 0.75rem', fontSize: '0.9rem' }}
         >
            Limpiar filtro de fecha
         </button>
      </div>
   </div>
);

/**
 * Componente para una opción individual de filtro
 * @param {Object} props - Propiedades del componente
 * @returns {JSX.Element} Opción de filtro
 */
const FilterOption = ({ id, label, checked, onChange }) => (
   <div className="form-check">
      <input className="form-check-input" type="checkbox" id={id} checked={checked} onChange={onChange} />
      <label className="form-check-label" htmlFor={id}>
         {label}
      </label>
   </div>
);

/**
 * Componente que renderiza la tabla de leads con estilos
 * @param {Object} props - Propiedades del componente
 * @returns {JSX.Element} Tabla con estilos
 */
const LeadsTable = ({ tableRef }) => (
   <div className="table-responsive">
      <TableStyles />
      <table ref={tableRef} className="table table-striped table-bordered">
         <thead></thead>
      </table>
   </div>
);

/**
 * Componente para los estilos de la tabla
 * @returns {JSX.Element} Estilos CSS
 */
const TableStyles = () => (
   <style>
      {`
         .selected-row {
            background-color:rgb(20, 20, 20) !important;
            color: white !important;
         }
         .selected-row td {
            color: white !important;
         }
      `}
   </style>
);

/**
 * Handles commission application logic.
 * @param {Function} dispatch - Redux dispatch function
 * @param {string|number} orderId - NetSuite order ID
 * @param {Object|null} rowApi - DataTables row API para eliminar la fila al completar la acción
 * @returns {Promise<void>}
 */
const handleCommissionAction = async (dispatch, orderId, rowApi = null) => {
   if (!orderId) {
      Swal.fire("Sin datos", "No se encontró el ID de la orden para aplicar comisión.", "warning");
      return;
   }

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
      await Swal.fire("¡Aplicada!", "La comisión ha sido aplicada.", "success");
      if (rowApi) {
         rowApi.remove().draw(false);
      }
   } else if (result.isDenied) {
      await dispatch(AplicarComicion(0, orderId));
      Swal.fire("¡Anulada!", "La comisión ha sido anulada.", "info");
   }
};

/**
 * Returns columns for DataTable, adding commission button only for /orden/lista?data=2.
 * @param {boolean} isCommissionView - Whether current URL is /orden/lista?data=2
 * @returns {Array<Object>}
 */
const getColumnsConfig = (isCommissionView, isEstimatesListRoute) => {
   if (isEstimatesListRoute) return ESTIMATE_PRE_RESERVE_COLUMNS;
   if (!isCommissionView) return TABLE_COLUMNS;

   return [
      {
         title: "ACCIONES",
         data: null,
         className: "text-center",
         orderable: false,
         searchable: false,
         render: () =>
            '<button type="button" class="btn btn-dark btn-sm apply-commission-btn"><i class="ti ti-brand-paypal"></i> APLICAR COMISIÓN</button>',
      },
      ...TABLE_COLUMNS,
   ];
};

/**
 * Obtiene la configuración completa para inicializar DataTables.
 * @param {HTMLElement} tableElement - Referencia al elemento DOM de la tabla
 * @param {string} inputStartDate - Fecha de inicio para filtrar los datos (formato YYYY-MM-DD)
 * @param {string} inputEndDate - Fecha final para filtrar los datos (formato YYYY-MM-DD)
 * @param {number} filterOption - Opción de filtrado seleccionada
 * @param {string|number} idnetsuite_admin - ID del administrador en NetSuite
 * @param {string} rol_admin - Rol del administrador
 * @returns {Object} Configuración completa de DataTables
 */
const getDataTableConfig = (tableElement, inputStartDate, inputEndDate, filterOption, orderStage, tableStateKey, idnetsuite_admin, rol_admin, isCommissionView, isEstimatesListRoute) => {
   /** @type {boolean} Determina si el dispositivo es móvil basado en el ancho de la ventana */
   const isMobile = window.innerWidth <= 768;
   return {
      ajax: {
         url: `${apiUrlImg}ordenVenta/listar`,
         type: "POST",
         data: function (d) {
            return {
               ...commonRequestData,
               idnetsuite_admin,
               startDate: inputStartDate,
               endDate: inputEndDate,
               filterOption,
               orderStage,
               rol_admin,
               start: d.start,
               length: d.length,
               search: d.searchPanes || undefined, // Evita undefined en la petición
            };
         },
         dataSrc: (response) => {
            return response.data || [];
         },
      },
      columns: getColumnsConfig(isCommissionView, isEstimatesListRoute),
      searchPanes: {
         layout: isMobile ? "columns-1" : "columns-2",
         initCollapsed: true,
         cascadePanes: true,
         dtOpts: {
            select: { style: "multi" },
            info: false,
            searching: true,
         },
         viewTotal: true,
         columns: isCommissionView ? [1, 2, 3, 4, 5, 6, 7] : isEstimatesListRoute ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [0, 1, 2, 3, 4, 5, 6],
      },
      processing: true,
      dom: "lPBfrtip",
      buttons: [
         {
            extend: "excel",
            text: "Exportar a Excel",
            className: "btn btn-primary",
         },
      ],
      language: {
         searchPanes: {
            title: "Filtros",
            collapse: "Filtros",
            clearMessage: "Limpiar Todo",
            emptyPanes: "No hay datos para filtrar",
            count: "{total}",
            countFiltered: "{shown} ({total})",
            loadMessage: "Cargando paneles de búsqueda...",
         },
      },
      stateSave: true,
      stateDuration: -1, // Mantiene el estado durante la sesión
      stateSaveCallback: function (settings, data) {
         localStorage.setItem(tableStateKey, JSON.stringify(data));
      },
      stateLoadCallback: function () {
         return JSON.parse(localStorage.getItem(tableStateKey)) || null;
      },
      select: {
         style: "single", // 'single' para selección única, 'multi' para múltiple
         className: "selected-row", // clase CSS que se aplicará a la fila seleccionada
      },
   };
};

/**
 * Hook personalizado para inicializar y gestionar DataTables.
 * @param {React.RefObject<HTMLTableElement>} tableRef - Referencia al elemento de tabla
 * @param {React.MutableRefObject<DataTable|null>} tableInstanceRef - Referencia de la instancia de DataTables
 * @param {string} inputStartDate - Fecha de inicio para filtrar datos
 * @param {string} inputEndDate - Fecha final para filtrar datos
 * @param {number} filterOption - Opción de filtrado seleccionada
 * @param {string|number} idnetsuite_admin - ID del administrador
 * @param {string} rol_admin - Rol del administrador
 * @param {Function} setSelectedLead - Función para establecer el lead seleccionado
 * @param {Function} setShowModal - Función para controlar la visibilidad del modal
 */
const useDataTable = (
   tableRef,
   tableInstanceRef,
   inputStartDate,
   inputEndDate,
   filterOption,
   orderStage,
   tableStateKey,
   idnetsuite_admin,
   rol_admin,
   setSelectedLead,
   setShowModal,
   isCommissionView,
   dispatch,
   isEstimatesListRoute,
) => {
   const navigate = useNavigate();
   useEffect(() => {
      if (!tableRef.current) return;
      if (tableInstanceRef.current) {
         tableInstanceRef.current.destroy();
         tableInstanceRef.current = null;
      }

      tableInstanceRef.current = $(tableRef.current).DataTable(
         getDataTableConfig(tableRef.current, inputStartDate, inputEndDate, filterOption, orderStage, tableStateKey, idnetsuite_admin, rol_admin, isCommissionView, isEstimatesListRoute),
      );

      if (isCommissionView) {
         $(tableRef.current).on("click", "button.apply-commission-btn", async function (event) {
            event.stopPropagation();
            const rowApi = tableInstanceRef.current.row($(this).closest("tr"));
            const rowData = rowApi.data();
            await handleCommissionAction(dispatch, rowData?.id_ov_netsuite, rowApi);
         });
      }

      // Modificar el manejador del clic
      $(tableRef.current).on("click", "tbody tr", function () {
         const data = tableInstanceRef.current.row(this).data();
         if (data) {
            if (isEstimatesListRoute) {
               navigate(`/estimaciones/view?data=${data.idinterno_lead}&data2=${data.idEstimacion_est}`);
               return;
            }

            if (data.id_ov_netsuite) {
               navigate(`/orden/view?data=${data.idinterno_lead}&data2=${data.id_ov_netsuite}`);
               return;
            }

            navigate(`/estimaciones/view?data=${data.idinterno_lead}&data2=${data.idEstimacion_est}`);
         }
      });

      return () => {
         if (tableInstanceRef.current) {
            $(tableRef.current).off("click", "button.apply-commission-btn");
            $(tableRef.current).off("click", "tbody tr");
            tableInstanceRef.current.destroy();
            tableInstanceRef.current = null;
         }
      };
   }, [tableRef, inputStartDate, inputEndDate, filterOption, orderStage, tableStateKey, idnetsuite_admin, rol_admin, setSelectedLead, setShowModal, isCommissionView, dispatch, navigate, isEstimatesListRoute]);
};

/**
 * Componente principal que gestiona la vista de leads que requieren atención.
 * Incluye funcionalidades de:
 * - Visualización de datos en tabla
 * - Filtrado por fechas
 * - Modal para detalles de leads
 * - Integración con DataTables
 *
 * @returns {JSX.Element} Contenedor principal con la tabla y modal
 */
const Lista_Cotizaciones = () => {
   /** Referencia a la tabla */
   const tableRef = useRef(null);

   /** Referencia a la instancia de DataTables */
   const tableInstanceRef = useRef(null);
   const dispatch = useDispatch();

   /** Fechas por defecto para el filtrado */
   const { firstDay, lastDay } = getDefaultDatesMeses();

   // --- FECHAS: Persistencia en localStorage ---
   const LS_START = 'cotizaciones_inputStartDate';
   const LS_END = 'cotizaciones_inputEndDate';

   // Leer fechas de localStorage al montar
   const [inputStartDate, setInputStartDateState] = useState(() => localStorage.getItem(LS_START) || firstDay);
   const [inputEndDate, setInputEndDateState] = useState(() => localStorage.getItem(LS_END) || lastDay);

   // Guardar en localStorage al cambiar
   const setInputStartDate = (val) => {
      setInputStartDateState(val);
      if (val) {
         localStorage.setItem(LS_START, val);
      } else {
         localStorage.removeItem(LS_START);
      }
   };
   const setInputEndDate = (val) => {
      setInputEndDateState(val);
      if (val) {
         localStorage.setItem(LS_END, val);
      } else {
         localStorage.removeItem(LS_END);
      }
   };

   // Botón limpiar fechas
   const handleClearDates = () => {
      setInputStartDate('');
      setInputEndDate('');
   };

   const params = new URLSearchParams(window.location.search);
   const dataParam = params.get("data");
   const isEstimatesListRoute = window.location.pathname === "/estimaciones/lista";
   const orderStage = dataParam === "pre-reserva" || dataParam === "reserva" ? dataParam : "";
   const tableStatePrefix = isEstimatesListRoute ? "estimaciones" : "ordenes";
   const tableStateVersion = isEstimatesListRoute ? "v2" : "v1";
   const tableStateKey = `DataTables_state_${tableStatePrefix}_${tableStateVersion}_${dataParam || "default"}`;

   /**  Estado para la opción de filtrado */
   const [filterOption, setFilterOption] = useState(() => {
      // Check for data=3 for pending payment orders, data=2 for all orders, default to 1 (paid orders)
      if (dataParam === "pre-reserva" || dataParam === "reserva") return 1;
      if (dataParam === "3") return 3;
      if (dataParam === "2") return 2;
      if (dataParam === "4") return 4;
      return 1;
   });

   /** Estado para controlar la visibilidad del modal */
   const [showModal, setShowModal] = useState(false);

   /**  Estado para almacenar el lead seleccionado */
   const [selectedLead, setSelectedLead] = useState(null);

   /** Datos del administrador desde Redux */
   const { idnetsuite_admin, rol_admin } = useSelector((state) => state.auth);
   const isCommissionView = (() => {
      const params = new URLSearchParams(window.location.search);
      const isRoleAllowed = Number(rol_admin) === 1;
      return window.location.pathname === "/orden/lista" && params.get("data") === "2" && isRoleAllowed;
   })();

   /**
    * Cierra el modal y limpia el lead seleccionado
    */
   const handleCloseModal = () => {
      setShowModal(false);
      setSelectedLead(null);
   };

   /**
    * Maneja el cambio entre las opciones de filtrado
    * @param {number} option - Opción seleccionada (1 o 2)
    */
   const handleCheckboxChange = (option) => {
      setFilterOption(option);
      // La tabla se actualizará automáticamente debido a la dependencia en useDataTable
   };

   useDataTable(
      tableRef,
      tableInstanceRef,
      inputStartDate,
      inputEndDate,
      filterOption,
      orderStage,
      tableStateKey,
      idnetsuite_admin,
      rol_admin,
      setSelectedLead,
      setShowModal,
      isCommissionView,
      dispatch,
      isEstimatesListRoute,
   );

   return (
      <div className="card" style={{ width: "100%" }}>
         <Header />
         <div className="table-border-style card-body">
            {/* Nuevo bloque de controles de filtro */}
            {!isEstimatesListRoute && (
               <div className="card-body border-top">
                  <DateControls
                     inputStartDate={inputStartDate}
                     inputEndDate={inputEndDate}
                     setInputStartDate={setInputStartDate}
                     setInputEndDate={setInputEndDate}
                     filterOption={filterOption}
                  />
                  <FilterControls filterOption={filterOption} handleCheckboxChange={handleCheckboxChange} onClearDates={handleClearDates} />
               </div>
            )}
            {/* Fin del bloque de controles de filtro */}
            <div className="table-responsive">
               <LeadsTable tableRef={tableRef} />
            </div>
         </div>
      </div>
   );
};

export default Lista_Cotizaciones;
