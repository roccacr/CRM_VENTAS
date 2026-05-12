import React, { useEffect, useRef, useState } from "react";
import $ from "jquery";
import "datatables.net";
import "datatables.net-bs5";
import "datatables.net-searchpanes-bs5";
import "datatables.net-select-bs5";
import "../../FiltrosTabla/style.css";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { apiUrlImg, commonRequestData } from "../../../../api";
import { SEARCH_PANES_COLUMNS, TABLE_COLUMNS } from "./tableColumns";

const Header = () => (
    <div className="card-header table-card-header">
        <div role="alert" className="fade alert alert-success show">
            Usted está en la vista de clientes con cierre firmado
        </div>
    </div>
);

const DateControls = ({ inputStartDate, inputEndDate, setInputStartDate, setInputEndDate, onClearDates }) => (
    <div className="card-body border-top">
        <div className="row g-4">
            <div className="col-md-6">
                <div className="form-floating mb-0">
                    <input type="date" className="form-control" value={inputStartDate || ""} onChange={(e) => setInputStartDate(e.target.value)} />
                    <label htmlFor="startDate">Fecha de inicio de filtro</label>
                </div>
            </div>
            <div className="col-md-6">
                <div className="form-floating mb-0">
                    <input type="date" className="form-control" value={inputEndDate || ""} onChange={(e) => setInputEndDate(e.target.value)} />
                    <label htmlFor="endDate">Fecha de final de filtro</label>
                </div>
            </div>
        </div>
        <div className="row g-4 mt-3">
            <div className="col-md-6">
                <button
                    className="btn btn-outline-danger btn-sm"
                    type="button"
                    onClick={onClearDates}
                    aria-label="Limpiar filtro de fecha"
                    style={{ width: "auto", minWidth: "120px", padding: "0.25rem 0.75rem", fontSize: "0.9rem" }}
                >
                    Limpiar filtro de fecha
                </button>
            </div>
        </div>
    </div>
);

const TableStyles = () => (
    <style>
        {`
            .selected-row {
                background-color: rgb(20, 20, 20) !important;
                color: white !important;
            }
            .selected-row td {
                color: white !important;
            }
        `}
    </style>
);

const getDataTableConfig = (inputStartDate, inputEndDate, idnetsuite_admin, rol_admin) => {
    const isMobile = window.innerWidth <= 768;

    return {
        ajax: {
            url: `${apiUrlImg}ordenVenta/listarClientesCierreFirmado`,
            type: "POST",
            data: function () {
                return {
                    ...commonRequestData,
                    idnetsuite_admin,
                    startDate: inputStartDate,
                    endDate: inputEndDate,
                    rol_admin,
                };
            },
            dataSrc: (response) => response.data || [],
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
            columns: SEARCH_PANES_COLUMNS,
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
        stateDuration: -1,
        stateSaveCallback: function (settings, data) {
            localStorage.setItem("DataTables_clientesCierreFirmado_state", JSON.stringify(data));
        },
        stateLoadCallback: function () {
            return JSON.parse(localStorage.getItem("DataTables_clientesCierreFirmado_state")) || null;
        },
        select: {
            style: "single",
            className: "selected-row",
        },
        scrollX: true,
    };
};

const Lista_Clientes_Cierre_Firmado = () => {
    const tableRef = useRef(null);
    const tableInstanceRef = useRef(null);
    const navigate = useNavigate();
    const { idnetsuite_admin, rol_admin } = useSelector((state) => state.auth);

    const LS_START = "clientes_cierre_firmado_startDate";
    const LS_END = "clientes_cierre_firmado_endDate";

    const [inputStartDate, setInputStartDateState] = useState(() => localStorage.getItem(LS_START) || "");
    const [inputEndDate, setInputEndDateState] = useState(() => localStorage.getItem(LS_END) || "");

    const setInputStartDate = (value) => {
        setInputStartDateState(value);
        if (value) {
            localStorage.setItem(LS_START, value);
        } else {
            localStorage.removeItem(LS_START);
        }
    };

    const setInputEndDate = (value) => {
        setInputEndDateState(value);
        if (value) {
            localStorage.setItem(LS_END, value);
        } else {
            localStorage.removeItem(LS_END);
        }
    };

    const handleClearDates = () => {
        setInputStartDate("");
        setInputEndDate("");
    };

    useEffect(() => {
        if (!tableRef.current) return;

        if (tableInstanceRef.current) {
            $(tableRef.current).off("click", "tbody tr");
            tableInstanceRef.current.destroy();
            tableInstanceRef.current = null;
        }

        tableInstanceRef.current = $(tableRef.current).DataTable(
            getDataTableConfig(inputStartDate, inputEndDate, idnetsuite_admin, rol_admin),
        );

        $(tableRef.current).on("click", "tbody tr", function () {
            const data = tableInstanceRef.current.row(this).data();
            if (data?.idinterno_lead && data?.id_ov_netsuite) {
                navigate(`/orden/view?data=${data.idinterno_lead}&data2=${data.id_ov_netsuite}`);
            }
        });

        return () => {
            if (tableInstanceRef.current) {
                $(tableRef.current).off("click", "tbody tr");
                tableInstanceRef.current.destroy();
                tableInstanceRef.current = null;
            }
        };
    }, [inputStartDate, inputEndDate, idnetsuite_admin, rol_admin, navigate]);

    return (
        <div className="card" style={{ width: "100%" }}>
            <Header />
            <div className="table-border-style card-body">
                <DateControls
                    inputStartDate={inputStartDate}
                    inputEndDate={inputEndDate}
                    setInputStartDate={setInputStartDate}
                    setInputEndDate={setInputEndDate}
                    onClearDates={handleClearDates}
                />
                <div className="table-responsive">
                    <TableStyles />
                    <table ref={tableRef} className="table table-striped table-bordered">
                        <thead></thead>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Lista_Clientes_Cierre_Firmado;
