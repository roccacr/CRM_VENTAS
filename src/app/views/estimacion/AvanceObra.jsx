export const AvanceObra = ({ formValues, handleInputChange, errors }) => {
    return (
        <>
            <div className="row" hidden={parseInt(formValues.custbody75, 10) === 2 ? false : true}>
                <div className="col-sm-3">
                    <label className="form-label">HITO 1 %</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="custbody62"
                        value={formValues.custbody62}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="custbodyix_salesorder_hito1"
                        value={formValues.custbodyix_salesorder_hito1}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">HITO 2 %</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="custbody63"
                        value={formValues.custbody63}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="custbody_ix_salesorder_hito2"
                        value={formValues.custbody_ix_salesorder_hito2}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">HITO 3 %</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="custbody64"
                        value={formValues.custbody64}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="custbody_ix_salesorder_hito3"
                        value={formValues.custbody_ix_salesorder_hito3}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">HITO 4 %</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="custbody65"
                        value={formValues.custbody65}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="custbody_ix_salesorder_hito4"
                        value={formValues.custbody_ix_salesorder_hito4}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">HITO 5 %</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="custbody66"
                        value={formValues.custbody66}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="custbody_ix_salesorder_hito5"
                        value={formValues.custbody_ix_salesorder_hito5}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
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
                <div className="col-sm-3">
                    <label className="form-label">MONTO SIN PRIMA TOTAL</label>
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
