import { React, useRef, useEffect, DataTable, useTableOptions, DT } from "../Imports/imports";
import { useTableData } from "./useTableData";
import { tableColumns } from "./tableColumns";
import "../Imports/style.css";

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
 *
 * @example
 * return (
 *   <ViewListLeadsNew />
 * )
 */
const ViewListLeadsNew = () => {
    // State and refs initialization
    const [tableData] = useTableData(); // Hook to fetch and manage table data
    const tableOptions = useTableOptions([0, 1, 3, 4, 5, 6]); // Custom table configuration
    const tableRef = useRef(null); // Reference to the table instance

    /**
     * Effect hook to update table data when it changes
     * Clears existing data, adds new rows, and adjusts columns
     */
    useEffect(() => {
        if (tableRef.current && typeof tableRef.current.DataTable === "function") {
            const table = tableRef.current.DataTable();
            table.clear();
            table.rows.add(tableData);
            table.columns.adjust().draw();
        }
    }, [tableData]);

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
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default React.memo(ViewListLeadsNew);
