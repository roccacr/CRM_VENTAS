import "datatables.net";
import "datatables.net-bs5";
import "datatables.net-searchpanes-bs5";
import "datatables.net-select-bs5";
import $ from "jquery";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { commonRequestData, fetchData } from "../../../../api";
import "../../FiltrosTabla/style.css";

const DEFAULT_SAVED_SEARCH_ID = "3195";
const REPORT_STATE_KEY = "DataTables_state_reporte_comisiones";
const REPORT_COLUMN_ORDER = [
   "fecha",
   "ov",
   "nombre",
   "representante_de_ventas",
   "finca_filial",
   "ubicaci_n",
   "precio_de_lista",
   "precio_de_venta_neto",
   "total_ov",
   "monto_de_comisi_n_del_asesor",
   "comisi_n_cancelada",
];
const REPORT_FILTER_KEYS = [
   "ov",
   "representante_de_ventas",
   "finca_filial",
   "nombre",
];

const REPORT_VIEW_STYLES = `
.report-table-card .table-card-header {
   padding-bottom: 0;
}

.report-table-alert {
   margin-bottom: 0;
}

.report-table-shell {
   padding: 16px 20px 22px;
}

.report-filter-card {
   margin-bottom: 18px;
   padding: 18px;
   border: 1px solid #e5e7eb;
   border-radius: 18px;
   background: #fbfdff;
}

.report-filter-grid {
   display: grid;
   grid-template-columns: repeat(3, minmax(0, 1fr));
   gap: 14px;
   align-items: end;
}

.report-filter-actions {
   display: flex;
   justify-content: flex-start;
}

.report-filter-button {
   min-height: 46px;
   padding: 0 18px;
   border: 0;
   border-radius: 12px;
   background: #0f172a;
   color: #fff;
   font-size: 13px;
   font-weight: 700;
}

.report-filter-button:disabled {
   opacity: 0.7;
   cursor: not-allowed;
}

.report-table-meta {
   display: flex;
   flex-wrap: wrap;
   gap: 10px;
   margin-bottom: 16px;
}

.report-table-pill {
   display: inline-flex;
   align-items: center;
   min-height: 34px;
   padding: 0 14px;
   border: 1px solid #dbe3ee;
   border-radius: 999px;
   background: #f8fafc;
   color: #0f172a;
   font-size: 12px;
   font-weight: 600;
}

.report-table-responsive {
   overflow-x: auto;
}

.report-state-card {
   overflow: hidden;
   border: 1px solid #dbe3ee;
   border-radius: 20px;
   background:
      linear-gradient(135deg, rgba(15, 23, 42, 0.03), transparent 32%),
      linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
   box-shadow: 0 20px 42px rgba(15, 23, 42, 0.06);
}

.report-state-head {
   padding: 20px 22px 14px;
   border-bottom: 1px solid #edf2f7;
}

.report-state-kicker {
   display: inline-block;
   margin-bottom: 6px;
   font-size: 10px;
   font-weight: 700;
   letter-spacing: 0.08em;
   text-transform: uppercase;
   color: #64748b;
}

.report-state-title {
   margin: 0;
   font-size: 24px;
   font-weight: 700;
   color: #0f172a;
}

.report-state-copy {
   margin: 6px 0 0;
   color: #475569;
   font-size: 13px;
}

.report-state-body {
   padding: 20px 22px 24px;
}

.report-state-pills {
   display: flex;
   flex-wrap: wrap;
   gap: 10px;
   margin-bottom: 18px;
}

.report-state-pill {
   display: inline-flex;
   align-items: center;
   min-height: 34px;
   padding: 0 14px;
   border: 1px solid #dbe3ee;
   border-radius: 999px;
   background: #f8fafc;
   color: #0f172a;
   font-size: 12px;
   font-weight: 600;
}

.report-skeleton-grid {
   display: grid;
   gap: 12px;
}

.report-skeleton-line {
   position: relative;
   overflow: hidden;
   height: 16px;
   border-radius: 999px;
   background: #e9eef5;
}

.report-skeleton-line::after {
   content: "";
   position: absolute;
   inset: 0;
   transform: translateX(-100%);
   background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.78), transparent);
   animation: report-skeleton-shimmer 1.6s infinite;
}

.report-skeleton-line.is-wide {
   width: 100%;
}

.report-skeleton-line.is-medium {
   width: 78%;
}

.report-skeleton-line.is-short {
   width: 52%;
}

.report-state-error {
   border-color: #fecaca;
   background:
      linear-gradient(135deg, rgba(239, 68, 68, 0.06), transparent 34%),
      linear-gradient(180deg, #ffffff 0%, #fffafa 100%);
}

.report-state-error .report-state-title {
   color: #991b1b;
}

.report-state-error .report-state-copy {
   color: #7f1d1d;
}

@media (max-width: 768px) {
   .report-filter-grid {
      grid-template-columns: 1fr;
   }
}

@keyframes report-skeleton-shimmer {
   100% {
      transform: translateX(100%);
   }
}
`;

const Header = () => (
   <div className="card-header table-card-header">
      <div role="alert" className="fade alert alert-success show report-table-alert">
         Resultados TK- Ventas COMISIONES:
      </div>
   </div>
);

const TableContainer = ({ tableRef }) => (
   <div className="report-table-responsive">
      <table ref={tableRef} className="table table-striped table-bordered w-100">
         <thead></thead>
      </table>
   </div>
);

const LoadingState = () => (
   <div className="col-12">
      <style>{REPORT_VIEW_STYLES}</style>
      <div className="report-state-card">
         <div className="report-state-head">
            <span className="report-state-kicker">NetSuite</span>
            <h3 className="report-state-title">Resultados TK- Ventas COMISIONES</h3>
            <p className="report-state-copy">Estamos consultando la búsqueda guardada y preparando la tabla del reporte.</p>
         </div>
         <div className="report-state-body">
            <div className="report-state-pills">
               <span className="report-state-pill">Conectando reporte</span>
               <span className="report-state-pill">Cargando columnas</span>
               <span className="report-state-pill">Preparando filtros</span>
            </div>
            <div className="report-skeleton-grid">
               <div className="report-skeleton-line is-wide"></div>
               <div className="report-skeleton-line is-medium"></div>
               <div className="report-skeleton-line is-wide"></div>
               <div className="report-skeleton-line is-short"></div>
            </div>
         </div>
      </div>
   </div>
);

const ErrorState = ({ error }) => (
   <div className="col-12">
      <style>{REPORT_VIEW_STYLES}</style>
      <div className="report-state-card report-state-error">
         <div className="report-state-head">
            <span className="report-state-kicker">Reporte</span>
            <h3 className="report-state-title">No fue posible cargar el reporte</h3>
            <p className="report-state-copy">{error}</p>
         </div>
      </div>
   </div>
);

const DateFilters = ({
   inputStartDate,
   inputEndDate,
   setInputStartDate,
   setInputEndDate,
   onSubmit,
   isSubmitting,
}) => (
   <div className="report-filter-card">
      <div className="report-filter-grid">
         <div className="form-floating mb-0">
            <input
               type="date"
               className="form-control"
               value={inputStartDate}
               onChange={(event) => setInputStartDate(event.target.value)}
            />
            <label>Fecha inicio</label>
         </div>

         <div className="form-floating mb-0">
            <input
               type="date"
               className="form-control"
               value={inputEndDate}
               onChange={(event) => setInputEndDate(event.target.value)}
            />
            <label>Fecha fin</label>
         </div>

         <div className="report-filter-actions">
            <button
               type="button"
               className="report-filter-button"
               onClick={onSubmit}
               disabled={isSubmitting}
            >
               {isSubmitting ? "Consultando..." : "Consultar resultado"}
            </button>
         </div>
      </div>
   </div>
);

const renderCellValue = (value) => {
   if (value === null || value === undefined || value === "") {
      return "-";
   }

   if (typeof value === "boolean") {
      return value ? "Sí" : "No";
   }

   return value;
};

const sortReportColumns = (columns) => {
   const orderMap = new Map(REPORT_COLUMN_ORDER.map((key, index) => [key, index]));

   return [...columns].sort((currentColumn, nextColumn) => {
      const currentIndex = orderMap.has(currentColumn.key)
         ? orderMap.get(currentColumn.key)
         : Number.MAX_SAFE_INTEGER;
      const nextIndex = orderMap.has(nextColumn.key)
         ? orderMap.get(nextColumn.key)
         : Number.MAX_SAFE_INTEGER;

      if (currentIndex !== nextIndex) {
         return currentIndex - nextIndex;
      }

      return currentColumn.label.localeCompare(nextColumn.label);
   });
};

const buildTableColumns = (columns) =>
   columns.map((column) => ({
      title: column.label,
      data: column.key,
      defaultContent: "-",
      render: (value) => renderCellValue(value),
   }));

const getSearchPaneIndexes = (columns) =>
   columns.reduce((indexes, column, index) => {
      if (REPORT_FILTER_KEYS.includes(column.key)) {
         indexes.push(index);
      }

      return indexes;
   }, []);

const getDataTableConfig = (rows, columns) => {
   const isMobile = window.innerWidth <= 768;

   return {
      data: rows,
      columns: buildTableColumns(columns),
      processing: true,
      destroy: true,
      dom: "lPBfrtip",
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
         columns: getSearchPaneIndexes(columns),
      },
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
      stateDuration: -1,
      stateSaveCallback: function (settings, data) {
         localStorage.setItem(REPORT_STATE_KEY, JSON.stringify(data));
      },
      stateLoadCallback: function () {
         return JSON.parse(localStorage.getItem(REPORT_STATE_KEY)) || null;
      },
      select: {
         style: "single",
      },
   };
};

const useReportDataTable = (tableRef, tableInstanceRef, rows, columns) => {
   useEffect(() => {
      if (!tableRef.current || !columns.length) {
         return undefined;
      }

      if (tableInstanceRef.current) {
         tableInstanceRef.current.destroy();
         tableInstanceRef.current = null;
      }

      tableInstanceRef.current = $(tableRef.current).DataTable(
         getDataTableConfig(rows, columns)
      );

      return () => {
         if (tableInstanceRef.current) {
            tableInstanceRef.current.destroy();
            tableInstanceRef.current = null;
         }
      };
   }, [tableRef, tableInstanceRef, rows, columns]);
};

export const View_reporte_comisiones = () => {
   const tableRef = useRef(null);
   const tableInstanceRef = useRef(null);
   const [loading, setLoading] = useState(true);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [error, setError] = useState("");
   const [rows, setRows] = useState([]);
   const [columns, setColumns] = useState([]);
   const [searchId, setSearchId] = useState(DEFAULT_SAVED_SEARCH_ID);
   const [inputStartDate, setInputStartDate] = useState("");
   const [inputEndDate, setInputEndDate] = useState("");

   const summary = useMemo(
      () => ({
         totalRows: rows.length,
         totalColumns: columns.length,
      }),
      [rows.length, columns.length]
   );

   const obtenerReporte = async ({ dateFrom = "", dateTo = "", keepCurrentRows = false } = {}) => {
      if (keepCurrentRows) {
         setIsSubmitting(true);
      } else {
         setLoading(true);
      }

      setError("");

      const requestData = {
         ...commonRequestData,
         searchId: DEFAULT_SAVED_SEARCH_ID,
         dateFrom,
         dateTo,
      };

      const response = await fetchData("reporte/obtenerBusquedaGuardada", requestData);

      if (!response.ok) {
         setError(response.errorMessage || "No fue posible consultar la búsqueda guardada.");
         setLoading(false);
         setIsSubmitting(false);
         return;
      }

      const detalle = response.data?.Detalle || {};

      if (detalle.status !== 200) {
         setError(detalle?.Error?.message || "NetSuite no pudo cargar la búsqueda guardada.");
         setLoading(false);
         setIsSubmitting(false);
         return;
      }

      setSearchId(detalle.resolvedId || detalle.searchId || DEFAULT_SAVED_SEARCH_ID);
      setColumns(sortReportColumns(detalle.columns || []));
      setRows(detalle.rows || []);
      setLoading(false);
      setIsSubmitting(false);
   };

   useEffect(() => {
      obtenerReporte();
   }, []);

   useReportDataTable(tableRef, tableInstanceRef, rows, columns);

   if (loading) {
      return <LoadingState />;
   }

   if (error) {
      return <ErrorState error={error} />;
   }

   return (
      <div className="col-12">
         <style>{REPORT_VIEW_STYLES}</style>

         <div className="card report-table-card">
            <Header />

            <div className="report-table-shell">
               <DateFilters
                  inputStartDate={inputStartDate}
                  inputEndDate={inputEndDate}
                  setInputStartDate={setInputStartDate}
                  setInputEndDate={setInputEndDate}
                  onSubmit={() =>
                     obtenerReporte({
                        dateFrom: inputStartDate,
                        dateTo: inputEndDate,
                        keepCurrentRows: true,
                     })
                  }
                  isSubmitting={isSubmitting}
               />

               <div className="report-table-meta">
                  <span className="report-table-pill">Columnas: {summary.totalColumns}</span>
                  <span className="report-table-pill">Registros: {summary.totalRows}</span>
                  <span className="report-table-pill">Fuente NetSuite: {searchId}</span>
               </div>

               <TableContainer tableRef={tableRef} />
            </div>
         </div>
      </div>
   );
};
