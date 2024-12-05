export const CalculodePrima = ({ formValues, handleInputChange, handleDiscountSelection, errors }) => {
    return (
        <>
            {/* PRIMA */}
            <div className="row" style={{ marginTop: "15px" }} /* Ajusta el valor según sea necesario */>
                <div className="col-sm-12">
                    <div role="alert" className="fade alert alert-dark show">
                        <p style={{ fontSize: "0.875em", color: "#000" }}>
                            <em>
                                {" "}
                                <u> SELECCIONÉ COMO VA A CALCULAR LA PRIMA</u>
                            </em>
                        </p>
                        <div className="col">
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    name="isDiscounted"
                                    type="radio"
                                    value="percentage"
                                    checked={formValues.isDiscounted === "percentage"}
                                    onChange={handleDiscountSelection}
                                />
                                <label className="form-check-label">
                                    <span>PORCENTAJE</span>
                                </label>
                            </div>
                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    name="isDiscounted"
                                    type="radio"
                                    value="amount"
                                    checked={formValues.isDiscounted === "amount"}
                                    onChange={handleDiscountSelection}
                                />
                                <label className="form-check-label">
                                    <span>MONTO</span>
                                </label>
                            </div>

                            <div className="form-check">
                                <input
                                    className="form-check-input"
                                    name="isDiscounted"
                                    type="radio"
                                    value=""
                                    checked={formValues.isDiscounted === null}
                                    onChange={handleDiscountSelection}
                                />
                                <label className="form-check-label">
                                    <span>NINGUNO</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* PRIMA TOTAL */}
            <div className="row">
                <div className="col-sm-4">
                    <label className="form-label">PRIMA TOTAL</label>
                    <input
                        autoComplete="off"
                        disabled={formValues.isDiscounted === null || formValues.isDiscounted === "percentage"}
                        type="text"
                        name="custbody39"
                        value={formValues.custbody39}
                        onChange={handleInputChange}
                        className={`form-control mb-2 ${errors.custbody39 ? "is-invalid" : ""}`}
                    />
                    {errors.custbody39 && <div className="invalid-feedback">{errors.custbody39}</div>}
                </div>
                <div className="col-sm-3">
                    <label className="form-label">PRIMA%</label>
                    <input
                        autoComplete="off"
                        disabled={formValues.isDiscounted === null || formValues.isDiscounted === "amount"}
                        type="text"
                        name="custbody60"
                        value={formValues.custbody60}
                        onChange={handleInputChange}
                        className={`form-control mb-2 ${errors.custbody60 ? "is-invalid" : ""}`}
                    />
                    {errors.custbody60 && <div className="invalid-feedback">{errors.custbody60}</div>}
                </div>
                <div className="col-sm-3">
                    <label className="form-label">MONTO PRIMA NETA</label>
                    <input
                        autoComplete="off"
                        type="text"
                        disabled
                        name="custbody_ix_salesorder_monto_prima"
                        value={formValues.custbody_ix_salesorder_monto_prima}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3" hidden>
                    <label className="form-label">TRACTO</label>
                    <input
                        autoComplete="off"
                        type="text"
                        disabled
                        name="custbody40"
                        value={formValues.custbody40}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">MONTO ASIGNABLE PRIMA NETA</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="neta"
                        value={formValues.neta}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
            </div>
        </>
    );
};
