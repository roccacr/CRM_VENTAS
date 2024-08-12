export const EventosPendientes = () => {
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
                                        <th>Nombre del evento</th>
                                        <th>Leads </th>
                                        <th>Fecha Inicial</th>
                                        <th>Hora Inicial</th>
                                        <th>Estado </th>
                                        <th>Tipo</th>
                                        <th>Cita</th>
                                        <th>Proyecto</th>
                                        <th>Campaña</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>
                                            <div className="d-flex align-items-center">
                                                <div className="flex-shrink-0">
                                                    <img src="../assets/images/user/avatar-1.jpg" alt="user image" className="img-radius wid-40" />
                                                </div>
                                                <div className="flex-grow-1 ms-3">
                                                    <h6 className="mb-0">Airi Satou</h6>
                                                </div>
                                            </div>
                                        </td>
                                        <td>Salary Payment</td>
                                        <td>Salary Payment</td>
                                        <td>Salary Payment</td>
                                        <td>Salary Payment</td>
                                        <td>
                                            2023/02/07 <span className="text-muted text-sm d-block">09:05 PM</span>
                                        </td>
                                        <td>$950.54</td>
                                        <td>
                                            <span className="badge text-bg-success">Completed</span>
                                        </td>
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
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
