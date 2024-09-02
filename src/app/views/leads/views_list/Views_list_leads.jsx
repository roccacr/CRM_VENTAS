import React, { useEffect, useState } from "react";
import { columns } from "./columns";
import clientData from "./clientData.json";
import { ModalLeads } from "../../../pages/modal/modalLeads";
import { useDataTable } from "../../../../hook/useDataTable";
import { useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectAllNewLeads } from "../../../../store/Home/HomeSlice";

export const Views_list_leads = () => {
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const idUrl = searchParams.get("data");

    const leads = useSelector(selectAllNewLeads);

    // Estado para almacenar los datos que se mostrarán en la tabla
    const [tableData, setTableData] = useState([]);

    const [showModal, setShowModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);

    const handleRowClick = (data) => {
        setSelectedLead(data);
        setShowModal(true);
    };

    // Validación antes de llenar la tabla
    useEffect(() => {
        if (idUrl === "2") {
            setTableData(leads);
        } else {
            setTableData(clientData);
        }
    }, [idUrl, leads]);

    // Llama a useDataTable solo si tableData no está vacío
    useDataTable(tableData.length > 0 ? tableData : [], columns, handleRowClick);

    const handleCloseModal = () => {
        setShowModal(false);
        setTimeout(() => {
            setSelectedLead(null);
        }, 300);
    };

    return (
        <>
            <div className="card">
                <div className="card-header table-card-header">
                    <h5>MODULO DE LEADS</h5>
                </div>
                <div className="card-body">
                    <div className="dt-responsive table-responsive">
                        <table id="single-select" className="table table-striped table dt-responsive w-100 display" style={{ fontSize: "15px", width: "100%" }}>
                            <thead>
                                <tr>
                                    {columns.map((column, index) => (
                                        <th key={index}>{column.title}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody />
                        </table>
                        {/* Modal para mostrar detalles del lead */}
                        {selectedLead && <ModalLeads leadData={selectedLead} onClose={handleCloseModal} />}
                    </div>
                </div>
            </div>
        </>
    );
};
