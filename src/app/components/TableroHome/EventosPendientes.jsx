import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { selectEventsForTodayAndTomorrow, updateEventStatus } from "../../../store/Home/HomeSlice";
import { useNavigate } from "react-router-dom";
import { updateEventsStatusThunksHome } from "../../../store/Home/thunksHome";
import Swal from "sweetalert2";

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

    const { rol_admin } = useSelector((state) => state.auth);
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const events = useSelector(selectEventsForTodayAndTomorrow);
    const [selectedStatus, setSelectedStatus] = useState({});
    const [selectedDates, setSelectedDates] = useState({});
    const [selectedAdmin, setSelectedAdmin] = useState("");

    if (!events || events.length === 0) {
        return null;
    }

    // Filtrar eventos por nombreAdmin si hay un nombre seleccionado
    const filteredEvents = selectedAdmin ? events.filter((event) => event.nombreAdmin === selectedAdmin) : events;

    const handleRowClick = (id_calendar) => {
        navigate(`/detalle-evento/${id_calendar}`);
    };

    const handleStatusChange = (id_calendar, newStatus) => {
        setSelectedStatus((prev) => ({ ...prev, [id_calendar]: newStatus }));
        dispatch(updateEventStatus({ id_calendar, accion_calendar: newStatus }));
        dispatch(updateEventsStatusThunksHome(id_calendar, newStatus));
    };

    const handleDateChange = (id_calendar, newDate, nameEvent) => {
        setSelectedDates((prev) => ({ ...prev, [id_calendar]: newDate }));

        Swal.fire({
            position: "top-end",
            icon: "success",
            title: `Se cambió la fecha con éxito para el evento: ${nameEvent}`,
            showConfirmButton: false,
            timer: 2500,
        });
    };

    const formatDateForInput = (dateString) => {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toISOString().split("T")[0];
    };

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
            <td onClick={() => handleRowClick(event.id_calendar)}>{event.nombreAdmin.length > 12 ? `${event.nombreAdmin.substring(0, 12)}...` : event.nombreAdmin}</td>
            <td onClick={() => handleRowClick(event.id_calendar)}>{event.nombre_calendar}</td>
            <td onClick={() => handleRowClick(event.id_calendar)}>{event.nombre_lead && event.nombre_lead !== "0" ? event.nombre_lead : "--"}</td>
            <td>
                <input className="form-control" type="date" value={selectedDates[event.id_calendar] || formatDateForInput(event.fechaIni_calendar)} onChange={(e) => handleDateChange(event.id_calendar, e.target.value, event.nombre_calendar)} onClick={(e) => e.stopPropagation()} />
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
                            width: "101px",
                        }}
                        value={selectedStatus[event.id_calendar] || "Pendiente"}
                        onChange={(e) => handleStatusChange(event.id_calendar, e.target.value, event.nombre_calendar)}
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

    // Obtener lista de nombres de asesores únicos
    const uniqueAdmins = Array.from(new Set(events.map((event) => event.nombreAdmin)));

    return (
        <div className="col-12">
            <div className="card table-card">
                <div className="card-header d-flex align-items-center justify-content-between py-3">
                    <h5 className="mb-0">Eventos pendientes de acción</h5>
                    {rol_admin == 1 && (
                        <select className="form-select" value={selectedAdmin} onChange={(e) => setSelectedAdmin(e.target.value)} style={{ width: "200px" }}>
                            <option value="">Todos los Asesores</option>
                            {uniqueAdmins.map((admin) => (
                                <option key={admin} value={admin}>
                                    {admin}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
                <div className="card-body">
                    <div className="table-responsive">
                        <table className="table table-striped table dt-responsive w-100 display" id="pc-dt-simple">
                            <thead>
                                <tr>
                                    <th>Asesor</th>
                                    <th>Evento</th>
                                    <th>Cliente</th>
                                    <th>Fecha Inicial</th>
                                    <th>Estado</th>
                                    <th>Tipo</th>
                                    <th>Cita</th>
                                    <th>Proyecto</th>
                                    <th>Campaña</th>
                                </tr>
                            </thead>
                            <tbody>{filteredEvents.map(renderEventRow)}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
