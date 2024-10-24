import React from "react";
import * as XLSX from "xlsx";

const ExportButton = ({ events }) => {
    const handleExportToExcel = () => {
        const dataToExport = events.map((event) => ({
            Evento: event.nombre_calendar,
            Lead: event.nombre_lead,
            "Fecha Inicio": event.fechaIni_calendar,
            "Hora Inicial": event.horaInicio_calendar,
            Estado: event.accion_calendar,
            Tipo: event.tipo_calendar,
            Cita: event.cita_lead === 1 ? "Cita" : "No aplica",
            Proyecto: event.proyecto_lead,
            Campaña: event.campana_lead,
        }));

        const ws = XLSX.utils.json_to_sheet(dataToExport);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Eventos");
        XLSX.writeFile(wb, "Eventos.xlsx");
    };

    return (
        <button onClick={handleExportToExcel} className="btn btn-primary mb-3">
            Exportar a Excel
        </button>
    );
};

export default ExportButton;
