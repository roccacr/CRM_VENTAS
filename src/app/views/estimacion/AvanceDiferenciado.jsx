export const AvanceDiferenciado = ({ formValues, handleInputChange }) => {
    return (
        <>
            <div className="row" hidden={parseInt(formValues.custbody75, 10) === 7 ? false : true}>
                <div className="col-sm-3">
                    <input
                        autoComplete="off"
                        className="form-check-input"
                        type="checkbox"
                        name="hito_chek_uno"
                        checked={formValues.hito_chek_uno}
                        onChange={handleInputChange}
                    />
                    <label className="form-label">HITO 1 %</label>
                    <input
                        disabled={formValues.hito_chek_uno ? false : true}
                        autoComplete="off"
                        type="text"
                        name="custbody62"
                        value={formValues.custbody62}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        disabled={formValues.hito_chek_uno ? false : true}
                        autoComplete="off"
                        type="text"
                        name="custbodyix_salesorder_hito1"
                        value={formValues.custbodyix_salesorder_hito1}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        disabled={formValues.hito_chek_uno ? false : true}
                        autoComplete="off"
                        type="date"
                        name="date_hito_1"
                        value={formValues.date_hito_1}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <input
                        autoComplete="off"
                        className="form-check-input"
                        type="checkbox"
                        name="hito_chek_dos"
                        checked={formValues.hito_chek_dos}
                        onChange={handleInputChange}
                    />
                    <label className="form-label">HITO 2 %</label>
                    <input
                        disabled={formValues.hito_chek_dos ? false : true}
                        autoComplete="off"
                        type="text"
                        name="custbody63"
                        value={formValues.custbody63}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        disabled={formValues.hito_chek_dos ? false : true}
                        autoComplete="off"
                        type="text"
                        name="custbody_ix_salesorder_hito2"
                        value={formValues.custbody_ix_salesorder_hito2}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        disabled={formValues.hito_chek_dos ? false : true}
                        autoComplete="off"
                        type="date"
                        name="date_hito_2"
                        value={formValues.date_hito_2}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <input
                        autoComplete="off"
                        className="form-check-input"
                        type="checkbox"
                        name="hito_chek_tres"
                        checked={formValues.hito_chek_tres}
                        onChange={handleInputChange}
                    />
                    <label className="form-label">HITO 3 %</label>
                    <input
                        disabled={formValues.hito_chek_tres ? false : true}
                        autoComplete="off"
                        type="text"
                        name="custbody64"
                        value={formValues.custbody64}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        disabled={formValues.hito_chek_tres ? false : true}
                        autoComplete="off"
                        type="text"
                        name="custbody_ix_salesorder_hito3"
                        value={formValues.custbody_ix_salesorder_hito3}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        disabled={formValues.hito_chek_tres ? false : true}
                        autoComplete="off"
                        type="date"
                        name="date_hito_3"
                        value={formValues.date_hito_3}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <input
                        autoComplete="off"
                        className="form-check-input"
                        type="checkbox"
                        name="hito_chek_cuatro"
                        checked={formValues.hito_chek_cuatro}
                        onChange={handleInputChange}
                    />
                    <label className="form-label">HITO 4 %</label>
                    <input
                        disabled={formValues.hito_chek_cuatro ? false : true}
                        autoComplete="off"
                        type="text"
                        name="custbody65"
                        value={formValues.custbody65}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        disabled={formValues.hito_chek_cuatro ? false : true}
                        autoComplete="off"
                        type="text"
                        name="custbody_ix_salesorder_hito4"
                        value={formValues.custbody_ix_salesorder_hito4}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        disabled={formValues.hito_chek_cuatro ? false : true}
                        autoComplete="off"
                        type="date"
                        name="date_hito_4"
                        value={formValues.date_hito_4}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <input
                        autoComplete="off"
                        className="form-check-input"
                        type="checkbox"
                        name="hito_chek_cinco"
                        checked={formValues.hito_chek_cinco}
                        onChange={handleInputChange}
                    />
                    <label className="form-label">HITO 5 %</label>
                    <input
                        disabled={formValues.hito_chek_cinco ? false : true}
                        autoComplete="off"
                        type="text"
                        name="custbody66"
                        value={formValues.custbody66}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        autoComplete="off"
                        type="text"
                        disabled={formValues.hito_chek_cinco ? false : true}
                        name="custbody_ix_salesorder_hito5"
                        value={formValues.custbody_ix_salesorder_hito5}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        autoComplete="off"
                        type="date"
                        disabled={formValues.hito_chek_cinco ? false : true}
                        name="date_hito_5"
                        value={formValues.date_hito_5}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <input
                        autoComplete="off"
                        className="form-check-input"
                        type="checkbox"
                        name="hito_chek_seis"
                        checked={formValues.hito_chek_seis}
                        onChange={handleInputChange}
                    />
                    <label className="form-label">HITO 6 %</label>
                    <input
                        disabled={formValues.hito_chek_seis ? false : true}
                        autoComplete="off"
                        type="text"
                        name="custbody67"
                        value={formValues.custbody67}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        disabled={formValues.hito_chek_seis ? false : true}
                        autoComplete="off"
                        type="text"
                        name="custbody_ix_salesorder_hito6"
                        value={formValues.custbody_ix_salesorder_hito6}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                    <input
                        disabled={formValues.hito_chek_seis ? false : true}
                        autoComplete="off"
                        type="date"
                        name="date_hito_6"
                        value={formValues.date_hito_6}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>

                <div className="col-sm-3">
                    <label className="form-label">MONTO SIN PRIMA TOTAL</label>
                    <input
                        disabled
                        autoComplete="off"
                        type="text"
                        name="custbody163"
                        value={formValues.custbody163}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />

                    <label className="form-label">% POR ASIGNAR</label>
                    <input
                        disabled
                        autoComplete="off"
                        type="text"
                        name="total_porcentaje"
                        value={formValues.total_porcentaje}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>

                <div className="col-sm-3">
                    <label className="form-label">PENDIENTE POR ASIGNAR</label>
                    <input
                        disabled
                        autoComplete="off"
                        type="number"
                        name="valortotals"
                        value={formValues.valortotals}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
            </div>
        </>
    );
};
