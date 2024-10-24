import React from "react";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";

const EventTable = ({ events, handleEventClick }) => {

    const formatDate = (dateString) => {
        if (dateString.includes("T")) {
            return dateString.split("T")[0];
        }
        return dateString.split(":")[0];
    };

    return (
        <div className="table-responsive">
            <table className="table table-striped table dt-responsive w-100 display text-left" style={{ fontSize: "15px", width: "100%", textAlign: "left" }}>
                <thead>
                    <tr>
                        <th>ASESOR</th>
                        <th>EVENTO</th>
                        <th>LEAD</th>
                        <th>FECHA INICIO</th>
                        <th>HORA INICIAL</th>
                        <th>ESTADO</th>
                        <th>TIPO</th>
                        <th>CITA</th>
                        <th>PROYECTO</th>
                        <th>CAMPAÑA</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    {events.map((event, index) => (
                        <tr key={index} style={{ cursor: "pointer" }}>
                            <td onClick={() => handleEventClick(event.id_calendar, event.id_lead)}>{event.name_admin}</td>
                            <td onClick={() => handleEventClick(event.id_calendar, event.id_lead)}>{event.nombre_calendar}</td>
                            <td onClick={() => handleEventClick(event.id_calendar, event.id_lead)}>{event.nombre_lead}</td>
                            <td onClick={() => handleEventClick(event.id_calendar, event.id_lead)}>{formatDate(event.fechaIni_calendar)}</td>
                            <td onClick={() => handleEventClick(event.id_calendar, event.id_lead)}>{event.horaInicio_calendar}</td>
                            <td onClick={() => handleEventClick(event.id_calendar, event.id_lead)}>{event.accion_calendar}</td>
                            <td onClick={() => handleEventClick(event.id_calendar, event.id_lead)}>{event.tipo_calendar}</td>
                            <td onClick={() => handleEventClick(event.id_calendar, event.id_lead)}>{event.cita_lead === 1 ? "Cita" : "No aplica"}</td>
                            <td onClick={() => handleEventClick(event.id_calendar, event.id_lead)}>{event.proyecto_lead}</td>
                            <td onClick={() => handleEventClick(event.id_calendar, event.id_lead)}>{event.campana_lead}</td>
                            <td>{event.id_lead > 0 ? <ButtonActions leadData={event} /> : "No aplica"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default EventTable;
