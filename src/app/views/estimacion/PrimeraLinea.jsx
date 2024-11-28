export const PrimeraLinea = ({ formValues, handleInputChange }) => {
    return (
        <>
            <div className="row">
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
            <hr />
            <div className="row">
                <div className="col-sm-3">
                    <label className="form-label">ESTADO :</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="entitystatus"
                        value={formValues.entitystatus}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">OPORTUNIDAD</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="tranid_oport"
                        value={formValues.tranid_oport}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">CIERRE DE PREVISTO:</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="expectedclosedate"
                        value={formValues.expectedclosedate}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-2" style={{ marginTop: "15px" }}>
                    <input
                        autoComplete="off"
                        className="form-check-input"
                        type="checkbox"
                        id="PRERESERVA"
                        name="pre_reserva"
                        checked={formValues.pre_reserva}
                        onChange={handleInputChange}
                    />
                    <label className="form-check-label" style={{ marginLeft: "5px", marginTop: "3px" }}>
                        <span>PRE - RESERVA</span>
                    </label>
                </div>
            </div>
            <hr />
            <div className="row">
                <div className="col-sm-3">
                    <label className="form-label">RECIO DE LISTA:</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="custbody13"
                        value={formValues.custbody13}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">MONTO DESCUENTO DIRECTO:</label>
                    <input
                        autoComplete="off"
                        type="text"
                        name="custbody132"
                        value={formValues.custbody132}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">EXTRAS PAGADAS POR EL CLIENTE:</label>
                    <input
                        autoComplete="off"
                        type="text"
                        name="custbody46"
                        value={formValues.custbody46}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">DESCRIPCIÓN EXTRAS:</label>
                    <input
                        autoComplete="off"
                        type="text"
                        name="custbody47"
                        value={formValues.custbody47}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
            </div>
            <hr />
            <div className="row">
                <div className="col-sm-3">
                    <label className="form-label">CASHBACK</label>
                    <input
                        autoComplete="off"
                        type="text"
                        name="custbodyix_salesorder_cashback"
                        value={formValues.custbodyix_salesorder_cashback}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">MONTO RESERVA :</label>
                    <input
                        autoComplete="off"
                        type="text"
                        name="custbody52"
                        value={formValues.custbody52}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">MONTO TOTAL DE CORTESÍAS</label>
                    <input
                        autoComplete="off"
                        type="text"
                        name="custbody16"
                        value={formValues.custbody16}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">DESCRIPCIÓN DE LAS CORTESIAS</label>
                    <input
                        autoComplete="off"
                        type="text"
                        name="custbody35"
                        value={formValues.custbody35}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
            </div>
            <hr />
            <div className="row">
                <div className="col-sm-3">
                    <label className="form-label">PREC. DE VENTA MÍNIMO</label>
                    <input
                        autoComplete="off"
                        disabled
                        type="text"
                        name="custbody18"
                        value={formValues.custbody18}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">FECHA RESERVA:</label>
                    <input
                        autoComplete="off"
                        type="date"
                        name="fech_reserva"
                        value={formValues.fech_reserva}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">PEC. DE VENTA NETO:</label>
                    <input
                        autoComplete="off"
                        type="text"
                        disabled
                        name="pvneto"
                        value={formValues.pvneto}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">MONTO TOTAL</label>
                    <input
                        autoComplete="off"
                        type="text"
                        disabled
                        name="custbody_ix_total_amount"
                        value={formValues.custbody_ix_total_amount}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3" hidden>
                    <label className="form-label">EXTRAS SOBRE EL PRECIO DE LISTA</label>
                    <input
                        autoComplete="off"
                        type="text"
                        name="diferecia"
                        value={formValues.diferecia}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
            </div>
            <div className="row" hidden={!formValues.pre_reserva}>
                <hr />
                <h4>Agregar valores para Pre Reserva</h4>
                <div className="col-sm-3">
                    <label className="form-label">MONTO PRERESERVA</label>
                    <input
                        autoComplete="off"
                        type="text"
                        name="custbody191"
                        value={formValues.custbody191}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">COMPROBANTE PRERESERVA</label>
                    <input
                        autoComplete="off"
                        type="text"
                        name="pre_3"
                        value={formValues.pre_3}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">FECHA DE PRERESERVA</label>
                    <input
                        autoComplete="off"
                        type="date"
                        name="pre_5"
                        value={formValues.pre_5}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">OBSERVACIONES PRERESERVA</label>
                    <input
                        autoComplete="off"
                        type="text"
                        name="pre_8"
                        value={formValues.pre_8}
                        onChange={handleInputChange}
                        className={`form-control mb-2`}
                    />
                </div>
                <div className="col-sm-3">
                    <label className="form-label">METODO DE PAGO</label>
                    <select className="form-select" value={formValues.custbody188} name="custbody188" onChange={handleInputChange}>
                        <option value="">Selecione un Metodo de pago</option>
                        <option value="3">Cheque</option>
                        <option value="2">Efectivo</option>
                        <option value="4">Paypal</option>
                        <option value="5">Tarjeta de Credito</option>
                        <option value="6">Tarjeta de Débito</option>
                        <option value="1">Transferencia</option>
                    </select>
                </div>
            </div>
        </>
    );
};
