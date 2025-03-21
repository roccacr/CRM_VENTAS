import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';

// Constantes
const PRIMAS_DATA = [
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
        title: "PRIMA 3",
        checkbox: "custbody178",
        inputs: [
            { name: "custbody183", label: "PRIMA 3", type: "text", placeholder: "0" },
            { name: "custbody184_date", label: "FECHA:", type: "date", placeholder: "0" },
            { name: "custbody184", label: "TRACTOS PRIMA 3", type: "number", placeholder: "0" },
            { name: "custbody195", label: "DESCRIPCIÓN PRIMA 3:", type: "textarea", placeholder: "PRIMA 3" },
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
        checkbox: "prima_extra_uno",
        inputs: [
            { name: "monto_extra_uno", label: "PRIMA 4", type: "text", placeholder: "0" },
            { name: "custbody184_uno_date", label: "FECHA:", type: "date", placeholder: "0" },
            { name: "monto_tracto_uno", label: "TRACTOS PRIMA 4", type: "number", placeholder: "0" },
            { name: "desc_extra_uno", label: "DESCRIPCIÓN PRIMA 4", type: "textarea", placeholder: "PRIMA 4" },
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

/**
 * Componente que renderiza una sección individual de prima
 * @param {Object} props - Propiedades del componente
 * @param {string} props.title - Título de la sección
 * @param {Object} props.fields - Campos del formulario
 * @param {Object} props.formValues - Valores actuales del formulario
 * @param {Function} props.handleInputChange - Manejador de cambios en inputs
 * @param {Object} props.errors - Objeto con errores de validación
 */
const PrimaSection = React.memo(({ title, fields, formValues, handleInputChange, errors }) => {
    if (!formValues[fields.checkbox]) return null;

    const renderInput = useCallback((input) => {
        const commonProps = {
            name: input.name,
            placeholder: input.placeholder,
            className: `form-control mb-2 ${errors[input.name] ? "is-invalid" : ""}`,
            value: formValues[input.name] || '',
            onChange: handleInputChange,
            'aria-label': input.label
        };

        return input.type === "textarea" ? (
            <textarea
                {...commonProps}
                cols="50"
                rows="2"
            />
        ) : (
            <input
                {...commonProps}
                type={input.type}
            />
        );
    }, [formValues, handleInputChange, errors]);

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
                                <label className="form-label" htmlFor={input.name}>
                                    {input.label}
                                </label>
                                <div className="mb-3 input-group">
                                    {renderInput(input)}
                                    {errors[input.name] && (
                                        <div className="invalid-feedback" role="alert">
                                            {errors[input.name]}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

PrimaSection.propTypes = {
    title: PropTypes.string.isRequired,
    fields: PropTypes.shape({
        checkbox: PropTypes.string.isRequired,
        inputs: PropTypes.arrayOf(PropTypes.shape({
            name: PropTypes.string.isRequired,
            label: PropTypes.string.isRequired,
            type: PropTypes.string.isRequired,
            placeholder: PropTypes.string
        })).isRequired
    }).isRequired,
    formValues: PropTypes.object.isRequired,
    handleInputChange: PropTypes.func.isRequired,
    errors: PropTypes.object.isRequired
};

/**
 * Componente principal para la selección de primas
 * Permite seleccionar y configurar hasta 6 primas diferentes
 * @param {Object} props - Propiedades del componente
 * @param {Object} props.formValues - Valores del formulario
 * @param {Function} props.handleInputChange - Manejador de cambios
 * @param {Object} props.errors - Errores de validación
 */
export const SeleccionPrima = ({ formValues, handleInputChange, errors }) => {
    const renderCheckboxes = useMemo(() => (
        <div className="card">
            <div className="card-header">
                <h5>Seleccione las Primas</h5>
            </div>
            <div className="card-body">
                <div className="row">
                    {PRIMAS_DATA.map((prima) => (
                        <div className="col-md-4 mb-3" key={prima.checkbox}>
                            <div className="form-check">
                                <input
                                    type="checkbox"
                                    id={prima.checkbox}
                                    name={prima.checkbox}
                                    className="form-check-input"
                                    checked={formValues[prima.checkbox] || false}
                                    onChange={handleInputChange}
                                    aria-label={`Seleccionar ${prima.title}`}
                                />
                                <label 
                                    className="form-check-label" 
                                    htmlFor={prima.checkbox}
                                >
                                    {prima.title}
                                </label>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    ), [formValues, handleInputChange]);

    return (
        <>
            {renderCheckboxes}
            {PRIMAS_DATA.slice()
                .sort((a, b) => a.title.localeCompare(b.title))
                .map((prima) => (
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

SeleccionPrima.propTypes = {
    formValues: PropTypes.object.isRequired,
    handleInputChange: PropTypes.func.isRequired,
    errors: PropTypes.object.isRequired
};
