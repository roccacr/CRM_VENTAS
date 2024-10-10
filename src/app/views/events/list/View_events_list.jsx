import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { getAllListEvent } from "../../../../store/calendar/thunkscalendar";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import * as XLSX from "xlsx";
import { useLocation, useNavigate } from "react-router-dom"; // Import useLocation and useNavigate
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";

export const View_events_list = () => {
    const dispatch = useDispatch();
    const location = useLocation();
    const navigate = useNavigate(); // Hook to navigate to another route
    const [events, setEvents] = useState([]);
    const [dateStart, setDateStart] = useState("");
    const [dateEnd, setDateEnd] = useState("");
    const [loading, setLoading] = useState(false);

    // Pagination state
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // Filter states
    const [eventName, setEventName] = useState("");
    const [accionCalendar, setAccionCalendar] = useState([]);
    const [tipoCalendar, setTipoCalendar] = useState([]);
    const [citaLead, setCitaLead] = useState([]);
    const [proyectoLead, setProyectoLead] = useState([]);
    const [campanaLead, setCampanaLead] = useState([]);

    const animatedComponents = makeAnimated();

    // Original events data fetched from the server
    const [originalEvents, setOriginalEvents] = useState([]);

    // Set dateStart and dateEnd based on URL query parameters
    useEffect(() => {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        // Check if URL has the query parameter ?data=1
        const searchParams = new URLSearchParams(location.search);
        const isToday = searchParams.get("data") === "1";

        if (isToday) {
            // If ?data=1, set both dateStart and dateEnd to today's date
            const todayString = today.toISOString().split("T")[0];
            setDateStart(todayString);
            setDateEnd(todayString);
        } else {
            // Otherwise, set to the start and end of the current month
            setDateStart(firstDay.toISOString().split("T")[0]);
            setDateEnd(lastDay.toISOString().split("T")[0]);
        }
    }, [location]);

    // Fetch events whenever dateStart or dateEnd changes
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            if (dateStart && dateEnd) {
                const eventsData = await dispatch(getAllListEvent(dateStart, dateEnd));

                // Sort events from most recent to oldest
                const sortedEvents = eventsData.sort((a, b) => new Date(b.fechaIni_calendar) - new Date(a.fechaIni_calendar));
                setOriginalEvents(sortedEvents);
                setEvents(sortedEvents);
                setCurrentPage(1);
            }
            setLoading(false);
        };
        fetchData();
    }, [dispatch, dateStart, dateEnd]);

    const generateOptionsWithCounts = (field) => {
        const countMap = originalEvents.reduce((acc, event) => {
            const value = event[field];
            acc[value] = (acc[value] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(countMap).map(([value, count]) => ({
            value,
            label: `${value} (${count})`,
        }));
    };

    const accionCalendarOptions = generateOptionsWithCounts("accion_calendar");
    const tipoCalendarOptions = generateOptionsWithCounts("tipo_calendar");
    const citaLeadOptions = [
        { value: "1", label: `Cita (${originalEvents.filter((e) => e.cita_lead === 1).length})` },
        { value: "0", label: `No aplica (${originalEvents.filter((e) => e.cita_lead === 0).length})` },
    ];
    const proyectoLeadOptions = generateOptionsWithCounts("proyecto_lead");
    const campanaLeadOptions = generateOptionsWithCounts("campana_lead");

    useEffect(() => {
        let filteredEvents = originalEvents;

        if (eventName) {
            filteredEvents = filteredEvents.filter((event) => event.nombre_calendar.toLowerCase().includes(eventName.toLowerCase()));
        }

        if (accionCalendar.length > 0) {
            const accionValues = accionCalendar.map((item) => item.value);
            filteredEvents = filteredEvents.filter((event) => accionValues.includes(event.accion_calendar));
        }

        if (tipoCalendar.length > 0) {
            const tipoValues = tipoCalendar.map((item) => item.value);
            filteredEvents = filteredEvents.filter((event) => tipoValues.includes(event.tipo_calendar));
        }

        if (citaLead.length > 0) {
            const citaValues = citaLead.map((item) => item.value);
            filteredEvents = filteredEvents.filter((event) => citaValues.includes(event.cita_lead.toString()));
        }

        if (proyectoLead.length > 0) {
            const proyectoValues = proyectoLead.map((item) => item.value);
            filteredEvents = filteredEvents.filter((event) => proyectoValues.includes(event.proyecto_lead));
        }

        if (campanaLead.length > 0) {
            const campanaValues = campanaLead.map((item) => item.value);
            filteredEvents = filteredEvents.filter((event) => campanaValues.includes(event.campana_lead));
        }

        setEvents(filteredEvents);
        setCurrentPage(1);
    }, [eventName, accionCalendar, tipoCalendar, citaLead, proyectoLead, campanaLead, originalEvents]);

    // Handle row click event to navigate
    const handleEventClick = (idCalendar, idLead) => {
        navigate(`/events/actions?idCalendar=${idCalendar}&idLead=${idLead}&idDate=0`);
    };

    // Export filtered data to Excel
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

    const indexOfLastEvent = currentPage * itemsPerPage;
    const indexOfFirstEvent = indexOfLastEvent - itemsPerPage;
    const currentEvents = events.slice(indexOfFirstEvent, indexOfLastEvent);
    const totalPages = Math.ceil(events.length / itemsPerPage);

    const handlePageChange = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    const handleItemsPerPageChange = (e) => {
        setItemsPerPage(parseInt(e.target.value));
        setCurrentPage(1);
    };

    const pageNumbers = [];
    for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
    }

    return (
        <div>
            <div className="date-filters" style={{ marginBottom: "20px" }}>
                <label>
                    Fecha Inicio:
                    <input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="form-control" style={{ marginRight: "20px", marginLeft: "10px" }} />
                </label>
                <label>
                    Fecha Fin:
                    <input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="form-control" style={{ marginLeft: "10px" }} />
                </label>
                <label style={{ marginLeft: "20px" }}>
                    Items por página:
                    <select value={itemsPerPage} onChange={handleItemsPerPageChange} className="form-control" style={{ marginLeft: "10px" }}>
                        <option value={10}>10</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                    </select>
                </label>
            </div>

            {/* Export to Excel Button */}
            <button onClick={handleExportToExcel} className="btn btn-primary mb-3">
                Exportar a Excel
            </button>

            {/* Filter Inputs */}
            <div className="row" style={{ marginBottom: "20px" }}>
                <div className="col-md-4">
                    <label>Buscar por Nombre de Evento</label>
                    <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Nombre de Evento" className="form-control" style={{ width: "100%", padding: "8px", marginTop: "5px" }} />
                </div>

                <div className="col-md-4">
                    <label>Filtrar por Acción</label>
                    <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={accionCalendarOptions} value={accionCalendar} onChange={(selected) => setAccionCalendar(selected)} placeholder="Acción" className="form-control" styles={{ marginTop: "5px" }} />
                </div>

                <div className="col-md-4">
                    <label>Filtrar por Tipo</label>
                    <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={tipoCalendarOptions} value={tipoCalendar} onChange={(selected) => setTipoCalendar(selected)} placeholder="Tipo" className="form-control" styles={{ marginTop: "5px" }} />
                </div>
            </div>

            <div className="row" style={{ marginBottom: "20px" }}>
                <div className="col-md-4">
                    <label>Filtrar por Cita</label>
                    <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={citaLeadOptions} value={citaLead} onChange={(selected) => setCitaLead(selected)} placeholder="Cita" className="form-control" styles={{ marginTop: "5px" }} />
                </div>

                <div className="col-md-4">
                    <label>Filtrar por Proyecto</label>
                    <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={proyectoLeadOptions} value={proyectoLead} onChange={(selected) => setProyectoLead(selected)} placeholder="Proyecto" className="form-control" styles={{ marginTop: "5px" }} />
                </div>

                <div className="col-md-4">
                    <label>Filtrar por Campaña</label>
                    <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={campanaLeadOptions} value={campanaLead} onChange={(selected) => setCampanaLead(selected)} placeholder="Campaña" className="form-control" styles={{ marginTop: "5px" }} />
                </div>
            </div>

            {loading ? (
                <div>Cargando...</div>
            ) : (
                <div>
                    <div className="table-responsive">
                        <table className="table table-striped table dt-responsive w-100 display text-left" style={{ fontSize: "15px", width: "100%", textAlign: "left" }}>
                            <thead>
                                <tr>
                                    <th>EVENTO</th>
                                    <th>LEAD</th>
                                    <th>FECHA INICIO</th>
                                    <th>HORA INICIAL</th>
                                    <th>ESTADO</th>
                                    <th>TIPO</th>
                                    <th>CITA</th>
                                    <th>PROYECTO</th>
                                    <th>CAMPAÑA</th>
                                    <th>Accion</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentEvents &&
                                    currentEvents.map((event, index) => (
                                        <tr key={index}  style={{ cursor: "pointer" }}>
                                            <td onClick={() => handleEventClick(event.id_calendar, event.id_lead)}>{event.nombre_calendar}</td>
                                            <td onClick={() => handleEventClick(event.id_calendar, event.id_lead)}>{event.nombre_lead}</td>
                                            <td onClick={() => handleEventClick(event.id_calendar, event.id_lead)}>{event.fechaIni_calendar}</td>
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

                    <div style={{ marginTop: "20px", textAlign: "center" }}>
                        {pageNumbers.map((number) => (
                            <button
                                key={number}
                                onClick={() => handlePageChange(number)}
                                style={{
                                    margin: "0 5px",
                                    padding: "5px 10px",
                                    backgroundColor: number === currentPage ? "#007bff" : "#fff",
                                    color: number === currentPage ? "#fff" : "#007bff",
                                    border: "1px solid #007bff",
                                    borderRadius: "5px",
                                    cursor: "pointer",
                                }}
                            >
                                {number}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
