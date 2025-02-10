import PropTypes from 'prop-types';
import { AvanceDiferenciado } from "./AvanceDiferenciado";
import { AvanceObra } from "./AvanceObra";
import { ContraEntrega } from "./ContraEntrega";
import React, { useMemo, useCallback } from 'react';

/**
 * @constant {Object} PAYMENT_METHODS
 * @description Constantes que definen los tipos de métodos de pago disponibles
 * @property {string} ADVANCE - Código para el método de pago "Avance De Obra"
 * @property {string} DIFFERENTIATED - Código para el método de pago "Avance Diferenciado"
 * @property {string} COUNTER_DELIVERY - Código para el método de pago "Contra Entrega"
 */
const PAYMENT_METHODS = {
  ADVANCE: '2',
  DIFFERENTIATED: '7',
  COUNTER_DELIVERY: '1'
};

/**
 * @constant {Object} styles
 * @description Estilos en línea para los componentes
 */
const styles = {
  container: { marginTop: '15px' },
  title: { fontSize: '0.875em', color: '#000' },
  select: { width: '100%' }
};

/**
 * Componente MetodoPago
 * @description Maneja la selección y visualización de diferentes métodos de pago en el formulario
 * 
 * @component
 * @param {Object} props - Propiedades del componente
 * @param {Object} props.formValues - Valores actuales del formulario
 * @param {string} props.formValues.custbody75 - ID del método de pago seleccionado
 * @param {Function} props.handleInputChange - Función para manejar cambios en los inputs
 * @param {Object} props.errors - Objeto que contiene los errores de validación
 * @param {string} [props.errors.custbody75] - Mensaje de error específico para el método de pago
 * 
 * @example
 * // Ejemplo de uso del componente
 * <MetodoPago
 *   formValues={{ custbody75: '2' }}
 *   handleInputChange={(e) => handleChange(e)}
 *   errors={{ custbody75: 'Este campo es requerido' }}
 * />
 */
export const MetodoPago = ({ 
  formValues = {}, 
  handleInputChange, 
  errors = {} 
}) => {
  /**
   * @type {Object}
   * @description Mapeo memoizado de los componentes de método de pago
   */
  const paymentComponents = useMemo(() => ({
    [PAYMENT_METHODS.COUNTER_DELIVERY]: ContraEntrega,
    [PAYMENT_METHODS.ADVANCE]: AvanceObra,
    [PAYMENT_METHODS.DIFFERENTIATED]: AvanceDiferenciado
  }), []);

  // Convert custbody75 to string if it's a number
  const paymentMethod = String(formValues.custbody75 || '');

  /**
   * Renderiza el componente del método de pago seleccionado
   * @function
   * @returns {React.ReactElement|null} Componente del método de pago o null si no hay selección
   */
  const renderPaymentMethod = useCallback(() => {
    const SelectedComponent = paymentComponents[paymentMethod];
    return SelectedComponent ? (
      <SelectedComponent 
        formValues={formValues} 
        handleInputChange={handleInputChange} 
        errors={errors} 
      />
    ) : null;
  }, [paymentComponents, formValues, handleInputChange, errors, paymentMethod]);

  return (
    <div className="row" style={styles.container}>
      <div className="col-sm-12">
        <div role="alert" className="fade alert alert-dark show">
          <h2 style={styles.title}>
            <em><u>MÉTODO DE PAGO</u></em>
          </h2>
          <div className="col">
            <div className="col-sm-3">
              <label htmlFor="payment-method" className="visually-hidden">
                Método de pago
              </label>
              <select
                id="payment-method"
                className={`form-select ${!paymentMethod && errors?.custbody75 ? 'is-invalid' : ''}`}
                value={paymentMethod}
                name="custbody75"
                onChange={handleInputChange}
                aria-label="Seleccione método de pago"
              >
                <option value="">Seleccione un Método de pago</option>
                <option value={PAYMENT_METHODS.ADVANCE}>Avance De Obra</option>
                <option value={PAYMENT_METHODS.DIFFERENTIATED}>Avance Diferenciado</option>
                <option value={PAYMENT_METHODS.COUNTER_DELIVERY}>Contra Entrega</option>
              </select>
              {!paymentMethod && errors?.custbody75 && (
                <div className="invalid-feedback d-block">
                  {errors.custbody75}
                </div>
              )}
            </div>
          </div>
        </div>
        {renderPaymentMethod()}
      </div>
    </div>
  );
};

/**
 * @type {Object}
 * @description Validación de tipos para las props del componente
 */
MetodoPago.propTypes = {
  formValues: PropTypes.shape({
    custbody75: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.number
    ])
  }).isRequired,
  handleInputChange: PropTypes.func.isRequired,
  errors: PropTypes.object
};
