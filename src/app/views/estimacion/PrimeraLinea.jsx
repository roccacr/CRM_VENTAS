const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "Selecione un Metodo de pago" },
  { value: "3", label: "Cheque" },
  { value: "2", label: "Efectivo" },
  { value: "4", label: "Paypal" },
  { value: "5", label: "Tarjeta de Credito" },
  { value: "6", label: "Tarjeta de Debito" },
  { value: "1", label: "Transferencia" },
];

const READONLY_FIELDS = [
  { name: "custbody114", label: "Entrega Fecha" },
  { name: "entity", label: "Nombre cliente" },
  { name: "custbody38", label: "Uni. exped. ligado vta" },
  { name: "proyecto_lead_est", label: "Proyecto" },
  { name: "entitystatus", label: "Estado" },
  { name: "tranid_oport", label: "Oportunidad" },
  { name: "expectedclosedate", label: "Cierre de previsto" },
  { name: "custbody13", label: "Precio de lista" },
  { name: "custbody18", label: "Prec. de venta minimo" },
  { name: "pvneto", label: "Pec. de venta neto" },
  { name: "custbody_ix_total_amount", label: "Monto total" },
];

const EDITABLE_FIELDS = [
  [
    { name: "custbody132", label: "Monto descuento directo", type: "text" },
    { name: "custbody46", label: "Extras pagadas por el cliente", type: "text" },
    { name: "custbody47", label: "Descripcion extras", type: "text" },
  ],
  [
    { name: "custbodyix_salesorder_cashback", label: "Cashback", type: "text" },
    { name: "custbody52", label: "Monto reserva", type: "text" },
    { name: "custbody16", label: "Monto total de cortesias", type: "text" },
    { name: "custbody35", label: "Descripcion de las cortesias", type: "text" },
  ],
  [
    { name: "fech_reserva", label: "Fecha reserva", type: "date" },
  ],
];

const PRE_RESERVA_FIELDS = [
  { name: "custbody191", label: "Monto prereserva", type: "text" },
  { name: "custbody189", label: "Comprobante prereserva", type: "text" },
  { name: "custbody206", label: "Fecha de prereserva", type: "date" },
  { name: "custbody190", label: "Observaciones prereserva", type: "text" },
];

const FieldInput = ({
  field,
  formValues,
  handleInputChange,
  errors,
  disabled = false,
}) => (
  <div className="col-sm-3">
    <label className="form-label">{field.label}</label>
    <input
      autoComplete="off"
      disabled={disabled}
      readOnly={disabled}
      type={field.type}
      name={field.name}
      value={formValues[field.name] || ""}
      onChange={handleInputChange}
      className={`form-control mb-2 ${errors[field.name] ? "is-invalid" : ""}`}
    />
    {errors[field.name] ? (
      <div className="invalid-feedback">{errors[field.name]}</div>
    ) : null}
  </div>
);

export const PrimeraLinea = ({
  formValues,
  handleInputChange,
  errors,
  compactReadonly = false,
  hideContextFields = false,
}) => {
  return (
    <>
      {!compactReadonly && !hideContextFields ? (
        <>
          <div className="row">
            {READONLY_FIELDS.slice(0, 4).map((field) => (
              <FieldInput
                key={field.name}
                field={field}
                formValues={formValues}
                handleInputChange={handleInputChange}
                errors={errors}
                disabled
              />
            ))}
          </div>

          <hr />

          <div className="row">
            {READONLY_FIELDS.slice(4, 8).map((field) => (
              <FieldInput
                key={field.name}
                field={field}
                formValues={formValues}
                handleInputChange={handleInputChange}
                errors={errors}
                disabled
              />
            ))}
          </div>

          <hr />
        </>
      ) : null}

      <div className="row align-items-end">
        {!compactReadonly && !hideContextFields ? (
          <FieldInput
            field={READONLY_FIELDS[7]}
            formValues={formValues}
            handleInputChange={handleInputChange}
            errors={errors}
            disabled
          />
        ) : null}

        <FieldInput
          field={EDITABLE_FIELDS[0][0]}
          formValues={formValues}
          handleInputChange={handleInputChange}
          errors={errors}
        />
        <FieldInput
          field={EDITABLE_FIELDS[0][1]}
          formValues={formValues}
          handleInputChange={handleInputChange}
          errors={errors}
        />
        <FieldInput
          field={EDITABLE_FIELDS[0][2]}
          formValues={formValues}
          handleInputChange={handleInputChange}
          errors={errors}
        />
      </div>

      <hr />

      <div className="row align-items-end">
        {EDITABLE_FIELDS[1].map((field) => (
          <FieldInput
            key={field.name}
            field={field}
            formValues={formValues}
            handleInputChange={handleInputChange}
            errors={errors}
          />
        ))}
      </div>

      <hr />

      <div className="row align-items-end">
        {!compactReadonly && !hideContextFields ? (
          <>
            <FieldInput
              field={READONLY_FIELDS[8]}
              formValues={formValues}
              handleInputChange={handleInputChange}
              errors={errors}
              disabled
            />
            <FieldInput
              field={EDITABLE_FIELDS[2][0]}
              formValues={formValues}
              handleInputChange={handleInputChange}
              errors={errors}
            />
            <FieldInput
              field={READONLY_FIELDS[9]}
              formValues={formValues}
              handleInputChange={handleInputChange}
              errors={errors}
              disabled
            />
            <FieldInput
              field={READONLY_FIELDS[10]}
              formValues={formValues}
              handleInputChange={handleInputChange}
              errors={errors}
              disabled
            />
          </>
        ) : (
          <>
            <FieldInput
              field={READONLY_FIELDS[8]}
              formValues={formValues}
              handleInputChange={handleInputChange}
              errors={errors}
              disabled
            />
            <FieldInput
              field={EDITABLE_FIELDS[2][0]}
              formValues={formValues}
              handleInputChange={handleInputChange}
              errors={errors}
            />
            <FieldInput
              field={READONLY_FIELDS[9]}
              formValues={formValues}
              handleInputChange={handleInputChange}
              errors={errors}
              disabled
            />
          </>
        )}
      </div>

      {hideContextFields ? (
        <>
          <hr />
          <div className="row align-items-end">
            <FieldInput
              field={READONLY_FIELDS[10]}
              formValues={formValues}
              handleInputChange={handleInputChange}
              errors={errors}
              disabled
            />
            <div className="col-sm-3" style={{ marginTop: "15px" }}>
              <input
                autoComplete="off"
                className="form-check-input"
                type="checkbox"
                id="PRERESERVA"
                name="pre_reserva"
                checked={Boolean(formValues.pre_reserva)}
                onChange={handleInputChange}
              />
              <label
                className="form-check-label"
                style={{ marginLeft: "5px", marginTop: "3px" }}
              >
                <span>PRE - RESERVA</span>
              </label>
            </div>
            <div className="col-sm-3" />
            <div className="col-sm-3" />
          </div>
        </>
      ) : null}

      <div className="row" hidden={!formValues.pre_reserva}>
        <hr />
        <h4>Agregar valores para Pre Reserva</h4>
        {PRE_RESERVA_FIELDS.map((field) => (
          <FieldInput
            key={field.name}
            field={field}
            formValues={formValues}
            handleInputChange={handleInputChange}
            errors={errors}
          />
        ))}
        <div className="col-sm-3">
          <label className="form-label">Metodo de pago</label>
          <select
            className={`form-select ${errors.custbody188 ? "is-invalid" : ""}`}
            value={formValues.custbody188 || ""}
            name="custbody188"
            onChange={handleInputChange}
          >
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <option key={option.value || "empty"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors.custbody188 ? (
            <div className="invalid-feedback d-block">{errors.custbody188}</div>
          ) : null}
        </div>
      </div>
    </>
  );
};
