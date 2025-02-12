import { React, useRef, useEffect, DataTable, useTableOptions, DT } from "../Imports/imports";
import { useTableData } from "./useTableData";
import { tableColumns } from "./tableColumns";
import "../Imports/style.css";
import { ModalLeads } from "../../../../pages/modal/modalLeads";
import { useState } from "react";

// Initialize DataTables with DT plugin
DataTable.use(DT);

/**
 * ViewListLeadsNew Component
 *
 * A React component that renders a responsive DataTable for displaying leads information.
 * The table includes features like sorting, filtering, and responsive design.
 *
 * @component
 * @returns {JSX.Element} A DataTable component with leads data
 */
const ViewListLeadsNew = () => {
    // State and refs initialization
    const [tableData] = useTableData();
    const tableRef = useRef(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);

    // Create table options with row click handler
    const tableOptions = {
        ...useTableOptions([0, 1, 3, 4, 5, 6]),
        rowCallback: function(row, data) {
            // Add click event listener to each row
            row.addEventListener('click', () => {
                handleOpenModal(data);
            });
        }
    };

    // Function to close modal
    const handleCloseModal = () => {
        setShowModal(false);
    };

    // Function to open modal
    const handleOpenModal = (lead) => {
        setSelectedLead(lead);
        setShowModal(true);
    };

    return (
        <div className="card" style={{ width: "100%" }}>
            <div className="card-header table-card-header">
                <h5>MÓDULO DE LEADS NUEVOS</h5>
            </div>
            <div className="card-body" style={{ width: "100%", padding: "0" }}>
                <div className="table-responsive">
                    <div style={{ margin: "0", padding: "0.5rem" }}>
                        <DataTable
                            data={tableData}
                            ref={tableRef}
                            className="table table-striped table dt-responsive w-100 display text-left"
                            options={tableOptions}
                            columns={tableColumns}
                            id="mi-tabla-unica"
                        />
                    </div>
                </div>
                {showModal && selectedLead && <ModalLeads leadData={selectedLead} onClose={handleCloseModal} />}
            </div>
        </div>
    );
};

export default React.memo(ViewListLeadsNew);