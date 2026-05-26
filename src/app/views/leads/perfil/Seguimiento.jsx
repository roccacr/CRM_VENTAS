import { formatDate } from "../../../../hook/useFormatDate";

export const Seguimiento = ({ BitacoraLeads }) => {
    const sortedBitacora = [...BitacoraLeads].sort((a, b) => new Date(b.fecha_creado_bit) - new Date(a.fecha_creado_bit));

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h5>Historial de Seguimiento del Cliente</h5>
                </div>
                <div className="card-body">
                    <p className="mb-0">Resumen detallado de todas las acciones y seguimientos realizados por el asesor con este cliente, incluyendo notas y detalles especificos de cada interaccion.</p>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h5>Bitacora Seguimiento</h5>
                </div>
                <div className="card-body">
                    <div className="row">
                        {sortedBitacora.length > 0 ? (
                            sortedBitacora.map((entry, idx) => {
                                const estadoTexto = entry.estado_bit.split("-").slice(1).join("-");
                                const { formattedDate, formattedTime } = formatDate(entry.fecha_creado_bit);

                                return (
                                    <div className="col-xl-4 col-sm-6" key={idx}>
                                        <div className="statistics-card-1 card">
                                            <div className="card-header d-flex align-items-center justify-content-between py-3">
                                                <h5>{estadoTexto}</h5>
                                            </div>

                                            <div className="card-body">
                                                <img alt="img" width="63" height="134" decoding="async" data-nimg="1" className="img-fluid img-bg" src="https://light-able-react-light.vercel.app/_next/static/media/img-status-2.4d72f177.svg" style={{ color: "transparent" }} />
                                                <div className="d-flex align-items-center">
                                                    <h5 className="f-w-300 d-flex align-items-center m-b-0">Detalles</h5>
                                                </div>
                                                <h6 className="mb-0">Accion: </h6> {entry.detalle_bit}
                                                <h6 className="mb-0">Motivo: </h6> {entry.nombre_caida}
                                                <br />
                                                <h6 className="mb-0 me-2">{formattedDate} {formattedTime}</h6>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p>No hay acciones recientes para este lead.</p>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
