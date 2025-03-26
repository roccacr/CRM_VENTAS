export const ContraEntrega = ({ formValues, handleInputChange, errors }) => {
    return (
        <>
            <div className="row" hidden={parseInt(formValues.custbody75, 10) === 1 ? false : true}>
                <div className="col-sm-4">
                    <label className="form-label">HITO 6 %</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="custbody67"
                        value={formValues.custbody67}
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
                        name="custbody_ix_salesorder_hito6"
                        value={formValues.custbody_ix_salesorder_hito6}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-4">
                    <label className="form-label">Fecha Entrega</label>
                    <input
                        autoComplete="off"
                        type="text"
                        name="date_hito_6"
                        value={formValues.date_hito_6}
                        onChange={handleInputChange}
                        className={`form-control mb-2 ${errors.date_hito_6 ? "is-invalid" : ""}`}
                    />
                    {errors.date_hito_6 && <div className="invalid-feedback">{errors.date_hito_6}</div>}
                </div>
                <div className="col-sm-4">
                    <label className="form-label"> MONTO SIN PRIMA TOTAL:</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="custbody163"
                        value={formValues.custbody163}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
            </div>
        </>
    );
};
