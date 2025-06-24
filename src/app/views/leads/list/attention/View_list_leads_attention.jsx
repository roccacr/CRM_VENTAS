import "datatables.net";
import "datatables.net-bs5";
import "datatables.net-searchpanes-bs5";
import "datatables.net-select-bs5";
import $ from "jquery";
import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { apiUrlImg, commonRequestData } from "../../../../../api";
import { ModalLeads } from "../../../../pages/modal/modalLeads";
import "../../../FiltrosTabla/style.css";
import { TABLE_COLUMNS } from "./tableColumns";

/**
 * Componente para el encabezado de la vista de leads
 * @returns {JSX.Element} Encabezado con mensaje informativo
 */
const Header = () => (
   <div className="card-header table-card-header">
      <div role="alert" className="fade alert alert-success show">
         Usted está en la vista de leads que requieren atención
      </div>
   </div>
);

/**
 * Componente para los controles de fecha
 * @param {Object} props - Propiedades del componente
 * @param {string} props.inputStartDate - Fecha inicial
 * @param {string} props.inputEndDate - Fecha final
 * @param {Function} props.setInputStartDate - Función para actualizar fecha inicial
 * @param {Function} props.setInputEndDate - Función para actualizar fecha final
 * @returns {JSX.Element} Controles de fecha
 */
const DateControls = ({ inputStartDate, inputEndDate, setInputStartDate, setInputEndDate }) => (
   <div className="row g-4">
      <div className="col-md-6">
         <div className="form-floating mb-0">
            <input type="date" className="form-control" value={inputStartDate} onChange={(e) => setInputStartDate(e.target.value)} />
            <label htmlFor="startDate">Fecha de inicio de filtro</label>
         </div>
      </div>
      <div className="col-md-6">
         <div className="form-floating mb-0">
            <input type="date" className="form-control" value={inputEndDate} onChange={(e) => setInputEndDate(e.target.value)} />
            <label htmlFor="endDate">Fecha de final de filtro</label>
         </div>
      </div>
   </div>
);

/**
 * Componente para los controles de filtrado
 * @param {Object} props - Propiedades del componente
 * @param {number} props.filterOption - Opción de filtrado actual
 * @param {Function} props.handleCheckboxChange - Manejador de cambio de filtro
 * @returns {JSX.Element} Controles de filtrado
 */
const FilterControls = ({ filterOption, handleCheckboxChange }) => {
   /**
    * Función para limpiar las fechas almacenadas en localStorage y refrescar la página
    */
   const handleClearDates = () => {
      localStorage.removeItem("inputStartDate");
      localStorage.removeItem("inputEndDate");
      window.location.reload(); // Refrescar la página
   };

   return (
      <div className="row g-4 mt-3">
         <div className="col-md-6">
            <FilterOption
               id="creationDate"
               label="Filtrar por Fecha de Creación"
               checked={filterOption === 1}
               onChange={() => handleCheckboxChange(1)}
            />
            <FilterOption
               id="lastActionDate"
               label="Filtrar por Última Acción"
               checked={filterOption === 2}
               onChange={() => handleCheckboxChange(2)}
            />

            {/* Botón para limpiar fechas y refrescar */}
            <div className="mt-3">
               <button
                  className="btn btn-danger btn-sm"
                  onClick={handleClearDates}
                  title="Elimina las fechas guardadas y restablece a los valores predeterminados"
               >
                  <i className="feather icon-trash-2 mr-1"></i> Restablecer fechas por defecto
               </button>
            </div>
         </div>
      </div>
   );
};

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
 * Obtiene la configuración completa para inicializar DataTables.
 * @param {HTMLElement} tableElement - Referencia al elemento DOM de la tabla
 * @param {string} inputStartDate - Fecha de inicio para filtrar los datos (formato YYYY-MM-DD)
 * @param {string} inputEndDate - Fecha final para filtrar los datos (formato YYYY-MM-DD)
 * @param {number} filterOption - Opción de filtrado seleccionada
 * @param {string|number} idnetsuite_admin - ID del administrador en NetSuite
 * @param {string} rol_admin - Rol del administrador
 * @returns {Object} Configuración completa de DataTables
 */
const getDataTableConfig = (tableElement, inputStartDate, inputEndDate, filterOption, idnetsuite_admin, rol_admin) => {
   /** @type {boolean} Determina si el dispositivo es móvil basado en el ancho de la ventana */
   const isMobile = window.innerWidth <= 768;
   return {
      ajax: {
         url: `${apiUrlImg}leads/getAll_LeadsAttention`,
         type: "POST",
         data: function (d) {
            return {
               ...commonRequestData,
               idnetsuite_admin,
               startDate: inputStartDate,
               endDate: inputEndDate,
               filterOption,
               rol_admin,
               start: d.start,
               length: d.length,
               search: d.searchPanes || undefined, // Evita undefined en la petición
            };
         },
         dataSrc: (response) => response["0"] || [],
      },
      columns: TABLE_COLUMNS,
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
         columns: [0, 1, 3, 4, 5, 6, 11, 12],
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
         localStorage.setItem("DataTables_state", JSON.stringify(data));
      },
      stateLoadCallback: function () {
         return JSON.parse(localStorage.getItem("DataTables_state")) || null;
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
   idnetsuite_admin,
   rol_admin,
   setSelectedLead,
   setShowModal,
) => {
   useEffect(() => {
      if (!tableRef.current) return;
      if (tableInstanceRef.current) {
         tableInstanceRef.current.destroy();
         tableInstanceRef.current = null;
      }

      tableInstanceRef.current = $(tableRef.current).DataTable(
         getDataTableConfig(tableRef.current, inputStartDate, inputEndDate, filterOption, idnetsuite_admin, rol_admin),
      );

      // Modificar el manejador del clic
      $(tableRef.current).on("click", "tbody tr", function () {
         const data = tableInstanceRef.current.row(this).data();
         if (data) {
            setSelectedLead(data); // Guardar todos los datos en selectedLead
            setShowModal(true); // Abrir el modal
         }
      });

      return () => {
         if (tableInstanceRef.current) {
            $(tableRef.current).off("click", "tbody tr");
            tableInstanceRef.current.destroy();
            tableInstanceRef.current = null;
         }
      };
   }, [tableRef, inputStartDate, inputEndDate, filterOption, idnetsuite_admin, rol_admin, setSelectedLead, setShowModal]);
};

/**
 * Calcula las fechas predeterminadas para los filtros de la tabla
 * @returns {Object} Objeto con firstDay (hace un año de la fecha actual) y lastDay (un año después de la fecha actual)
 */
export const getDefaultDates = () => {
   const now = new Date();

   // Fecha de un año antes (mismo día y mes, año anterior)
   const oneYearAgo = new Date(now);
   oneYearAgo.setFullYear(now.getFullYear() - 1);

   // Fecha de un año después (mismo día y mes, año siguiente)
   const oneYearLater = new Date(now);
   oneYearLater.setFullYear(now.getFullYear() + 1);

   // Formatear las fechas como YYYY-MM-DD
   const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
   };

   return {
      firstDay: formatDate(oneYearAgo),   // Fecha hace un año
      lastDay: formatDate(oneYearLater)   // Fecha dentro de un año
   };
};

/**
 * Componente principal que gestiona la vista de leads que requieren atención.
 * Incluye funcionalidades de:
 * - Visualización de datos en tabla
 * - Filtrado por fechas (automáticamente establecido desde un año atrás hasta un año adelante)
 * - Modal para detalles de leads
 * - Integración con DataTables
 *
 * @returns {JSX.Element} Contenedor principal con la tabla y modal
 */
const View_list_leads_attention = () => {
   /** Referencia a la tabla */
   const tableRef = useRef(null);

   /** Referencia a la instancia de DataTables */
   const tableInstanceRef = useRef(null);

   /** 
    * Fechas por defecto para el filtrado
    * Se recalculan en cada renderizado para mantener sincronizado con la fecha actual 
    */
   const { firstDay, lastDay } = getDefaultDates();

   // Actualizar fechas desde localStorage solo si existen, de lo contrario usar las calculadas
   const [inputStartDate, setInputStartDate] = useState(() => {
      const storedStartDate = localStorage.getItem("inputStartDate");
      return storedStartDate || firstDay;
   });

   const [inputEndDate, setInputEndDate] = useState(() => {
      const storedEndDate = localStorage.getItem("inputEndDate");
      return storedEndDate || lastDay;
   });

   // Actualizar las fechas cada vez que cambie la fecha actual (a medianoche)
   useEffect(() => {
      const updateDatesAtMidnight = () => {
         const { firstDay, lastDay } = getDefaultDates();
         setInputStartDate(firstDay);
         setInputEndDate(lastDay);
      };

      // Calcular milisegundos hasta la próxima medianoche
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const timeUntilMidnight = tomorrow.getTime() - now.getTime();

      // Configurar temporizador para actualizar fechas a medianoche
      const midnightTimer = setTimeout(updateDatesAtMidnight, timeUntilMidnight);

      return () => clearTimeout(midnightTimer);
   }, []);

   // Guardar fechas en localStorage cuando cambien
   useEffect(() => {
      localStorage.setItem("inputStartDate", inputStartDate);
   }, [inputStartDate]);

   useEffect(() => {
      localStorage.setItem("inputEndDate", inputEndDate);
   }, [inputEndDate]);

   /**  Estado para la opción de filtrado */
   const [filterOption, setFilterOption] = useState(1);

   /** Estado para controlar la visibilidad del modal */
   const [showModal, setShowModal] = useState(false);

   /**  Estado para almacenar el lead seleccionado */
   const [selectedLead, setSelectedLead] = useState(null);

   /** Datos del administrador desde Redux */
   const { idnetsuite_admin, rol_admin } = useSelector((state) => state.auth);

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
      idnetsuite_admin,
      rol_admin,
      setSelectedLead,
      setShowModal,
   );

   return (
      <div className="card" style={{ width: "100%" }}>
         <Header />
         <div className="table-border-style card-body">
            {/* Nuevo bloque de controles de filtro */}
            <div className="card-body border-top">
               <DateControls
                  inputStartDate={inputStartDate}
                  inputEndDate={inputEndDate}
                  setInputStartDate={setInputStartDate}
                  setInputEndDate={setInputEndDate}
               />
               <FilterControls filterOption={filterOption} handleCheckboxChange={handleCheckboxChange} />
            </div>
            {/* Fin del bloque de controles de filtro */}
            <div className="table-responsive">
               <LeadsTable tableRef={tableRef} />
               {showModal && selectedLead && <ModalLeads leadData={selectedLead} onClose={handleCloseModal} />}
            </div>
         </div>
      </div>
   );
};

export default View_list_leads_attention;
