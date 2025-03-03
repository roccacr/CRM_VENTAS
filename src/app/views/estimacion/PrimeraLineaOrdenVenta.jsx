export const PrimeraLineaOrdenVenta = ({ formValues, handleInputChange, errors }) => {
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
            <div className="col-sm-3" hidden>
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
            <div className="col-sm-3">
               <label className="form-label">Ubicacion :</label>
               <input
                  autoComplete="off"
                  disabled
                  type="text"
                  name="Ubi"
                  value={formValues.Ubi}
                  onChange={handleInputChange}
                  className={`form-control mb-2`}
               />
            </div>
         </div>
         <hr />
         <div className="row">
            <div className="col-sm-3" hidden>
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
               <label className="form-label">Clase :</label>
               <input
                  autoComplete="off"
                  disabled
                  type="text"
                  name="Clase"
                  value={formValues.Clase}
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
                  <span>RESERVA</span>
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
                  name="custbody185"
                  value={formValues.custbody185}
                  onChange={handleInputChange}
                  className={`form-control mb-2`}
               />
            </div>
         </div>
         <div className="row" hidden={!formValues.pre_reserva}>
            <hr />
            <h4>Agregar valores para Reserva</h4>

            <div className="col-sm-3">
               <label className="form-label">MONTO RESERVA APLICADA</label>
               <input
                  autoComplete="off"
                  type="text"
                  name="custbody207"
                  value={formValues.custbody207}
                  onChange={handleInputChange}
                  className={`form-control mb-2 ${errors.custbody207 ? "is-invalid" : ""}`}
               />
               {errors.custbody207 && <div className="invalid-feedback">{errors.custbody207}</div>}
            </div>
            <div className="col-sm-3">
               <label className="form-label">COMPROBANTE RESERVA</label>
               <input
                  autoComplete="off"
                  type="text"
                  name="custbody189"
                  value={formValues.custbody189}
                  onChange={handleInputChange}
                  className={`form-control mb-2 ${errors.custbody189 ? "is-invalid" : ""}`}
               />
               {errors.custbody189 && <div className="invalid-feedback">{errors.custbody189}</div>}
            </div>
            <div className="col-sm-3">
               <label className="form-label">FECHA DE RESERVA APLICADA</label>
               <input
                  autoComplete="off"
                  type="date"
                  name="custbody208"
                  value={formValues.custbody208}
                  onChange={handleInputChange}
                  className={`form-control mb-2 ${errors.custbody208 ? "is-invalid" : ""}`}
               />
               {errors.custbody208 && <div className="invalid-feedback">{errors.custbody208}</div>}
            </div>

            <div className="col-sm-3">
               <label className="form-label">OBSERVACIONES RESERVA</label>
               <input
                  autoComplete="off"
                  type="text"
                  name="custbody190"
                  value={formValues.custbody190}
                  onChange={handleInputChange}
                  className={`form-control mb-2 ${errors.custbody190 ? "is-invalid" : ""}`}
               />
               {errors.custbody190 && <div className="invalid-feedback">{errors.custbody190}</div>}
            </div>
            <div className="col-sm-3">
               <label className="form-label">ENTREGA ESTIMADA:</label>
               <input
                  autoComplete="off"
                  type="date"
                  name="custbody114"
                  value={formValues.custbody114}
                  onChange={handleInputChange}
                  className={`form-control mb-2 ${errors.custbody114 ? "is-invalid" : ""}`}
               />
               {errors.custbody114 && <div className="invalid-feedback">{errors.custbody114}</div>}
            </div>
            <div className="col-sm-3">
               <label className="form-label">FECHA DE VIGENCIA DE LA VENTA:</label>
               <input
                  autoComplete="off"
                  type="date"
                  name="saleseffectivedate"
                  value={formValues.saleseffectivedate}
                  onChange={handleInputChange}
                  className={`form-control mb-2 ${errors.saleseffectivedate ? "is-invalid" : ""}`}
               />
               {errors.saleseffectivedate && <div className="invalid-feedback">{errors.saleseffectivedate}</div>}
            </div>
            <div className="col-sm-3">
               <label className="form-label">COMISIÓN DEL ASESOR %</label>
               <input
                  autoComplete="off"
                  type="text"
                  name="custbody20"
                  value={formValues.custbody20}
                  onChange={handleInputChange}
                  className={`form-control mb-2 ${errors.custbody20 ? "is-invalid" : ""}`}
               />
               {errors.custbody20 && <div className="invalid-feedback">{errors.custbody20}</div>}
            </div>
            <div className="col-sm-3">
               <label className="form-label">% COMISIÓN DEL CORREDOR</label>
               <input
                  autoComplete="off"
                  type="text"
                  name="custbody14"
                  value={formValues.custbody14}
                  onChange={handleInputChange}
                  className={`form-control mb-2 ${errors.custbody14 ? "is-invalid" : ""}`}
               />
               {errors.custbody14 && <div className="invalid-feedback">{errors.custbody14}</div>}
            </div>

            <div className="col-sm-3">
               <label className="form-label">FONDOS DE COMPRA</label>
               <select className="form-select" value={formValues.custbody37} name="custbody37" onChange={handleInputChange}>
                  <option value="">Selecionar metodo de fondo</option>
                  <option value="1">Propios</option>
                  <option value="2">Financiado</option>
               </select>
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

            <div className="col-sm-3">
               <label className="form-label">MOTIVO DE CANCELACIÓN DE RESERVA O VENTA CAIDA</label>
               <select className="form-select" value={formValues.custbody115} name="custbody115" onChange={handleInputChange}>
                  <option value="">Selecione un Motivo</option>
                  <option value="2">Inconformidad - Cambios en proyecto</option>
                  <option value="3">Inconformidad - Distribución</option>
                  <option value="1">Inconformidad - Fecha de entrega</option>
                  <option value="12">Incumplimiento contractual</option>
                  <option value="10">Mejor Oferta</option>
                  <option value="13">Motivo de empresa - Proyecto pospuesto</option>
                  <option value="9">Motivo Financiero - Condiciones bancarias</option>
                  <option value="8">Motivo Financiero - Dependencia venta de propiedad</option>
                  <option value="14">Motivo Laboral</option>
                  <option value="6">Motivo Personal - Económico</option>
                  <option value="5">Motivo Personal - Familiar</option>
                  <option value="4">Motivo Personal - Salud</option>
                  <option value="7">Motivo Personal - Sin Especificar</option>
                  <option value="11">No sujeto a crédito</option>
                  <option value="15">Traslado de FF/proyecto</option>
               </select>
            </div>

            <div className="col-sm-3">
               <label className="form-label">COMENTARIOS CANCELACIÓN DE RESERVA</label>
               <input
                  autoComplete="off"
                  type="text"
                  name="custbody116"
                  value={formValues.custbody116}
                  onChange={handleInputChange}
                  className={`form-control mb-2 ${errors.custbody116 ? "is-invalid" : ""}`}
               />
               {errors.custbody14 && <div className="invalid-feedback">{errors.custbody116}</div>}
            </div>
            <div className="col-sm-3">
               <label className="form-label">NOTA</label>
               <textarea
                  autoComplete="off"
                  name="memo"
                  value={formValues.memo}
                  onChange={handleInputChange}
                  className={`form-control mb-2 ${errors.memo ? "is-invalid" : ""}`}
                  rows="3"
               />
               {errors.memo && <div className="invalid-feedback">{errors.memo}</div>}
            </div>

            <br />
            <br />
            <hr />

            <div className="col-sm-3">
               <label className="form-label">MONTO PRERESERVA</label>
               <input
                  autoComplete="off"
                  type="text"
                  name="custbody191"
                  value={formValues.custbody191}
                  onChange={handleInputChange}
                  className={`form-control mb-2 ${errors.custbody191 ? "is-invalid" : ""}`}
               />
               {errors.custbody191 && <div className="invalid-feedback">{errors.custbody191}</div>}
            </div>
            <div className="col-sm-3" hidden>
               <label className="form-label">COMPROBANTE PRERESERVA</label>
               <input
                  autoComplete="off"
                  type="text"
                  name="custbody189"
                  value={formValues.custbody189}
                  onChange={handleInputChange}
                  className={`form-control mb-2 ${errors.custbody189 ? "is-invalid" : ""}`}
               />
               {errors.custbody189 && <div className="invalid-feedback">{errors.custbody189}</div>}
            </div>
            <div className="col-sm-3">
               <label className="form-label">FECHA DE PRERESERVA</label>
               <input
                  autoComplete="off"
                  type="date"
                  name="custbody206"
                  value={formValues.custbody206}
                  onChange={handleInputChange}
                  className={`form-control mb-2 ${errors.custbody206 ? "is-invalid" : ""}`}
               />
               {errors.custbody206 && <div className="invalid-feedback">{errors.custbody206}</div>}
            </div>
            <div className="col-sm-3" hidden>
               <label className="form-label">OBSERVACIONES PRERESERVA</label>
               <input
                  autoComplete="off"
                  type="text"
                  name="custbody190"
                  value={formValues.custbody190}
                  onChange={handleInputChange}
                  className={`form-control mb-2 ${errors.custbody190 ? "is-invalid" : ""}`}
               />
               {errors.custbody190 && <div className="invalid-feedback">{errors.custbody190}</div>}
            </div>
         </div>
      </>
   );
};
