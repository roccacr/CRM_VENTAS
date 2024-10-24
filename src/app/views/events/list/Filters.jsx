import React, { useState, useEffect } from "react";
import Select from "react-select";
import makeAnimated from "react-select/animated";

const Filters = ({ originalEvents, setEvents }) => {
    const [eventName, setEventName] = useState("");
    const [accionCalendar, setAccionCalendar] = useState([]);
    const [tipoCalendar, setTipoCalendar] = useState([]);
    const [citaLead, setCitaLead] = useState([]);
    const [proyectoLead, setProyectoLead] = useState([]);
    const [campanaLead, setCampanaLead] = useState([]);
    const [nameAdmin, setNameAdmin] = useState([]);

    const animatedComponents = makeAnimated();

    const getFilteredOptionsForField = (field, events) => {
        let contextFilteredEvents = [...events];

        switch (field) {
            case "proyecto_lead":
                if (nameAdmin.length > 0) {
                    const selectedAdmins = nameAdmin.map((item) => item.value);
                    contextFilteredEvents = events.filter((event) => selectedAdmins.includes(event.name_admin));
                }
                break;
            case "campana_lead":
                if (nameAdmin.length > 0) {
                    const selectedAdmins = nameAdmin.map((item) => item.value);
                    contextFilteredEvents = events.filter((event) => selectedAdmins.includes(event.name_admin));
                }
                if (proyectoLead.length > 0) {
                    const selectedProyectos = proyectoLead.map((item) => item.value);
                    contextFilteredEvents = contextFilteredEvents.filter((event) => selectedProyectos.includes(event.proyecto_lead));
                }
                break;
            case "accion_calendar":
                if (nameAdmin.length > 0) {
                    const selectedAdmins = nameAdmin.map((item) => item.value);
                    contextFilteredEvents = contextFilteredEvents.filter((event) => selectedAdmins.includes(event.name_admin));
                }
                if (proyectoLead.length > 0) {
                    const selectedProyectos = proyectoLead.map((item) => item.value);
                    contextFilteredEvents = contextFilteredEvents.filter((event) => selectedProyectos.includes(event.proyecto_lead));
                }
                if (campanaLead.length > 0) {
                    const selectedCampanas = campanaLead.map((item) => item.value);
                    contextFilteredEvents = contextFilteredEvents.filter((event) => selectedCampanas.includes(event.campana_lead));
                }
                break;
            case "tipo_calendar":
                if (nameAdmin.length > 0 || proyectoLead.length > 0 || campanaLead.length > 0 || accionCalendar.length > 0) {
                    if (nameAdmin.length > 0) {
                        const selectedAdmins = nameAdmin.map((item) => item.value);
                        contextFilteredEvents = contextFilteredEvents.filter((event) => selectedAdmins.includes(event.name_admin));
                    }
                    if (proyectoLead.length > 0) {
                        const selectedProyectos = proyectoLead.map((item) => item.value);
                        contextFilteredEvents = contextFilteredEvents.filter((event) => selectedProyectos.includes(event.proyecto_lead));
                    }
                    if (campanaLead.length > 0) {
                        const selectedCampanas = campanaLead.map((item) => item.value);
                        contextFilteredEvents = contextFilteredEvents.filter((event) => selectedCampanas.includes(event.campana_lead));
                    }
                    if (accionCalendar.length > 0) {
                        const selectedAcciones = accionCalendar.map((item) => item.value);
                        contextFilteredEvents = contextFilteredEvents.filter((event) => selectedAcciones.includes(event.accion_calendar));
                    }
                }
                break;
            case "cita_lead":
                if (nameAdmin.length > 0 || proyectoLead.length > 0 || campanaLead.length > 0 || accionCalendar.length > 0 || tipoCalendar.length > 0) {
                    if (nameAdmin.length > 0) {
                        const selectedAdmins = nameAdmin.map((item) => item.value);
                        contextFilteredEvents = contextFilteredEvents.filter((event) => selectedAdmins.includes(event.name_admin));
                    }
                    if (proyectoLead.length > 0) {
                        const selectedProyectos = proyectoLead.map((item) => item.value);
                        contextFilteredEvents = contextFilteredEvents.filter((event) => selectedProyectos.includes(event.proyecto_lead));
                    }
                    if (campanaLead.length > 0) {
                        const selectedCampanas = campanaLead.map((item) => item.value);
                        contextFilteredEvents = contextFilteredEvents.filter((event) => selectedCampanas.includes(event.campana_lead));
                    }
                    if (accionCalendar.length > 0) {
                        const selectedAcciones = accionCalendar.map((item) => item.value);
                        contextFilteredEvents = contextFilteredEvents.filter((event) => selectedAcciones.includes(event.accion_calendar));
                    }
                    if (tipoCalendar.length > 0) {
                        const selectedTipos = tipoCalendar.map((item) => item.value);
                        contextFilteredEvents = contextFilteredEvents.filter((event) => selectedTipos.includes(event.tipo_calendar));
                    }
                }
                break;
            default:
                break;
        }

        const uniqueValues = new Map();
        contextFilteredEvents.forEach((event) => {
            const value = event[field];
            if (value !== undefined) {
                if (uniqueValues.has(value)) {
                    uniqueValues.set(value, uniqueValues.get(value) + 1);
                } else {
                    uniqueValues.set(value, 1);
                }
            }
        });

        if (field === "cita_lead") {
            const citaCount = contextFilteredEvents.filter((e) => e.cita_lead === 1).length;
            const noCitaCount = contextFilteredEvents.filter((e) => e.cita_lead === 0).length;
            return [
                { value: "1", label: `Cita (${citaCount})` },
                { value: "0", label: `No aplica (${noCitaCount})` },
            ];
        }

        return Array.from(uniqueValues.entries())
            .map(([value, count]) => ({
                value,
                label: `${value} (${count})`,
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    };

    const applyAllFilters = (events) => {
        let filteredEvents = [...events];

        if (eventName) {
            filteredEvents = filteredEvents.filter((event) => event.nombre_calendar.toLowerCase().includes(eventName.toLowerCase()));
        }

        if (nameAdmin.length > 0) {
            const selectedAdmins = nameAdmin.map((item) => item.value);
            filteredEvents = filteredEvents.filter((event) => selectedAdmins.includes(event.name_admin));
        }

        if (proyectoLead.length > 0) {
            const selectedProyectos = proyectoLead.map((item) => item.value);
            filteredEvents = filteredEvents.filter((event) => selectedProyectos.includes(event.proyecto_lead));
        }

        if (campanaLead.length > 0) {
            const selectedCampanas = campanaLead.map((item) => item.value);
            filteredEvents = filteredEvents.filter((event) => selectedCampanas.includes(event.campana_lead));
        }

        if (accionCalendar.length > 0) {
            const selectedAcciones = accionCalendar.map((item) => item.value);
            filteredEvents = filteredEvents.filter((event) => selectedAcciones.includes(event.accion_calendar));
        }

        if (tipoCalendar.length > 0) {
            const selectedTipos = tipoCalendar.map((item) => item.value);
            filteredEvents = filteredEvents.filter((event) => selectedTipos.includes(event.tipo_calendar));
        }

        if (citaLead.length > 0) {
            const selectedCitas = citaLead.map((item) => item.value);
            filteredEvents = filteredEvents.filter((event) => selectedCitas.includes(event.cita_lead.toString()));
        }

        return filteredEvents;
    };

    useEffect(() => {
        const filteredEvents = applyAllFilters(originalEvents);
        setEvents(filteredEvents);
    }, [eventName, nameAdmin, proyectoLead, campanaLead, accionCalendar, tipoCalendar, citaLead]);

    const handleNameAdminChange = (selected) => {
        setNameAdmin(selected || []);
        if (!selected || selected.length === 0) {
            setProyectoLead([]);
            setCampanaLead([]);
            setAccionCalendar([]);
            setTipoCalendar([]);
            setCitaLead([]);
        }
    };

    const handleProyectoLeadChange = (selected) => {
        setProyectoLead(selected || []);
        if (!selected || selected.length === 0) {
            setCampanaLead([]);
            setAccionCalendar([]);
            setTipoCalendar([]);
            setCitaLead([]);
        }
    };

    const handleCampanaLeadChange = (selected) => {
        setCampanaLead(selected || []);
        if (!selected || selected.length === 0) {
            setAccionCalendar([]);
            setTipoCalendar([]);
            setCitaLead([]);
        }
    };

    const handleAccionCalendarChange = (selected) => {
        setAccionCalendar(selected || []);
        if (!selected || selected.length === 0) {
            setTipoCalendar([]);
            setCitaLead([]);
        }
    };

    const handleTipoCalendarChange = (selected) => {
        setTipoCalendar(selected || []);
        if (!selected || selected.length === 0) {
            setCitaLead([]);
        }
    };

    return (
        <div className="row" style={{ marginBottom: "20px" }}>
            <div className="col-md-4">
                <label>Buscar por Nombre de Evento</label>
                <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="Nombre de Evento" className="form-control" style={{ width: "100%", padding: "8px", marginTop: "5px" }} />
            </div>

            <div className="col-md-4">
                <label>Filtrar por Asesor</label>
                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={getFilteredOptionsForField("name_admin", originalEvents)} value={nameAdmin} onChange={handleNameAdminChange} placeholder="Asesor" className="form-control" />
            </div>

            <div className="col-md-4">
                <label>Filtrar por Proyecto</label>
                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={getFilteredOptionsForField("proyecto_lead", originalEvents)} value={proyectoLead} onChange={handleProyectoLeadChange} placeholder="Proyecto" className="form-control" />
            </div>

            <div className="col-md-4">
                <label>Filtrar por Campaña</label>
                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={getFilteredOptionsForField("campana_lead", originalEvents)} value={campanaLead} onChange={handleCampanaLeadChange} placeholder="Campaña" className="form-control" />
            </div>

            <div className="col-md-4">
                <label>Filtrar por Acción</label>
                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={getFilteredOptionsForField("accion_calendar", originalEvents)} value={accionCalendar} onChange={handleAccionCalendarChange} placeholder="Acción" className="form-control" />
            </div>

            <div className="col-md-4">
                <label>Filtrar por Tipo</label>
                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={getFilteredOptionsForField("tipo_calendar", originalEvents)} value={tipoCalendar} onChange={handleTipoCalendarChange} placeholder="Tipo" className="form-control" />
            </div>

            <div className="col-md-4">
                <label>Filtrar por Cita</label>
                <Select components={animatedComponents} isMulti closeMenuOnSelect={false} options={getFilteredOptionsForField("cita_lead", originalEvents)} value={citaLead} onChange={(selected) => setCitaLead(selected || [])} placeholder="Cita" className="form-control" />
            </div>
        </div>
    );
};

export default Filters;
