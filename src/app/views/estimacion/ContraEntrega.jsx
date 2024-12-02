

export const ContraEntrega = ({ formValues, handleInputChange }) => {
    return (
        <>
            <div className="row" hidden={formValues.custbody75_estimacion === "1" ? false : true}>
                <div className="col-sm-4">
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
                <div className="col-sm-4">
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
                <div className="col-sm-4">
                    <label className="form-label">Fecha Entrega</label>
                    <input
                        autoComplete="off"
                        type="date"
                        name="contra_enterega11_date"
                        value={formValues.contra_enterega11_date}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-4">
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
        </>
    );
};
