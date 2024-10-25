export const InfromacionCompleta = ({ leadDetails }) => {
    return (
        <>
            {" "}
            <div className="card">
                <div className="card-header">
                    <h5>Informacion Completa</h5>
                </div>
                <div className="card-body">
                    <p className="mb-0">Desglose de infromacion relacionada al cliente</p>
                </div>
            </div>
            <div className="card">
                <div className="card-header">
                    <h5>Rsemun de Informacion</h5>
                </div>
                <div className="card-body">
                    <ul className="list-group list-group-flush">
                        <li className="list-group-item px-0">
                            <div className="row">
                                <div className="col-md-6">
                                    <p className="mb-1 text-muted">Nombre Completo</p>
                                    <p className="mb-0">{leadDetails.nombre_lead}</p>
                                </div>
                                <div className="col-md-6">
                                    <p className="mb-1 text-muted">Proyecto</p>
                                    <p className="mb-0">{leadDetails.proyecto_lead}</p>
                                </div>
                            </div>
                        </li>
                        <li className="list-group-item px-0">
                            <div className="row">
                                <div className="col-md-6">
                                    <p className="mb-1 text-muted">Campaña</p>
                                    <p className="mb-0">{leadDetails.campana_lead}</p>
                                </div>
                                <div className="col-md-6">
                                    <p className="mb-1 text-muted">Comentario</p>
                                    <p className="mb-0">{leadDetails.comentario_lead}</p>
                                </div>
                            </div>
                        </li>

                        <li className="list-group-item px-0">
                            <div className="row">
                                <div className="col-md-6">
                                    <p className="mb-1 text-muted">Estado Interesado</p>
                                    <p className="mb-0">{leadDetails.estadointeresado_lead}</p>
                                </div>
                                <div className="col-md-6">
                                    <p className="mb-1 text-muted">Correo</p>
                                    <p className="mb-0">{leadDetails.email_lead}</p>
                                </div>
                            </div>
                        </li>

                        <li className="list-group-item px-0">
                            <div className="row">
                                <div className="col-md-6">
                                    <p className="mb-1 text-muted">Teléfono</p>
                                    <p className="mb-0">{leadDetails.telefono_lead}</p>
                                </div>
                                <div className="col-md-6">
                                    <p className="mb-1 text-muted">Subsidiaria</p>
                                    <p className="mb-0">{leadDetails.subsidiaria_lead}</p>
                                </div>
                            </div>
                        </li>
                    </ul>
                    <hr/>
                    <h5>Infirmacion extra</h5>
                    <ul className="list-group list-group-flush">
                        <li className="list-group-item px-0">
                            <div className="row">
                                <div className="col-md-6">
                                    <p className="mb-1 text-muted">Hijos</p>
                                    <p className="mb-0">2</p>
                                </div>
                                <div className="col-md-6">
                                    <p className="mb-1 text-muted">Profescion</p>
                                    <p className="mb-0">inge</p>
                                </div>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </>
    );
};
