
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
                    <div className="row" hidden={formValues.custbody75_estimacion === "1" ? false : true}>
                        <div className="col-sm-3">
                            <label className="form-label">HITO 6 %</label>
                            <input
                                autoComplete="off"
                                disabled
                                type="text"
                                name="contra_enterega11"
                                value={formValues.contra_enterega11}
                                onChange={handleInputChange}
                                className={`form-control mb-2`}
                            />
                        </div>
                        <div className="col-sm-3">
                            <label className="form-label">Monto Calculado:</label>
                            <input
                                autoComplete="off"
                                disabled
                                type="text"
                                name="contra_enterega1"
                                value={formValues.contra_enterega1}
                                onChange={handleInputChange}
                                className={`form-control mb-2`}
                            />
                        </div>
                        <div className="col-sm-3">
                            <label className="form-label">Fecha Entrega</label>
                            <input
                                autoComplete="off"
                                disabled
                                type="date"
                                name="contra_enterega11_date"
                                value={formValues.contra_enterega11_date}
                                onChange={handleInputChange}
                                className={`form-control mb-2`}
                            />
                        </div>
                        <div className="col-sm-3">
                            <label className="form-label"> MONTO SIN PRIMA TOTAL:</label>
                            <input
                                autoComplete="off"
                                disabled
                                type="text"
                                name="mspt_contra_entrega"
                                value={formValues.mspt_contra_entrega}
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
