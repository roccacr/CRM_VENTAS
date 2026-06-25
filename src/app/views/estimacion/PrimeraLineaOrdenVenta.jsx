const PAYMENT_METHOD_OPTIONS = [
  { value: "", label: "Selecione un Metodo de pago" },
  { value: "3", label: "Cheque" },
  { value: "2", label: "Efectivo" },
  { value: "4", label: "Paypal" },
  { value: "5", label: "Tarjeta de Credito" },
  { value: "6", label: "Tarjeta de Debito" },
  { value: "1", label: "Transferencia" },
];

const CONTEXT_FIELDS = [
  { name: "custbody114", label: "Entrega fecha" },
  { name: "entity", label: "Nombre cliente" },
  { name: "custbody38", label: "Uni. exped. ligado vta" },
  { name: "Ubi", label: "Ubicacion" },
  { name: "Clase", label: "Clase" },
  { name: "tranid_oport", label: "Oportunidad" },
  { name: "expectedclosedate", label: "Cierre de previsto" },
];

const PRICING_ROWS = [
  [
    { name: "custbody13", label: "Precio de lista", disabled: true },
    { name: "custbody132", label: "Monto descuento directo" },
    { name: "custbody46", label: "Extras pagadas por el cliente" },
    { name: "custbody47", label: "Descripcion extras" },
  ],
  [
    { name: "custbodyix_salesorder_cashback", label: "Cashback" },
    { name: "custbody52", label: "Monto reserva" },
    { name: "custbody16", label: "Monto total de cortesias" },
    { name: "custbody35", label: "Descripcion de las cortesias" },
  ],
  [
    { name: "custbody18", label: "Prec. de venta minimo", disabled: true },
    { name: "fech_reserva", label: "Fecha reserva", type: "date" },
    { name: "pvneto", label: "Pec. de venta neto", disabled: true },
    { name: "custbody_ix_total_amount", label: "Monto total", disabled: true },
  ],
];

const RESERVA_FIELDS = [
  { name: "custbody207", label: "Monto reserva aplicada" },
  { name: "custbody189", label: "Comprobante reserva" },
  { name: "custbody208", label: "Fecha de reserva aplicada", type: "date" },
  { name: "custbody190", label: "Observaciones reserva" },
];

const EXTRA_DETAILS_ROWS = [
  [
    { name: "custbody114", label: "Entrega estimada", type: "date" },
    { name: "saleseffectivedate", label: "Fecha de vigencia de la venta", type: "date" },
    { name: "custbody20", label: "Comision del asesor %" },
    { name: "custbody14", label: "% comision del corredor" },
  ],
  [
    {
      name: "custbody37",
      label: "Fondos de compra",
      type: "select",
      options: [
        { value: "", label: "Selecionar metodo de fondo" },
        { value: "1", label: "Propios" },
        { value: "2", label: "Financiado" },
      ],
    },
    {
      name: "custbody115",
      label: "Motivo de cancelacion de reserva o venta caida",
      type: "select",
      options: [
        { value: "", label: "Selecione un Motivo" },
        { value: "2", label: "Inconformidad - Cambios en proyecto" },
        { value: "3", label: "Inconformidad - Distribucion" },
        { value: "1", label: "Inconformidad - Fecha de entrega" },
        { value: "12", label: "Incumplimiento contractual" },
        { value: "10", label: "Mejor Oferta" },
        { value: "13", label: "Motivo de empresa - Proyecto pospuesto" },
        { value: "9", label: "Motivo Financiero - Condiciones bancarias" },
        { value: "8", label: "Motivo Financiero - Dependencia venta de propiedad" },
        { value: "14", label: "Motivo Laboral" },
        { value: "6", label: "Motivo Personal - Economico" },
        { value: "5", label: "Motivo Personal - Familiar" },
        { value: "4", label: "Motivo Personal - Salud" },
        { value: "7", label: "Motivo Personal - Sin Especificar" },
        { value: "11", label: "No sujeto a credito" },
        { value: "15", label: "Traslado de FF/proyecto" },
      ],
    },
    { name: "custbody116", label: "Comentarios cancelacion", type: "textarea", rows: 3 },
    { name: "memo", label: "Nota", type: "textarea", rows: 3 },
  ],
  [
    { name: "custbody191", label: "Monto prereserva" },
    { name: "custbody206", label: "Fecha de prereserva", type: "date" },
  ],
];

const formatValue = (value, normalizePercent = false) => {
  const rawValue = value ?? "";
  return normalizePercent && typeof rawValue === "string"
    ? rawValue.replace("%", "")
    : rawValue;
};

const FieldInput = ({
  field,
  formValues,
  handleInputChange,
  errors,
  disabled = false,
}) => {
  const hasError = Boolean(errors[field.name]);
  const value = formatValue(
    formValues[field.name],
    field.name === "custbody20" || field.name === "custbody14",
  );

  if (field.type === "select") {
    return (
      <div className="col-sm-3">
        <label className="form-label">{field.label}</label>
        <select
          className={`form-select ${hasError ? "is-invalid" : ""}`}
          value={value || ""}
          name={field.name}
          onChange={handleInputChange}
          disabled={disabled}
        >
          {field.options.map((option) => (
            <option key={`${field.name}-${option.value || "empty"}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {hasError ? <div className="invalid-feedback">{errors[field.name]}</div> : null}
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="col-sm-3">
        <label className="form-label">{field.label}</label>
        <textarea
          autoComplete="off"
          name={field.name}
          value={value}
          onChange={handleInputChange}
          rows={field.rows || 2}
          className={`form-control mb-2 ${hasError ? "is-invalid" : ""}`}
          disabled={disabled}
          readOnly={disabled}
        />

        {hasError ? <div className="invalid-feedback">{errors[field.name]}</div> : null}
      </div>
    );
  }

  return (
    <div className="col-sm-3">
      <label className="form-label">{field.label}</label>
      <input
        autoComplete="off"
        type={field.type || "text"}
        name={field.name}
        value={value}
        onChange={handleInputChange}
        className={`form-control mb-2 ${hasError ? "is-invalid" : ""}`}
        disabled={disabled}
        readOnly={disabled}
      />

      {hasError ? <div className="invalid-feedback">{errors[field.name]}</div> : null}
    </div>
  );
};

const ReservaToggle = ({ formValues, handleInputChange, className = "col-sm-3 d-flex align-items-center" }) => (
  <div className={className}>
    <div className="form-check mb-2">
      <input
        autoComplete="off"
        className="form-check-input"
        type="checkbox"
        id="PRERESERVA"
        name="pre_reserva"
        checked={Boolean(formValues.pre_reserva)}
        onChange={handleInputChange}
      />
      <label className="form-check-label" htmlFor="PRERESERVA">
        Reserva
      </label>
    </div>
  </div>
);

export const PrimeraLineaOrdenVenta = ({
  formValues,
  handleInputChange,
  errors,
  hideContextFields = false,
}) => {
  const contextFieldsToRender = hideContextFields ? [] : CONTEXT_FIELDS;

  return (
    <>
      {contextFieldsToRender.length > 0 ? (
        <>
          <div className="row align-items-end">
            {contextFieldsToRender.slice(0, 4).map((field) => (
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

          <div className="row align-items-end">
            {contextFieldsToRender.slice(4).map((field) => (
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

      {PRICING_ROWS.map((row, index) => (
        <div key={`pricing-row-${index}`}>
          <div className="row align-items-end">
            {row.map((field) => (
              <FieldInput
                key={field.name}
                field={field}
                formValues={formValues}
                handleInputChange={handleInputChange}
                errors={errors}
                disabled={field.disabled}
              />
            ))}
          </div>
          {index < PRICING_ROWS.length - 1 ? <hr /> : null}
        </div>
      ))}

      <hr />

      <div className="row">
        <div className="col-sm-12">
          <h4>Asignar valores para Reserva</h4>
        </div>

        <ReservaToggle
          className="col-sm-12"
          formValues={formValues}
          handleInputChange={handleInputChange}
        />
      </div>

      {formValues.pre_reserva ? (
        <>
          <div className="row">
            <div className="col-sm-12">
              <h4>Agregar valores para Reserva</h4>
            </div>

            {RESERVA_FIELDS.map((field) => (
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
                  <option key={`custbody188-${option.value || "empty"}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {errors.custbody188 ? (
                <div className="invalid-feedback">{errors.custbody188}</div>
              ) : null}
            </div>
          </div>

          <hr />
        </>
      ) : (
        <hr />
      )}

      <div className="row">
        <h4>Asignar Valores para Mezzanine</h4>

        <div className="col-sm-12">
          <div className="form-check mb-3">
            <input
              autoComplete="off"
              className="form-check-input"
              type="checkbox"
              id="MEZZANINE"
              name="custbody_mezzanine_verifica"
              checked={Boolean(formValues.custbody_mezzanine_verifica)}
              onChange={handleInputChange}
            />
            <label className="form-check-label" htmlFor="MEZZANINE">
              Mezzanine
            </label>
          </div>
        </div>

        {formValues.custbody_mezzanine_verifica ? (
          <>
            <FieldInput
              field={{ name: "custbody_mezzanine_area", label: "Area del mezzanine m²" }}
              formValues={formValues}
              handleInputChange={handleInputChange}
              errors={errors}
            />
            <FieldInput
              field={{ name: "custbody_mezzanine_monto", label: "Monto del mezzanine" }}
              formValues={formValues}
              handleInputChange={handleInputChange}
              errors={errors}
            />
          </>
        ) : null}
      </div>

      <hr />

      {EXTRA_DETAILS_ROWS.map((row, index) => (
        <div key={`extra-row-${index}`}>
          <div className="row align-items-end">
            {row.map((field) => (
              <FieldInput
                key={field.name}
                field={field}
                formValues={formValues}
                handleInputChange={handleInputChange}
                errors={errors}
              />
            ))}
          </div>
          {index < EXTRA_DETAILS_ROWS.length - 1 ? <hr /> : null}
        </div>
      ))}
    </>
  );
};
