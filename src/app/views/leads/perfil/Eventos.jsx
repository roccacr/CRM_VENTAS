export const Eventos = () => {
    return (
        <>
            {" "}
            <div className="card">
                <div className="card-header">
                    <h5>Lista de eventos del cliente</h5>
                </div>
                <div className="card-body">
                    <p className="mb-0">Aquí se desglosa todos los eventos relacionado con este cliente</p>
                </div>
            </div>
            <div className="card">
                <div className="card-header">
                    <h5>Eventos</h5>
                </div>
                <div className="card-body">
                    <table className="table table-striped">
                        <thead>
                            <tr>
                                <th scope="col">Nombre Evento</th>
                                <th scope="col">Tipo</th>
                                <th scope="col">Estado</th>
                            </tr>
                        </thead>

                        <tbody>
                            <tr>
                                <td>Evento 1</td>
                                <td>Reunión</td>
                                <td>Completado</td>
                            </tr>
                            <tr>
                                <td>Evento 1</td>
                                <td>Reunión</td>
                                <td>Completado</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
};
