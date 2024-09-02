import React, { useState } from "react";

import { columns } from "./columns";
import clientData from "./clientData.json";
import { ModalLeads } from "../../../pages/modal/modalLeads";
import { useDataTable } from "../../../../hook/useDataTable";

export const Views_list_leads = () => {
    const [showModal, setShowModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);

    const handleRowClick = (data) => {
        setSelectedLead(data);
        setShowModal(true);
    };

    useDataTable(clientData, columns, handleRowClick);

    const handleCloseModal = () => {
        setShowModal(false);
        // Restablecer selectedLead después de un pequeño retraso para permitir que el modal se cierre correctamente
        setTimeout(() => {
            setSelectedLead(null);
        }, 300); // Ajusta el tiempo si es necesario
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

