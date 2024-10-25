export const Oportunidades = () => {
    return (
        <>
            {" "}
            <div className="card">
                <div className="card-header">
                    <h5>Lista de Oportunidades del cliente</h5>
                </div>
                <div className="card-body">
                    <p className="mb-0">Aquí se desglosa todos los Oportunidades relacionado con este cliente</p>
                </div>
            </div>
            <div className="card">
                <div className="card-header">
                    <h5>Oportunidades</h5>
                </div>
                <div className="card-body">
                    <table className="table table-striped">
                        <thead>
                            <tr>
                                <th scope="col">#Oportuinidad</th>
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
