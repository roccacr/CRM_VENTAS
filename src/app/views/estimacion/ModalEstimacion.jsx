import { useState, useEffect } from "react";
import { Modal } from "@mui/material";
import { limpiarCampos } from "../../../hook/useInputFormatter";
import { PrimeraLinea } from "./PrimeraLinea";
import { CalculodePrima } from "./CalculodePrima";
import { SeleccionPrima } from "./SeleccionPrima";
import { MetodoPago } from "./MetodoPago";

export const ModalEstimacion = ({ open, onClose, OportunidadDetails, cliente }) => {
    // Estado para manejar si el contenido del modal está cargando
    const [isLoading, setIsLoading] = useState(true);

    const [formValues, setFormValues] = useState({
        // Datos de la primera línea
        entity: "",
        custbody38: "",
        proyecto_lead_est: "",
        entitystatus: "",

        // Datos de la segunda línea
        rType: "estimacion",
        custbody18: "",
        /*MONTO TOTAL*/
        custbody_ix_total_amount: "",
        /*OPORTUNIDAD*/
        opportunity: "",
        /*PRECIO DE LISTA:*/
        custbody13: "",
        /*SUBSIDIARIA*/
        subsidiary: "",
        /*PRIMA TOTAL*/
        custbody39: 0,
        /*PRIMA%*/
        custbody60: 0.15,
        /*MONTO PRIMA NETA%*/
        custbody_ix_salesorder_monto_prima: 0,
        /*MONTO DESCUENTO DIRECTO%*/
        custbody132: 0,
        /*CASHBACK*/
        custbodyix_salesorder_cashback: 0,

        /*EXTRAS SOBRE EL PRECIO DE LISTA /diferencia*/
        custbody185: "",
        //MONTO EXTRAS SOBRE EL PRECIO DE LISTA / EXTRAS PAGADAS POR EL CLIENTE
        custbody46: 0,
        //MONTO TOTAL DE CORTESÍAS
        custbody16: "",

        //DESCRIPCIÓN EXTRAS
        custbody47: "--",
        //DESCRIPCIÓN DE LAS CORTESIAS
        custbody35: "--",
        //MONTO RESERVA
        rateReserva: "",
        fech_reserva: "",
        //MONTO ASIGNABLE PRIMA NETA:
        neta: "",
        /*-----------Nuevo*/
        //METODO DE PAGO
        custbody75: "",
        custbody67: "",
        custbody_ix_salesorder_hito6: "",
        custbody163: "",
        custbody62: "",
        custbodyix_salesorder_hito1: "",
        custbody63: "",
        custbody_ix_salesorder_hito2: "",
        custbody64: "",
        custbody_ix_salesorder_hito3: "",
        custbody65: "",
        custbody_ix_salesorder_hito4: "",
        custbody66: "",
        custbody_ix_salesorder_hito5: "",
        hito_chek_uno: "",
        hito_chek_dos: "",
        hito_chek_tres: "",
        hito_chek_cuatro: "",
        hito_chek_cinco: "",
        hito_chek_seis: "",
        date_hito_1: "",
        date_hito_2: "",
        date_hito_3: "",
        date_hito_4: "",
        date_hito_5: "",
        date_hito_6: "",
        custbody113: "",
        custbody191: 500,
        custbody188: 1,
        custbody189: "",
        custbody206: "",

        custbody190: "--",
        pre_8: "--",


        custbody176: "",
        custbody179: "",
        custbody180: "",
        custbody193: "",
        custbody179_date: "",

        custbody177: "",
        custbody181: "",
        custbody182: "",
        custbody194: "",
        custbody182_date: "",

        custbody178: "",
        custbody183: "",
        custbody184: "",
        custbody195: "",
        custbody184_date: "",

        prima_extra_uno: "",
        monto_extra_uno: "",
        monto_tracto_uno: "",
        desc_extra_uno: "",
        custbody184_uno_date: "",

        prima_extra_dos: "",
        monto_extra_dos: "",
        monto_tracto_dos: "",
        desc_extra_dos: "",
        custbody184_dos_date: "",

        prima_extra_tres: "",
        monto_extra_tres: "",
        monto_tracto_tres: "",
        desc_extra_tres: "",
        custbody184_tres_date: "",
        custbody114: "",
        isDiscounted: null,
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
        const campos = ["custbody132", "custbody46", "custbodyix_salesorder_cashback", "custbody52", "custbody16", "custbody39", "custbody60"];

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
        if (!open) return; // Si no está abierto, no ejecutamos nada

        setIsLoading(true);

        // Calculamos el monto prima directamente sin necesidad de variables intermedias
        const precioVenta = OportunidadDetails.precioVentaUncio_exp.replace(/\D/g, "");
        const montoPrima = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format((precioVenta * 0.15) / 100); // 15% de precioVenta

        // Actualizamos el formulario con los valores requeridos
        setFormValues((prevValues) => ({
            ...prevValues,
            entity: cliente.nombre_lead,
            custbody114: OportunidadDetails.entregaEstimada,
            proyecto_lead_est: cliente.proyecto_lead,
            custbody38: OportunidadDetails.codigo_exp,
            tranid_oport: OportunidadDetails.tranid_oport,
            expectedclosedate: OportunidadDetails.expectedclosedate_oport,
            entitystatus: OportunidadDetails.Motico_Condicion,
            custbody13: OportunidadDetails.precioVentaUncio_exp,
            custbody18: OportunidadDetails.precioDeVentaMinimo,
            custbody_ix_total_amount: OportunidadDetails.precioVentaUncio_exp,
            custbody39: montoPrima,
            custbody_ix_salesorder_monto_prima: montoPrima,
            neta: montoPrima,
        }));

        setIsLoading(false); // No hay necesidad de un retraso, se puede establecer false inmediatamente
    }, [open, cliente, OportunidadDetails]);

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
