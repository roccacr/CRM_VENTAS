import React from "react";
import { useSelector } from "react-redux";
import { selectEventsForTodayAndTomorrow } from "../../../store/Home/HomeSlice";
import { useNavigate } from "react-router-dom";

// Component for displaying pending events
export const EventosPendientes = () => {
    const navigate = useNavigate();
    const events = useSelector(selectEventsForTodayAndTomorrow);

    // If there are no events, don't render anything
    if (!events || events.length === 0) {
        return null;
    }

    // Handler for row click event
    const handleRowClick = (id_calendar) => {
        navigate(`/detalle-evento/${id_calendar}`);
    };

    // Render a table row for an event
    const renderEventRow = (event) => (
        <tr key={event.id_calendar} onClick={() => handleRowClick(event.id_calendar)}>
            <td>{event.nombre_calendar}</td>
            <td>{event.nombre_lead && event.nombre_lead !== "0" ? event.nombre_lead : "--"}</td>
            <td>{event.fechaIni_calendar.split("T")[0]}</td>
            <td>{event.horaInicio_calendar}</td>
            <td>{event.accion_calendar === "Pendiente" && <span className="badge text-bg-danger">{event.accion_calendar}</span>}</td>
            <td>{event.tipo_calendar}</td>
            <td>{event.cita_lead === 1 ? "Cita" : "--"}</td>
            <td>{event.proyecto && event.proyecto !== "0" ? event.proyecto : "--"}</td>
            <td>{event.campana && event.campana !== "0" ? event.campana : "--"}</td>
            <td>{event.id_calendar}</td>
        </tr>
    );

    return (
        <div className="col-12">
            <div className="card table-card">
                <div className="card-header d-flex align-items-center justify-content-between py-3">
                    <h5 className="mb-0">Eventos pendientes de acción</h5>
                </div>
                <div className="card-body">
                    <div className="table-responsive">
                        <table className="table table-hover" id="pc-dt-simple">
                            <thead>
                                <tr>
                                    <th>Evento</th>
                                    <th>Cliente</th>
                                    <th>Fecha Inicial</th>
                                    <th>Hora Inicial</th>
                                    <th>Estado</th>
                                    <th>Tipo</th>
                                    <th>Cita</th>
                                    <th>Proyecto</th>
                                    <th>Campaña</th>
                                    <th>idCalendario</th>
                                </tr>
                            </thead>
                            <tbody>{events.map(renderEventRow)}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
