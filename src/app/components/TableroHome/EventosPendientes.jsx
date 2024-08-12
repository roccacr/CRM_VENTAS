import { useSelector } from "react-redux";
import { selectEventsForTodayAndTomorrow } from "../../../store/leads/LeadsSlice";

export const EventosPendientes = () => {
    const selectEvents = useSelector(selectEventsForTodayAndTomorrow);

    // Verifica si selectEvents tiene elementos
    if (!selectEvents || selectEvents.length === 0) {
        return null; // No mostrar nada si selectEvents está vacío
    }

    return (
        <>
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
                                <tbody>
                                    {selectEvents.map((event, index) => (
                                        <tr key={index}>
                                            <td>{event.nombre_calendar}</td>
                                            <td>{event.cliente}</td>
                                            <td>{event.fechaInicial}</td>
                                            <td>{event.horaInicial}</td>
                                            <td>{event.estado}</td>
                                            <td>{event.tipo}</td>
                                            <td>{event.cita}</td>
                                            <td>{event.proyecto}</td>
                                            <td>{event.campaña}</td>
                                            <td>
                                                <a href="#" className="avtar avtar-xs btn-link-secondary">
                                                    <i className="ti ti-eye f-20"></i>
                                                </a>
                                                <a href="#" className="avtar avtar-xs btn-link-secondary">
                                                    <i className="ti ti-edit f-20"></i>
                                                </a>
                                                <a href="#" className="avtar avtar-xs btn-link-secondary">
                                                    <i className="ti ti-trash f-20"></i>
                                                </a>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
