export const Seguimiento = ({ BitacoraLeads }) => {
    const formatDate = (dateString) => {
        const date = new Date(dateString);

        // Ajustar la fecha a la zona horaria de Costa Rica (UTC-6)
        const localDate = new Date(date.getTime() - 6 * 60 * 60 * 1000);

        // Extraer año, mes y día
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, "0");
        const day = String(localDate.getDate()).padStart(2, "0");

        // Extraer horas, minutos y segundos, ajustando al formato de 12 horas
        let hours = localDate.getHours();
        const minutes = String(localDate.getMinutes()).padStart(2, "0");
        const seconds = String(localDate.getSeconds()).padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12; // Si la hora es '0', que sea '12'
        hours = String(hours).padStart(2, "0");

        const formattedDate = `${year}-${month}-${day}`;
        const formattedTime = `${hours}:${minutes}:${seconds} ${ampm}`;

        return { formattedDate, formattedTime };
    };
    const sortedBitacora = [...BitacoraLeads].sort((a, b) => new Date(b.fecha_creado_bit) - new Date(a.fecha_creado_bit));

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h5>Historial de Seguimiento del Cliente</h5>
                </div>
                <div className="card-body">
                    <p className="mb-0">Resumen detallado de todas las acciones y seguimientos realizados por el asesor con este cliente, incluyendo notas y detalles específicos de cada interacción.</p>
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
                                // Extrae el texto después del primer "-"
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
                                                <h6 className="mb-0 me-2"> {formattedDate} </h6>
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
