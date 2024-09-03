// Views_list_leads.js
import React, { useState, useEffect } from "react";
import { columns } from "./columns";
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
    const [tableData, setTableData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);

    useEffect(() => {
        setIsLoading(true);
        if (idUrl === "2") {
            setTableData(leads);
        } else {
            // Aquí deberías cargar los datos de clientData.json
            // Por ejemplo:
            // import clientData from "./clientData.json";
            // setTableData(clientData);
        }
        setIsLoading(false);
    }, [idUrl, leads]);

    const handleRowClick = (data) => {
        setSelectedLead(data);
        setShowModal(true);
    };

    useDataTable(tableData, columns, handleRowClick);

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
                        {isLoading ? (
                            <div className="text-center">
                                <div className="spinner-border" role="status">
                                    <span className="sr-only">Cargando...</span>
                                </div>
                            </div>
                        ) : (
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
                        )}
                        {selectedLead && <ModalLeads leadData={selectedLead} onClose={handleCloseModal} />}
                    </div>
                </div>
            </div>
        </>
    );
};
