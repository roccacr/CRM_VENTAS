import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";

import { updateActionCalendar } from "../../../store/Home/HomeSlice";
import { selectListEventsPending } from "../../../store/Home/selectorsHome";
import {
    setGetEventsHome,
    updateEventDate,
    updateEventsStatusThunksHome,
} from "../../../store/Home/thunksHome";
import { ButtonActions } from "../buttonAccions/buttonAccions";

const normalizeAdminName = (value) => (value || "").trim().toLowerCase();

const getAdminKey = (event) => {
    if (event?.id_admin !== undefined && event?.id_admin !== null && event?.id_admin !== "") {
        return `id:${event.id_admin}`;
    }

    return `name:${normalizeAdminName(event?.name_admin)}`;
};

const getDisplayValue = (value) => {
    if (value === 0 || value === "0" || value === null || value === undefined || value === "") {
        return "No aplica";
    }

    return value;
};

/**
 * Lista de eventos pendientes con filtro por asesor.
 *
 * @returns {JSX.Element} Tabla de eventos pendientes.
 */
export const EventosPendientes = () => {
    const dispatch = useDispatch();
    const { rol_admin } = useSelector((state) => state.auth);
    const listEventsPending = useSelector(selectListEventsPending);

    const [selectedAdminKey, setSelectedAdminKey] = useState("");
    const [editedDates, setEditedDates] = useState({});

    const formatDate = (dateString) => {
        if (!dateString) {
            return "";
        }

        if (dateString.includes("T")) {
            return dateString.split("T")[0];
        }

        return dateString.split(":")[0];
    };

    useEffect(() => {
        dispatch(setGetEventsHome());
    }, [dispatch]);

    const uniqueAdmins = Array.from(
        new Map(
            (listEventsPending || [])
                .filter((event) => normalizeAdminName(event?.name_admin))
                .map((event) => [
                    getAdminKey(event),
                    {
                        key: getAdminKey(event),
                        label: event.name_admin.trim(),
                    },
                ]),
        ).values(),
    );

    const filteredEvents = selectedAdminKey
        ? listEventsPending.filter((event) => getAdminKey(event) === selectedAdminKey)
        : listEventsPending;

    const sortedEvents = [...filteredEvents].sort((a, b) => {
        const dateA = new Date(formatDate(a.fechaIni_calendar));
        const dateB = new Date(formatDate(b.fechaIni_calendar));
        return dateB - dateA;
    });

    const handleSelectChange = (event, id, lead, estado) => {
        const selectedValue = event.target.value;
        dispatch(updateActionCalendar({ id, selectedValue }));
        dispatch(updateEventsStatusThunksHome(id, selectedValue, lead, estado));
    };

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
                        <h5 className="mb-0">Eventos pendientes de acción.</h5>

                        {rol_admin === 1 && (
                            <select
                                className="form-select"
                                value={selectedAdminKey}
                                onChange={(e) => setSelectedAdminKey(e.target.value)}
                                style={{ width: "200px" }}
                            >
                                <option value="">Todos los Asesores</option>
                                {uniqueAdmins.map((admin) => (
                                    <option key={admin.key} value={admin.key}>
                                        {admin.label}
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
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedEvents.length > 0 ? (
                                        sortedEvents
                                            .filter((event) => event.accion_calendar === "Pendiente")
                                            .map((event) => (
                                                <tr key={event.id_calendar}>
                                                    <td>{event.name_admin}</td>
                                                    <td>{event.nombre_calendar}</td>
                                                    <td>{getDisplayValue(event.nombre_lead)}</td>
                                                    <td>
                                                        <input
                                                            className="form-control"
                                                            type="date"
                                                            value={editedDates[event.id_calendar] || formatDate(event.fechaIni_calendar)}
                                                            onChange={(e) => handleDateChange(e, event.id_calendar, event.fechaIni_calendar)}
                                                        />
                                                    </td>
                                                    <td>
                                                        <select
                                                            value={event.accion_calendar}
                                                            onChange={(e) =>
                                                                handleSelectChange(
                                                                    e,
                                                                    event.id_calendar,
                                                                    event.idinterno_lead,
                                                                    event.segimineto_lead,
                                                                )
                                                            }
                                                            className="form-select"
                                                        >
                                                            <option value="Pendiente">Pendiente</option>
                                                            <option value="Completado">Completado</option>
                                                            <option value="Cancelado">Cancelado</option>
                                                        </select>
                                                    </td>
                                                    <td>{event.tipo_calendar}</td>
                                                    <td>{event.cita_lead === 1 ? "Cita" : "-"}</td>
                                                    <td>{getDisplayValue(event.proyecto_lead)}</td>
                                                    <td>{getDisplayValue(event.campana_lead)}</td>
                                                    <td>{event.id_lead > 0 ? <ButtonActions leadData={event} /> : "No aplica"}</td>
                                                </tr>
                                            ))
                                    ) : (
                                        <tr>
                                            <td colSpan="10">No hay eventos pendientes</td>
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
