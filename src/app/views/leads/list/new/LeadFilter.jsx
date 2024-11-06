import { useState, useEffect } from "react";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import LeadTable from "./LeadTable";

const animatedComponents = makeAnimated();

export default function LeadFilter({ data }) {
    const [filteredData, setFilteredData] = useState(data); // Registros filtrados
    const [uniqueAdmins, setUniqueAdmins] = useState([]); // Opciones únicas para el filtro
    const [selectedAdmins, setSelectedAdmins] = useState([]); // Estado del filtro seleccionado

    // Genera opciones únicas para el filtro `name_admin`
    useEffect(() => {
        setUniqueAdmins(
            [...new Set(data.map((lead) => lead.name_admin))].map((admin) => ({
                label: admin,
                value: admin,
            }))
        );
    }, [data]);

    // Maneja el cambio de filtro
    const handleFilterChange = (selectedOptions) => {
        const selectedValues = selectedOptions ? selectedOptions.map((option) => option.value) : [];
        setSelectedAdmins(selectedOptions);

        if (selectedValues.length > 0) {
            setFilteredData(data.filter((lead) =>a selectedValues.includes(lead.name_admin)));
        } else {
            setFilteredData(data); // Muestra todos los registros si no hay filtros
        }
    };

    return (
        <div>
            <div style={{ margin: "10px" }}>
                <Select
                    components={animatedComponents}
                    isMulti
                    closeMenuOnSelect={false}
                    options={uniqueAdmins}
                    value={selectedAdmins}
                    onChange={handleFilterChange}
                    placeholder="Filtrar por Asesor"
                />
            </div>
            <LeadTable data={filteredData} />
        </div>
    );
}
