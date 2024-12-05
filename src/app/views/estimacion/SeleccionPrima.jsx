const PrimaSection = ({ title, fields, formValues, handleInputChange, errors }) => {
    if (!formValues[fields.checkbox]) return null;

    return (
        <div className="card">
            <div className="card-header" style={{ backgroundColor: "#000", color: "#fff" }}>
                <center>{title}</center>
            </div>
            <div className="card-body">
                <div className="row">
                    {fields.inputs.map((input) => (
                        <div className="col-md-6" key={input.name}>
                            <div className="mb-3">
                                <label className="form-label">{input.label}</label>
                                <div className="mb-3 input-group">
                                    {input.type === "textarea" ? (
                                        <textarea
                                            cols="50"
                                            rows="2"
                                            className={`form-control mb-2 ${errors[input.name] ? "is-invalid" : ""}`}
                                            name={input.name}
                                            placeholder={input.placeholder}
                                            value={formValues[input.name]}
                                            onChange={handleInputChange}
                                        />
                                    ) : (
                                        <input
                                            type={input.type}
                                            placeholder={input.placeholder}
                                            className={`form-control mb-2 ${errors[input.name] ? "is-invalid" : ""}`}
                                            name={input.name}
                                            value={formValues[input.name]}
                                            onChange={handleInputChange}
                                        />
                                    )}
                                    {errors[input.name] && <div className="invalid-feedback">{errors[input.name]}</div>}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export const SeleccionPrima = ({ formValues, handleInputChange, errors }) => {
    const primas = [
        {
            title: "PRIMA FRACCIONADA",
            checkbox: "custbody176",
            inputs: [
                { name: "custbody179", label: "MONTO FRACCIONADO", type: "text", placeholder: "0" },
                { name: "custbody179_date", label: "FECHA:", type: "date", placeholder: "0" },
                { name: "custbody180", label: "TRACTOS FRACCIONADO", type: "number", placeholder: "0" },
                { name: "custbody193", label: "DESCRIPCIÓN FRACCIONADO:", type: "textarea", placeholder: "PAGO DE PRIMA FRACCIONADO" },
            ],
        },
        {
            title: "PRIMA ÚNICA",
            checkbox: "custbody177",
            inputs: [
                { name: "custbody181", label: "MONTO ÚNICO", type: "text", placeholder: "0" },
                { name: "custbody182_date", label: "FECHA:", type: "date", placeholder: "0" },
                { name: "custbody182", label: "TRACTOS ÚNICA", type: "number", placeholder: "0" },
                { name: "custbody194", label: "DESCRIPCIÓN ÚNICA:", type: "textarea", placeholder: "PAGO DE PRIMA ÚNICA" },
            ],
        },
        {
            title: "PRIMA EXTRA-ORDINARIA",
            checkbox: "custbody178",
            inputs: [
                { name: "custbody183", label: "MONTO EXTRA-ORDINARIA", type: "text", placeholder: "0" },
                { name: "custbody184_date", label: "FECHA:", type: "date", placeholder: "0" },
                { name: "custbody184", label: "TRACTOS EXTRA-ORDINARIA", type: "number", placeholder: "0" },
                { name: "custbody195", label: "DESCRIPCIÓN EXTRA-ORDINARIA:", type: "textarea", placeholder: "PAGO DE PRIMA EXTRA-ORDINARIA" },
            ],
        },
        {
            title: "PRIMA EXTRA 1+",
            checkbox: "prima_extra_uno",
            inputs: [
                { name: "monto_extra_uno", label: "MONTO PRIMA EXTRA 1+", type: "text", placeholder: "0" },
                { name: "custbody184_uno_date", label: "FECHA:", type: "date", placeholder: "0" },
                { name: "monto_tracto_uno", label: "TRACTOS PRIMA EXTRA 1+", type: "number", placeholder: "0" },
                { name: "custbody195_uno", label: "DESCRIPCIÓN PRIMA EXTRA 1+:", type: "textarea", placeholder: "PAGO DE PRIMA PRIMA EXTRA 1+" },
            ],
        },
        {
            title: "PRIMA EXTRA 2+",
            checkbox: "prima_extra_dos",
            inputs: [
                { name: "monto_extra_dos", label: "MONTO PRIMA EXTRA 2+", type: "text", placeholder: "0" },
                { name: "custbody184_dos_date", label: "FECHA:", type: "date", placeholder: "0" },
                { name: "monto_tracto_dos", label: "TRACTOS PRIMA EXTRA 2+", type: "number", placeholder: "0" },
                { name: "custbody195_dos", label: "DESCRIPCIÓN PRIMA EXTRA 2+:", type: "textarea", placeholder: "PAGO DE PRIMA PRIMA EXTRA 2+" },
            ],
        },
        {
            title: "PRIMA EXTRA 3+",
            checkbox: "prima_extra_tres",
            inputs: [
                { name: "monto_extra_tres", label: "MONTO PRIMA EXTRA 3+", type: "text", placeholder: "0" },
                { name: "custbody184_tres_date", label: "FECHA:", type: "date", placeholder: "0" },
                { name: "monto_tracto_tres", label: "TRACTOS PRIMA EXTRA 3+", type: "number", placeholder: "0" },
                { name: "custbody195_tres", label: "DESCRIPCIÓN PRIMA EXTRA 3+:", type: "textarea", placeholder: "PAGO DE PRIMA PRIMA EXTRA 3+" },
            ],
        },
    ];

    return (
        <>
            <div className="card">
                <div className="card-header">
                    <h5>Seleccione las Primas</h5>
                </div>
                <div className="card-body">
                    <div className="row">
                        {primas.map((prima, index) => (
                            <div className="col-md-4 mb-3" key={index}>
                                <div className="form-check">
                                    <input
                                        type="checkbox"
                                        name={prima.checkbox}
                                        className="form-check-input"
                                        checked={formValues[prima.checkbox]}
                                        onChange={handleInputChange}
                                    />

                                    <label className="form-check-label">{prima.title}</label>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {primas.map((prima) => (
                <PrimaSection
                    key={prima.checkbox}
                    title={prima.title}
                    fields={prima}
                    formValues={formValues}
                    handleInputChange={handleInputChange}
                    errors={errors}
                />
            ))}
        </>
    );
};
