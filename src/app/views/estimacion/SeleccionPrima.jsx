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
            title: "PRIMA 1",
            checkbox: "custbody176",
            inputs: [
                { name: "custbody179", label: "PRIMA 1", type: "text", placeholder: "0" },
                { name: "custbody179_date", label: "FECHA:", type: "date", placeholder: "0" },
                { name: "custbody180", label: "TRACTOS PRIMA 1", type: "number", placeholder: "0" },
                { name: "custbody193", label: "DESCRIPCIÓN PRIMA 1:", type: "textarea", placeholder: "PRIMA 1" },
            ],
        },
        {
            title: "PRIMA 2",
            checkbox: "custbody177",
            inputs: [
                { name: "custbody181", label: "PRIMA 2", type: "text", placeholder: "0" },
                { name: "custbody182_date", label: "FECHA:", type: "date", placeholder: "0" },
                { name: "custbody182", label: "TRACTOS PRIMA 2", type: "number", placeholder: "0" },
                { name: "custbody194", label: "DESCRIPCIÓN PRIMA 2:", type: "textarea", placeholder: "PRIMA 2" },
            ],
        },
        {
            title: "PRIMA 4",
            checkbox: "custbody178",
            inputs: [
                { name: "custbody183", label: "PRIMA 4", type: "text", placeholder: "0" },
                { name: "custbody184_date", label: "FECHA:", type: "date", placeholder: "0" },
                { name: "custbody184", label: "TRACTOS PRIMA 4", type: "number", placeholder: "0" },
                { name: "custbody195", label: "DESCRIPCIÓN PRIMA 4:", type: "textarea", placeholder: "PRIMA 4" },
            ],
        },
        {
            title: "PRIMA 2",
            checkbox: "prima_extra_uno",
            inputs: [
                { name: "monto_extra_uno", label: "PRIMA 2", type: "text", placeholder: "0" },
                { name: "custbody184_uno_date", label: "FECHA:", type: "date", placeholder: "0" },
                { name: "monto_tracto_uno", label: "TRACTOS PRIMA 2", type: "number", placeholder: "0" },
                { name: "desc_extra_uno", label: "DESCRIPCIÓN PRIMA 2", type: "textarea", placeholder: "PRIMA 2" },
            ],
        },
        {
            title: "PRIMA 5",
            checkbox: "prima_extra_dos",
            inputs: [
                { name: "monto_extra_dos", label: "PRIMA 5", type: "text", placeholder: "0" },
                { name: "custbody184_dos_date", label: "FECHA:", type: "date", placeholder: "0" },
                { name: "monto_tracto_dos", label: "TRACTOS PRIMA 5", type: "number", placeholder: "0" },
                { name: "desc_extra_dos", label: "DESCRIPCIÓN PRIMA 5", type: "textarea", placeholder: "PRIMA 5" },
            ],
        },
        {
            title: "PRIMA 6",
            checkbox: "prima_extra_tres",
            inputs: [
                { name: "monto_extra_tres", label: "PRIMA 6", type: "text", placeholder: "0" },
                { name: "custbody184_tres_date", label: "FECHA:", type: "date", placeholder: "0" },
                { name: "monto_tracto_tres", label: "TRACTOS PRIMA 6", type: "number", placeholder: "0" },
                { name: "desc_extra_tres", label: "DESCRIPCIÓN PRIMA 6", type: "textarea", placeholder: "PRIMA 6" },
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
