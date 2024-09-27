import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setGetEventsHome, updateEventDate, updateEventsStatusThunksHome } from "../../../store/Home/thunksHome";
import { selectListEventsPending } from "../../../store/Home/selectorsHome";
import { updateActionCalendar } from "../../../store/Home/HomeSlice";
import { ButtonActions } from "../buttonAccions/buttonAccions";


export const EventosPendientes = () => {
    const dispatch = useDispatch();
    const { rol_admin } = useSelector((state) => state.auth);
    const listEventsPending = useSelector(selectListEventsPending);

    // Estado para almacenar el nombreAdmin seleccionado
    const [selectedAdmin, setSelectedAdmin] = useState("");

    // Estado para almacenar los valores de fecha editados
    const [editedDates, setEditedDates] = useState({});

    // Función para formatear la fecha
    const formatDate = (dateString) => {
        if (dateString) {
            // Verificar si la fecha contiene 'T' (formato ISO)
            if (dateString.includes("T")) {
                // Extraer la parte antes de 'T'
                return dateString.split("T")[0];
            } else {
                // Si no contiene 'T', extraer la parte antes de ':'
                return dateString.split(":")[0];
            }
        }
        return "";
    };

    // Dispatch the action to get events when the component mounts
    useEffect(() => {
        dispatch(setGetEventsHome());
    }, [dispatch]);

    // Extraer los nombres únicos de los asesores (nombreAdmin)
    const uniqueAdmins = [...new Set(listEventsPending?.map((event) => event.nombreAdmin))];

    // Filtrar los eventos según el asesor seleccionado
    const filteredEvents = selectedAdmin ? listEventsPending.filter((event) => event.nombreAdmin === selectedAdmin) : listEventsPending;

    // Ordenar los eventos filtrados por fecha (descendente: más reciente a más antigua)
    const sortedEvents = [...filteredEvents].sort((a, b) => {
        const dateA = new Date(formatDate(a.fechaIni_calendar));
        const dateB = new Date(formatDate(b.fechaIni_calendar));
        return dateB - dateA;
    });

    // Manejador de cambio para el select
    const handleSelectChange = (event, id, lead, estado) => {
         const selectedValue = event.target.value;
        dispatch(updateActionCalendar({ id, selectedValue }));
        dispatch(updateEventsStatusThunksHome(id, selectedValue,lead, estado));
        // dispatch(updateLeadActions(idLeds, status));
    };

    // Manejador de cambio para el campo de fecha
    const handleDateChange = (event, id, originalDate) => {
        const newDate = event.target.value;
        setEditedDates((prevDates) => ({
            ...prevDates,
            [id]: newDate,
        }));

        dispatch(updateEventDate(id, newDate, originalDate));
    };

    return (
        <div className="col-12">
            {sortedEvents.length > 0 && (
                <div className="card table-card">
                    <div className="card-header d-flex align-items-center justify-content-between py-3">
                        <h5 className="mb-0">Eventos pendientes de acción</h5>

                        {/* Select para filtrar por nombreAdmin */}
                        {rol_admin === 1 && (
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
                                        <th>Accion</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedEvents.length > 0 ? (
                                        sortedEvents
                                            .filter((event) => event.accion_calendar === "Pendiente")
                                            .map((event) => (
                                                <tr key={event.id_calendar}>
                                                    <td>{event.nombreAdmin.substring(0, 12)}</td>
                                                    <td>{event.nombre_calendar}</td>
                                                    <td>{event.nombre_lead.substring(0, 15)}</td>
                                                    <td>
                                                        <input className="form-control" type="date" value={formatDate(event.fechaIni_calendar)} onChange={(e) => handleDateChange(e, event.id_calendar, event.fechaIni_calendar)} />
                                                    </td>
                                                    <td>
                                                        <select value={event.accion_calendar} onChange={(e) => handleSelectChange(e, event.id_calendar, event.idinterno_lead, event.segimineto_lead)} className="form-select">
                                                            <option value="Pendiente">Pendiente</option>
                                                            <option value="Completado">Completado</option>
                                                            <option value="Cancelado">Cancelado</option>
                                                        </select>
                                                    </td>
                                                    <td>{event.tipo_calendar}</td>
                                                    <td>{event.cita_lead === 1 ? "Cita" : "-"}</td>
                                                    <td>{event.proyecto_lead}</td>
                                                    <td>{event.campana_lead}</td>
                                                    <td>{event.id_lead > 0 ? <ButtonActions leadData={event} /> : "No aplica"}</td>
                                                </tr>
                                            ))
                                    ) : (
                                        <tr>
                                            <td colSpan="9">No hay eventos pendientes</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
