import React from 'react';

/**
 * Componente CalculodePrima
 * 
 * Este componente maneja la interfaz para el cálculo de prima, permitiendo al usuario
 * seleccionar el método de cálculo (porcentaje o monto) y mostrar los campos relacionados.
 *
 * @param {Object} formValues - Objeto que contiene todos los valores del formulario
 * @param {Function} handleInputChange - Función para manejar cambios en los inputs
 * @param {Function} handleDiscountSelection - Función para manejar la selección del tipo de descuento
 * @param {Object} errors - Objeto que contiene los errores de validación
 */
export const CalculodePrima = ({ formValues, handleInputChange, handleDiscountSelection, errors }) => {
    return (
        <div>
            <CalculationMethodSection 
                formValues={formValues} 
                handleDiscountSelection={handleDiscountSelection} 
            />
            <PrimaFields 
                formValues={formValues} 
                handleInputChange={handleInputChange} 
                errors={errors} 
            />
        </div>
    );
};

/**
 * Componente para seleccionar el método de cálculo de la prima.
 */
const CalculationMethodSection = ({ formValues, handleDiscountSelection }) => (
    <div className="row" style={{ marginTop: "15px" }}>
        <div className="col-sm-12">
            <div role="alert" className="fade alert alert-dark show">
                <p style={{ fontSize: "0.875em", color: "#000" }}>
                    <em><u>SELECCIONÉ COMO VA A CALCULAR LA PRIMA</u></em>
                </p>
                <div className="col">
                    {['percentage', 'amount', ''].map((value, index) => (
                        <RadioOption 
                            key={index} 
                            value={value} 
                            label={value === '' ? 'NINGUNO' : value.toUpperCase()} 
                            formValues={formValues} 
                            handleDiscountSelection={handleDiscountSelection} 
                        />
                    ))}
                </div>
            </div>
        </div>
    </div>
);

/**
 * Componente para renderizar una opción de radio.
 */
const RadioOption = ({ value, label, formValues, handleDiscountSelection }) => (
    <div className="form-check">
        <input
            className="form-check-input"
            name="isDiscounted"
            type="radio"
            value={value}
            checked={formValues.isDiscounted === value}
            onChange={handleDiscountSelection}
            aria-checked={formValues.isDiscounted === value}
            aria-label={label}
        />
        <label className="form-check-label">
            <span>{label}</span>
        </label>
    </div>
);

/**
 * Componente para renderizar los campos de entrada relacionados con la prima.
 */
const PrimaFields = ({ formValues, handleInputChange, errors }) => (
    <div className="row">
        <FormInput 
            label="PRIMA TOTAL" 
            name="custbody39" 
            disabled={formValues.isDiscounted === null || formValues.isDiscounted === "percentage"} 
            formValues={formValues} 
            handleInputChange={handleInputChange} 
            errors={errors} 
        />
        <FormInput 
            label="PRIMA%" 
            name="custbody60" 
            disabled={formValues.isDiscounted === null || formValues.isDiscounted === "amount"} 
            formValues={formValues} 
            handleInputChange={handleInputChange} 
            errors={errors} 
        />
        <FormInput 
            label="MONTO PRIMA NETA" 
            name="custbody_ix_salesorder_monto_prima" 
            disabled={true} 
            formValues={formValues} 
            handleInputChange={handleInputChange} 
        />
        <FormInput 
            label="TRACTO" 
            name="custbody40" 
            disabled={true} 
            hidden={true} 
            formValues={formValues} 
            handleInputChange={handleInputChange} 
        />
        <FormInput 
            label="MONTO ASIGNABLE PRIMA NETA" 
            name="neta" 
            disabled={true} 
            formValues={formValues} 
            handleInputChange={handleInputChange} 
        />
    </div>
);

/**
 * Componente para renderizar un input con su label y manejo de errores.
 */
const FormInput = ({ label, name, disabled, hidden = false, formValues = {}, handleInputChange, errors = {} }) => (
    <div className={`col-sm-3 ${hidden ? 'd-none' : ''}`}>
        <label className="form-label" htmlFor={name}>{label}</label>
        <input
            id={name}
            autoComplete="off"
            name={name}
            value={formValues[name] || ''}
            onChange={handleInputChange}
            className={`form-control mb-2 ${errors[name] ? "is-invalid" : ""}`}
            disabled={disabled}
            aria-invalid={!!errors[name]}
            aria-describedby={errors[name] ? `${name}-error` : undefined}
        />
        {errors[name] && <div id={`${name}-error`} className="invalid-feedback">{errors[name]}</div>}
    </div>
);
