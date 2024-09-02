import React, { useState } from "react";
import { useDataTable } from "./useDataTable";
import { columns } from "./columns";
import clientData from "./clientData.json";
import { ModalLeads } from "../../../pages/modal/modalLeads";

export const Views_list_leads = () => {
    const [showModal, setShowModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);

    useDataTable(clientData, columns, (data) => {
        setSelectedLead(data);
        setShowModal(true);
    });

    const handleCloseModal = () => setShowModal(false);

    return (
        <div className="card">
            <div className="card-header table-card-header">
                <h5>MODULO DE LEADS</h5>
            </div>
            <div className="card-body">
                <div className="dt-responsive table-responsive">
                    <div id="searchPanes" className="dtsp-panesContainer"></div>
                    <div id="basic-btn_wrapper" className="dt-container dt-bootstrap5">
                        <table id="single-select" className="table-bordered table dt-responsive w-100 display" style={{ fontSize: "15px", width: "100%" }}>
                            <thead>
                                <tr>
                                    {columns.map((column, index) => (
                                        <th key={index}>{column.title}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody />
                        </table>
                    </div>
                    {/* Modal para mostrar detalles del lead */}
                    {selectedLead && <ModalLeads leadData={selectedLead} onClose={handleCloseModal} />}
                </div>
            </div>
        </div>
    );
};
