
export const MetodoPago = ({ formValues, handleInputChange }) => {
    return (
        <>
            <div className="row" style={{ marginTop: "15px" }} /* Ajusta el valor según sea necesario */>
                <div className="col-sm-12">
                    <div role="alert" className="fade alert alert-dark show">
                        <p style={{ fontSize: "0.875em", color: "#000" }}>
                            <em>
                                {" "}
                                <u> METODO DE PAGO</u>
                            </em>
                        </p>
                        <div className="col">
                            <div className="col-sm-3">
                                <select
                                    className="form-select"
                                    value={formValues.custbody75_estimacion}
                                    name="custbody75_estimacion"
                                    onChange={handleInputChange}
                                >
                                    <option value="">Selecione un Metodo de pago</option>
                                    <option value="2">Avance De Obra</option>
                                    <option value="7">Avance Diferenciado</option>
                                    <option value="1">Contra Entrega</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="row" hidden={formValues.custbody75_estimacion === "1" ? false: true }>
                        <div className="col-sm-3">
                            <label className="form-label">Entrega Fecha</label>
                            <input
                                autoComplete="off"
                                disabled
                                type="text"
                                name="custbody114"
                                value={formValues.custbody114}
                                onChange={handleInputChange}
                                className={`form-control mb-2`}
                            />
                        </div>
                        <div className="col-sm-3">
                            <label className="form-label">Nombre cliente:</label>
                            <input
                                autoComplete="off"
                                disabled
                                type="text"
                                name="entity"
                                value={formValues.entity}
                                onChange={handleInputChange}
                                className={`form-control mb-2`}
                            />
                        </div>
                        <div className="col-sm-3">
                            <label className="form-label">UNI. EXPED. LIGADO VTA:</label>
                            <input
                                autoComplete="off"
                                disabled
                                type="text"
                                name="custbody38"
                                value={formValues.custbody38}
                                onChange={handleInputChange}
                                className={`form-control mb-2`}
                            />
                        </div>
                        <div className="col-sm-3">
                            <label className="form-label">PROYECTO:</label>
                            <input
                                autoComplete="off"
                                disabled
                                type="text"
                                name="proyecto_lead_est"
                                value={formValues.proyecto_lead_est}
                                onChange={handleInputChange}
                                className={`form-control mb-2`}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};
