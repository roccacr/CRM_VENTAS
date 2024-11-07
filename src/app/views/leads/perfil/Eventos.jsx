import { useEffect, useState, useCallback } from "react";
import { useDispatch } from "react-redux";
import { obtenerEventosCliente } from "../../../../store/calendar/thunkscalendar";
import { useNavigate } from "react-router-dom";

export const Eventos = ({ leadDetails }) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [events, setEvents] = useState([]); // Estado para almacenar los eventos asociados al lead.

    // Función asíncrona memorizada para obtener eventos específicos del cliente basado en el ID del lead.
    const fetchClientEvents = useCallback(
        async (leadDetails) => {
            try {
                // Dispatch para obtener los eventos del cliente, retorna los datos de eventos
                const leadData = await dispatch(obtenerEventosCliente(leadDetails));
                setEvents(leadData || []); // Actualiza el estado de 'events' con los eventos obtenidos
            } catch (error) {
                console.error("Error fetching client events:", error); // Manejo de errores en caso de fallo
            }
        },
        [dispatch],
    ); // Incluye 'dispatch' como dependencia, ya que es una función externa

    useEffect(() => {
        // Llama a la función al cargar el componente o cuando cambia el ID del lead
        fetchClientEvents(leadDetails);
    }, [leadDetails, fetchClientEvents]); // Incluye 'fetchClientEvents' como dependencia

    const handleEventClick = (idCalendar, idLead) => {
        navigate(`/events/actions?idCalendar=${idCalendar}&idLead=${idLead}&idDate=0`);
    };
    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h5>Lista de eventos del cliente</h5>
                </div>
                <div className="card-body">
                    <p className="mb-0">Aquí se desglosan todos los eventos relacionados con este cliente</p>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h5>Eventos</h5>
                </div>
                <div className="card-body">
                    <div className="table-responsive">
                        <table className="table table-striped table dt-responsive w-100 display text-left" style={{ fontSize: "15px", width: "100%", textAlign: "left" }}>
                            <thead>
                                <tr>
                                    <th scope="col">Evento</th>
                                    <th scope="col">Acción</th>
                                    <th scope="col">Tipo de evento</th>
                                    <th scope="col">Fecha</th>
                                    <th scope="col">Hora</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((evento, index) => (
                                    <tr key={index} onClick={() => handleEventClick(evento.id_calendar, evento.id_lead)}>
                                        <td>{evento.nombre_calendar}</td>
                                        <td>{evento.accion_calendar}</td>
                                        <td>{evento.tipo_calendar}</td>
                                        <td>{evento.fechaIni_calendar}</td>
                                        <td>{evento.horaInicio_calendar}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );
};
