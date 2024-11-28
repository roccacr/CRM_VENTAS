import { useState, useEffect } from "react";
import { Modal } from "@mui/material";
import { limpiarCampos } from "../../../hook/useInputFormatter";
import { PrimeraLinea } from "./PrimeraLinea";
import { CalculodePrima } from "./CalculodePrima";
import { SeleccionPrima } from "./SeleccionPrima";
import { MetodoPago } from "./MetodoPago";

export const ModalEstimacion = ({ open, onClose }) => {
    // Estado para manejar si el contenido del modal está cargando
    const [isLoading, setIsLoading] = useState(true);

    const [formValues, setFormValues] = useState({
        custbody114: "31/12/2025", // Entrega fecha (opcional)
        entity: " Alexandra Sancho ", // Nombre del cliente (obligatorio)
        custbody38: "LHLIB-FF007", // UNI. EXPED. LIGADO VTA (opcional)
        proyecto_lead_est: "Lean Homes Liberia", // Proyecto (opcional)
        subsidiary: "idSubsidiaria", // Subsidiaria (opcional)
        entitystatus: "idEstado Cliente", // Estado del cliente (opcional)
        tranid_oport: "idOportunidad", // Oportunidad (opcional)
        expectedclosedate: "31/12/2025", // Fecha de cierre esperada (opcional)
        pre_reserva: false, // Valor inicial del checkbox
        custbody13: 0, // Precio de lista (opcional)
        custbody132: 0, // MONTO DESCUENTO DIRECTO (opcional)
        custbody46: 0, // EXTRAS PAGADAS POR EL CLIENTE (opcional)
        custbody47: "--", // DESCRIPCIÓN EXTRAS (opcional)
        custbodyix_salesorder_cashback: 0, // CASHBACK (opcional)
        custbody52: 0, // MONTO RESERVA (opcional)
        custbody16: 0, // MONTO TOTAL.
        custbody35: "--", // DESCRIPCIÓN DE LAS CORTESIAS
        custbody18: 0, // PREC. DE VENTA MÍNIMO
        fech_reserva: "", // FECHA RESERVA (opcional)
        pvneto: 0, // PEC. DE VENTA NETO (opcional)
        custbody_ix_total_amount: 0, // MONTO TOTAL (opcional)
        diferecia: 0, // EXTRAS SOBRE EL PRECIO DE LISTA (opcional)
        custbody191: 500, // MONTO PRERESERVA (opcional)
        pre_3: "---", // COMPROBANTE PRERESERVA (opcional)
        pre_5: "", // FECHA DE PRERESERVA (opcional)
        pre_8: "--", // OBSERVACIONES PRERESERVA (opcional)
        custbody188: "1", // METODO DE PAGO (opcional)
        isDiscounted: null, // "percentage" o "amount"
        custbody39: 0, // PRIMA TOTAL (opcional)
        custbody60: 0.15, // PRIMA% (opcional)
        custbody_ix_salesorder_monto_prima: 0, // MONTO PR
        custbody40: "--", // TRACTO (opcional)
        neta: 0, // MONTO ASIGNABLE
        chec_fra: false, // PRIMA FRACCIONADA
        chec_uica: false, // PRIMA ÚNICA
        chec_extra: false, // PRIMA EXTRA-ORDINARIA
        chec_extra_uno: false, // PRIMA EXTRA 1+
        chec_extra_dos: false, // PRIMA EXTRA 2+
        chec_extra_tres: false, // PRIMA EXTRA 3+
        custbody179: 0, // MONTO FRACCIONADO (opcional)
        custbody179_date: "", // FECHA (opcional)
        custbody193: "PAGO DE PRIMA FRACCIONADO", // DESCRIPCIÓN FRACCIONADO (opcional)
        custbody180: 1, // TRACTOS FRACCIONADO (opcional)
        custbody181: 0, // MONTO ÚNICO (opcional)
        custbody182_date: "", // FECHA (opcional)
        custbody182: 1, // TRACTOS ÚNICA (opcional)
        custbody194: "PAGO DE PRIMA ÚNICA", // DESCRIPCIÓN ÚNICA (opcional)
        custbody183: 0, // MONTO EXTRA-ORDINARIA (opcional
        custbody184_date: "", // FECHA (opcional)
        custbody184: 1, // TRACTOS EXTRA-ORDINARIA (opcional)
        custbody195: "PAGO DE PRIMA EXTRA-ORDINARIA", // DESCRIPCIÓN EXTRA-ORDINARIA (opcional)
        o_2_uno_input: 0, // MONTO PRIMA EXTRA 1+ (opcional)
        custbody184_uno: 1, // FECHA (opcional)
        custbody184_uno_date: "", // TRACTOS PRIMA EXTRA 1+ (opcional)
        custbody195_uno: "PAGO DE PRIMA EXTRA 1+", // DESCRIPCIÓN PRIMA EXTRA 1+ (opcional)
        o_2_dos_input: 0, // MONTO PRIMA EXTRA 2+ (opcional)
        custbody184_dos: 1, // FECHA (opcional)
        custbody184_dos_date: "", // TRACTOS PRIMA EXTRA
        custbody195_dos: "PAGO DE PRIMA EXTRA 2+", // DESCRIPCIÓN PRIMA EXTRA 2+ (opcional)
        o_2_tres_input: 0, // MONTO PRIMA EXTRA 3+ (opcional)
        custbody184_tres: 1, // FECHA (opcional)
        custbody184_tres_date: "", // TRACTOS PRIMA EXTRA
        custbody195_tres: "PAGO DE PRIMA EXTRA 3+", // DESCRIPCIÓN PRIMA EXTRA
        custbody75_estimacion: "", // MONTO ESTIMACIÓN (opcional)
    });

    // Estado para manejar los errores del formulario
    const [errors, setErrors] = useState({});

    // Reglas de validación: Determina qué campos son obligatorios
    const validationRules = {
        entity: { required: false, message: "El nombre del cliente es obligatorio" },
    };

    const handleDiscountSelection = (e) => {
        const { value } = e.target;
        setFormValues({
            ...formValues,
            isDiscounted: value === "" ? null : value,
        });
    };

    // Maneja cambios en los inputs
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        // Crear una variable para el nuevo valor
        let newValue = type === "checkbox" ? checked : value;

        // Lista de campos específicos que necesitan ser procesados con la función limpiarCampos
        const campos = ["custbody132", "custbody46", "custbodyix_salesorder_cashback", "custbody52", "custbody16"];

        // Verifica si el campo actual (name) está en la lista de campos a procesar
        if (campos.includes(name)) {
            // Si el campo está en la lista, se aplica la función limpiarCampos al valor
            newValue = limpiarCampos(value);
        }

        // Actualizar los valores del formulario
        setFormValues({
            ...formValues,
            [name]: newValue, // Asignar el valor limpio y modificado
        });
        setErrors({ ...errors, [name]: "" });
    };

    // Valida el formulario
    const validateForm = () => {
        const newErrors = {};
        Object.keys(validationRules).forEach((field) => {
            const rule = validationRules[field];
            if (rule.required && !formValues[field]?.trim()) {
                newErrors[field] = rule.message || "Este campo es obligatorio";
            }
        });
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // Maneja el envío del formulario
    const handleSubmit = (e) => {
        e.preventDefault();
        if (validateForm()) {
            console.log("Formulario válido:", formValues);
            // Aquí puedes manejar el envío del formulario
        } else {
            console.log("Errores en el formulario:", errors);
        }
    };

    useEffect(() => {
        if (open) {
            setIsLoading(true);
            const timer = setTimeout(() => setIsLoading(false), 100);
            return () => clearTimeout(timer);
        }
    }, [open]);

    return (
        <Modal open={open} onClose={onClose} className="modal fade show" style={{ display: "block" }} aria-modal="true">
            <div className="modal-dialog" style={{ maxWidth: "89%", margin: "1.75rem auto" }}>
                <div className="modal-content">
                    <div className="modal-body">
                        {isLoading ? (
                            <div className="d-flex justify-content-center align-items-center" style={{ height: "200px" }}>
                                <div className="spinner-border" role="status">
                                    <span className="visually-hidden">Cargando...</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <h4>GENERAR ESTIMACIÓN</h4>
                                <form onSubmit={handleSubmit}>
                                    <PrimeraLinea formValues={formValues} handleInputChange={handleInputChange} />
                                    <CalculodePrima
                                        formValues={formValues}
                                        handleInputChange={handleInputChange}
                                        handleDiscountSelection={handleDiscountSelection}
                                    />
                                    <SeleccionPrima formValues={formValues} handleInputChange={handleInputChange} />
                                    <MetodoPago formValues={formValues} handleInputChange={handleInputChange} />

                                    <button type="submit" className="btn btn-primary">
                                        Guardar Estimacion
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};
