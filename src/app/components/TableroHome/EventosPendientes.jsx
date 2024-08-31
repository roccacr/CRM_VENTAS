import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectEventsForTodayAndTomorrow, updateEventStatus } from "../../../store/Home/HomeSlice";
import { useNavigate } from "react-router-dom";
import { updateEventsStatusThunksHome } from "../../../store/Home/thunksHome";

// Define styles outside of the component
const styles = {
    statusPending: {
        backgroundColor: "#ffffff",
        color: "#000",
    },
    statusCompleted: {
        backgroundColor: "#28a745",
        color: "#ffffff",
    },
    statusCanceled: {
        backgroundColor: "#6c757d",
        color: "#ffffff",
    },
};

export const EventosPendientes = () => {
    const navigate = useNavigate();
     const dispatch = useDispatch();
    const events = useSelector(selectEventsForTodayAndTomorrow);
    const [selectedStatus, setSelectedStatus] = useState({});
    const [selectedDates, setSelectedDates] = useState({});
    const [selectedTimes, setSelectedTimes] = useState({});

    if (!events || events.length === 0) {
        return null;
    }

    const handleRowClick = (id_calendar) => {
        navigate(`/detalle-evento/${id_calendar}`);
    };

    const handleStatusChange = (id_calendar, newStatus) => {
        setSelectedStatus((prev) => ({ ...prev, [id_calendar]: newStatus }));
        dispatch(updateEventStatus({ id_calendar, accion_calendar: newStatus }));
        dispatch(updateEventsStatusThunksHome(id_calendar, newStatus));
    };

    const handleDateChange = (id_calendar, newDate) => {
        setSelectedDates((prev) => ({ ...prev, [id_calendar]: newDate }));
        alert(`Event ID: ${id_calendar}, New Date: ${newDate}`);
    };

    const handleTimeChange = (id_calendar, newTime) => {
        setSelectedTimes((prev) => ({ ...prev, [id_calendar]: newTime }));
        alert(`Event ID: ${id_calendar}, New Time: ${newTime}`);
    };

    const formatDateForInput = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toISOString().split("T")[0];
    };

    const formatTimeForInput = (timeString) => {
        if (!timeString) return "";
        const [time, modifier] = timeString.split(" ");
        let [hours, minutes] = time.split(":");
        if (modifier === "PM" && hours !== "12") {
            hours = String(parseInt(hours, 10) + 12);
        } else if (modifier === "AM" && hours === "12") {
            hours = "00";
        }
        return `${hours.padStart(2, "0")}:${minutes}`;
    };

    // Add the missing getStatusStyle function
    const getStatusStyle = (status) => {
        switch (status) {
            case "Pendiente":
                return styles.statusPending;
            case "Completado":
                return styles.statusCompleted;
            case "Cancelado":
                return styles.statusCanceled;
            default:
                return {};
        }
    };

    const renderEventRow = (event) => (
        <tr key={`${event.id_calendar}-${event.horaInicio_calendar}`}>
            <td onClick={() => handleRowClick(event.id_calendar)}>{event.nombre_calendar}</td>
            <td onClick={() => handleRowClick(event.id_calendar)}>{event.nombre_lead && event.nombre_lead !== "0" ? event.nombre_lead : "--"}</td>
            <td>
                <input className="form-control" type="date" value={selectedDates[event.id_calendar] || formatDateForInput(event.fechaIni_calendar)} onChange={(e) => handleDateChange(event.id_calendar, e.target.value)} onClick={(e) => e.stopPropagation()} />
            </td>
            <td>
                <input className="form-control" type="time" value={selectedTimes[event.id_calendar] || formatTimeForInput(event.horaInicio_calendar)} onChange={(e) => handleTimeChange(event.id_calendar, e.target.value)} onClick={(e) => e.stopPropagation()} />
            </td>
            <td>
                {event.accion_calendar === "Pendiente" ? (
                    <select
                        className="form-select"
                        style={{
                            ...getStatusStyle(selectedStatus[event.id_calendar] || "Pendiente"),
                            appearance: "none",
                            WebkitAppearance: "none",
                            MozAppearance: "none",
                            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                            backgroundRepeat: "no-repeat",
                            backgroundPosition: "right 0.7em top 50%",
                            backgroundSize: "0.65em auto",
                            paddingRight: "1.5em",
                        }}
                        value={selectedStatus[event.id_calendar] || "Pendiente"}
                        onChange={(e) => handleStatusChange(event.id_calendar, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <option value="Pendiente">Pendiente</option>
                        <option value="Completado">Completado</option>
                        <option value="Cancelado">Cancelado</option>
                    </select>
                ) : (
                    <span className="badge text-bg-secondary">{event.accion_calendar}</span>
                )}
            </td>
            <td onClick={() => handleRowClick(event.id_calendar)}>{event.tipo_calendar}</td>
            <td onClick={() => handleRowClick(event.id_calendar)}>{event.cita_lead === 1 ? "Cita" : "--"}</td>
            <td onClick={() => handleRowClick(event.id_calendar)}>{event.proyecto && event.proyecto !== "0" ? event.proyecto : "--"}</td>
            <td onClick={() => handleRowClick(event.id_calendar)}>{event.campana && event.campana !== "0" ? event.campana : "--"}</td>
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
