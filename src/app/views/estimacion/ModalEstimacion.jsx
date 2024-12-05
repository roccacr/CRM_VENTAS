import { useState, useEffect } from "react";
import { Modal } from "@mui/material";
import {
    calcularPrimaToal,
    calculoMontoSegunPorcentaje,
    calculoPrimaAsignable,
    calculoPrimaTotalPorcentaje,
    limpiarCampos,
    montoPrimaNeta,
    montoTotal,
    precioVentaNeto,
} from "../../../hook/useInputFormatter";
import { PrimeraLinea } from "./PrimeraLinea";
import { CalculodePrima } from "./CalculodePrima";
import { SeleccionPrima } from "./SeleccionPrima";
import { MetodoPago } from "./MetodoPago";

export const ModalEstimacion = ({ open, onClose, OportunidadDetails, cliente }) => {

    console.log("🚀 ---------------------------------------------------------------------------------------------🚀");
    console.log("🚀 ~ file: ModalEstimacion.jsx:20 ~ ModalEstimacion ~ OportunidadDetails:", OportunidadDetails);
    console.log("🚀 ---------------------------------------------------------------------------------------------🚀");

    // Estado para manejar si el contenido del modal está cargando
    const [isLoading, setIsLoading] = useState(true);

    const [formValues, setFormValues] = useState({
        // Datos de la primera línea
        entity: "",
        custbody38: "",
        proyecto_lead_est: "",
        entitystatus: "",
        pvneto: 121,

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
        custbody16: 0,

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
        // custbody75_estimacion
        custbody75: 1,

        //avance_diferenciado_hito16
        custbody67: 0,
        custbody_ix_salesorder_hito6: "",

        //mspt_contra_entrega
        custbody163: "",
        //avance_diferenciado_hito11
        custbody62: "",
        custbodyix_salesorder_hito1: "",

        //avnace_obra_hito12
        custbody63: "",
        custbody_ix_salesorder_hito2: "",

        //avance_diferenciado_hito13
        custbody64: "",
        custbody_ix_salesorder_hito3: "",

        //avance_diferenciado_hito14
        custbody65: "",
        custbody_ix_salesorder_hito4: "",

        //avance_diferenciado_hito15
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

        // ($('#PRERESERVA').prop('checked')) ? "T" : "F";
        custbody113: "",
        custbody191: 500,
        custbody188: 1,
        custbody189: "",
        custbody206: "",

        custbody190: "--",

        custbody176: "",

        //($('#chec_fra').prop('checked')) ? $("#custbody179").val() : 0;
        custbody179: 0,
        custbody180: 1,
        custbody193: "PAGO DE PRIMA FRACCIONADO",
        custbody179_date: "",

        //($('#chec_uica').prop('checked')) ? "T" : "F";
        custbody177: "",
        custbody181: 0,
        custbody182: 1,
        custbody194: "PAGO DE PRIMA ÚNICA",
        custbody182_date: "",

        // ($('#chec_extra').prop('checked')) ? "T" : "F";
        custbody178: "",
        custbody183: "",
        custbody184: 1,
        custbody195: "",
        custbody184_date: "",

        prima_extra_uno: "",
        monto_extra_uno: 0,
        monto_tracto_uno: 1,
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

        //entrega estimada
        custbody114: "",
        isDiscounted: null,
    });

    // Estado para manejar los errores del formulario
    const [errors, setErrors] = useState({});

    const handleDiscountSelection = (e) => {
        const { value } = e.target;
        setFormValues({
            ...formValues,
            isDiscounted: value === "" ? null : value,
        });
    };

    // Maneja cambios en los inputs del formulario
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        // Determinar el nuevo valor basado en el tipo de input
        let newValue = type === "checkbox" ? checked : value;

        // Campos que requieren limpieza específica
        const campos = ["custbody132", "custbody46", "custbodyix_salesorder_cashback", "custbody52", "custbody16", "custbody39", "custbody60"];

        // Procesar campos específicos con reglas adicionales
        if (campos.includes(name)) {
            newValue = limpiarCampos(value); // Limpia el valor

            // Procesamiento adicional para "custbody132"
            if (name === "custbody132") {
                newValue = `-${newValue.replace(/^-+/, "")}`; // Remueve guiones iniciales dejando solo uno
                if (newValue === "-0" || newValue === "-") {
                    newValue = ""; // Ajusta valores inválidos
                }
            }
        }

        // Actualización para campos que afectan cálculos complejos
        const afectaCalculos = ["custbody132", "custbody46", "custbodyix_salesorder_cashback", "custbody52", "custbody16"];
        if (afectaCalculos.includes(name)) {
            setFormValues((prevValues) => {
                const updatedValues = { ...prevValues, [name]: newValue };

                // Calcula valores derivados
                const pvn = precioVentaNeto(updatedValues); // Precio de venta neto
                const montot = montoTotal(updatedValues); // Monto total
                const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60); // Prima total
                const montoPrimaNet = montoPrimaNeta(montoPrimaTotal, updatedValues); // Prima netapvneto

                // Retorna el nuevo estado actualizado
                return {
                    ...updatedValues,
                    pvneto: pvn,
                    custbody_ix_total_amount: montot,
                    custbody39: montoPrimaTotal,
                    custbody_ix_salesorder_monto_prima: montoPrimaNet,
                };
            });
            return; // Detiene el flujo para evitar actualizaciones innecesarias
        }

        // Actualización para campos relacionados con la prima total
        if (name === "custbody39") {
            setFormValues((prevValues) => {
                const updatedValues = { ...prevValues, [name]: newValue };

                // Calcula valores derivados
                const total = calculoPrimaTotalPorcentaje(updatedValues); // Porcentaje total
                const montoPrimaNet = montoPrimaNeta(newValue, updatedValues); // Prima neta
                const asignable = calculoPrimaAsignable(newValue, updatedValues); // Prima asignable

                // Retorna el nuevo estado actualizado
                return {
                    ...updatedValues,
                    custbody60: total,
                    custbody_ix_salesorder_monto_prima: montoPrimaNet,
                    neta: asignable,
                };
            });
            return; // Detiene el flujo
        }

        // Actualización para campos relacionados con porcentajes
        if (
            [
                "custbody60",
                "custbody179",
                "custbody180",
                "custbody181",
                "custbody182",
                "custbody183",
                "custbody184",
                "monto_extra_uno",
                "monto_tracto_uno",
                "monto_extra_dos",
                "monto_extra_tres",
                "monto_tracto_tres",
            ].includes(name)
        ) {
            setFormValues((prevValues) => {
                const updatedValues = { ...prevValues, [name]: newValue };

                // Calcula valores derivados
                const total = calculoMontoSegunPorcentaje(updatedValues); // Monto total según porcentaje
                const montoPrimaNet = montoPrimaNeta(total, updatedValues); // Prima neta
                const asignable = calculoPrimaAsignable(total, updatedValues); // Prima asignable

                // Retorna el nuevo estado actualizado
                return {
                    ...updatedValues,
                    custbody39: total,
                    custbody_ix_salesorder_monto_prima: montoPrimaNet,
                    neta: asignable,
                };
            });
            return; // Detiene el flujo
        }

        // Actualización genérica para otros campos
        setFormValues({
            ...formValues,
            [name]: newValue,
        });

        // Limpia errores del campo actualizado
        setErrors({ ...errors, [name]: "" });
    };

    // Reglas de validación: Determina qué campos son obligatorios
    const validationRules = {
        entity: { required: false, message: "El nombre del cliente es obligatorio" },
        custbody191: { required: !!formValues.pre_reserva, message: "Pre-reserva: Este campo es obligatorio y debe ser seleccionado." },
        custbody189: { required: !!formValues.pre_reserva, message: "Pre-reserva: Este campo es obligatorio y debe ser seleccionado." },
        custbody206: { required: !!formValues.pre_reserva, message: "Pre-reserva: Este campo es obligatorio y debe ser seleccionado." },
        custbody190: { required: !!formValues.pre_reserva, message: "Pre-reserva: Este campo es obligatorio y debe ser seleccionado." },

        //validamos los campos de primas custbody176
        custbody179: { required: !!formValues.custbody176, message: "Este valor es requerido" },
        custbody179_date: { required: !!formValues.custbody176, message: "Este valor es requerido" },
        custbody180: { required: !!formValues.custbody176, message: "Este valor es requerido" },
        custbody193: { required: !!formValues.custbody176, message: "Este valor es requerido" },

        custbody181: { required: !!formValues.custbody177, message: "Este valor es requerido" },
        custbody182_date: { required: !!formValues.custbody177, message: "Este valor es requerido" },
        custbody182: { required: !!formValues.custbody177, message: "Este valor es requerido" },
        custbody194: { required: !!formValues.custbody177, message: "Este valor es requerido" },

        custbody183: { required: !!formValues.custbody178, message: "Este valor es requerido" },
        custbody184_date: { required: !!formValues.custbody178, message: "Este valor es requerido" },
        custbody184: { required: !!formValues.custbody178, message: "Este valor es requerido" },
        custbody195: { required: !!formValues.custbody178, message: "Este valor es requerido" },

        monto_extra_uno: { required: !!formValues.prima_extra_uno, message: "Este valor es requerido" },
        custbody184_uno_date: { required: !!formValues.prima_extra_uno, message: "Este valor es requerido" },
        monto_tracto_uno: { required: !!formValues.prima_extra_uno, message: "Este valor es requerido" },
        custbody195_uno: { required: !!formValues.prima_extra_uno, message: "Este valor es requerido" },

        monto_extra_dos: { required: !!formValues.prima_extra_dos, message: "Este valor es requerido" },
        custbody184_dos_date: { required: !!formValues.prima_extra_dos, message: "Este valor es requerido" },
        monto_tracto_dos: { required: !!formValues.prima_extra_dos, message: "Este valor es requerido" },
        custbody195_dos: { required: !!formValues.prima_extra_dos, message: "Este valor es requerido" },

        monto_extra_tres: { required: !!formValues.prima_extra_tres, message: "Este valor es requerido" },
        custbody184_tres_date: { required: !!formValues.prima_extra_tres, message: "Este valor es requerido" },
        monto_tracto_tres: { required: !!formValues.prima_extra_tres, message: "Este valor es requerido" },
        custbody195_tres: { required: !!formValues.prima_extra_tres, message: "Este valor es requerido" },

        custbody39: { required: true, message: "Este valor es requerido" },
        custbody60: { required: true, message: "Este valor es requerido" },
    };

    // Valida el formulario
    // Valida el formulario
    const validateForm = () => {
        const newErrors = {};
        Object.keys(validationRules).forEach((field) => {
            const rule = validationRules[field];
            const fieldValue = formValues[field];

            // Verifica si el campo es obligatorio y si su valor es válido
            if (rule.required && (!fieldValue || (typeof fieldValue === "string" && !fieldValue.trim()))) {
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
        if (!open) return; // Salir si el componente no está "abierto"

        setIsLoading(true); // Indicar que estamos cargando datos

        // Convertir el precio de venta a un valor numérico sin caracteres no numéricos
        const precioVenta = parseFloat(OportunidadDetails.precioVentaUncio_exp.replace(/\D/g, ""));

        // Calcular el monto de la prima (15% del precio de venta dividido entre 100)
        const montoPrima = (precioVenta * 0.15) / 100;


        const hito6 = OportunidadDetails.custbody75_oport ===2 ? "100%" : 0;

        // Actualizar el formulario con los valores correspondientes
        setFormValues((prevValues) => ({
            ...prevValues,
            entity: cliente.nombre_lead, // Nombre del cliente
            custbody114: OportunidadDetails.entregaEstimada, // Fecha de entrega estimada
            proyecto_lead_est: cliente.proyecto_lead, // Proyecto asociado al cliente
            custbody38: OportunidadDetails.codigo_exp, // Código de la oportunidad
            tranid_oport: OportunidadDetails.tranid_oport, // ID de la transacción
            expectedclosedate: OportunidadDetails.expectedclosedate_oport, // Fecha de cierre esperada
            entitystatus: OportunidadDetails.Motico_Condicion, // Estado de la oportunidad
            custbody13: OportunidadDetails.precioVentaUncio_exp, // Precio de venta único original
            custbody18: OportunidadDetails.precioDeVentaMinimo, // Precio de venta mínimo
            custbody_ix_total_amount: OportunidadDetails.precioVentaUncio_exp, // Precio de venta total
            custbody39: montoPrima.toFixed(2), // Monto de la prima calculado con dos decimales
            custbody_ix_salesorder_monto_prima: montoPrima.toFixed(2), // Monto de la prima para la orden
            neta: montoPrima.toFixed(2), // Prima neta

            // metodo de pago
            custbody75: OportunidadDetails.custbody75_oport,
            custbody67: hito6,
        }));

        setIsLoading(false); // Finaliza la carga
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
                                    <PrimeraLinea formValues={formValues} handleInputChange={handleInputChange} errors={errors} />
                                    <CalculodePrima
                                        errors={errors}
                                        formValues={formValues}
                                        handleInputChange={handleInputChange}
                                        handleDiscountSelection={handleDiscountSelection}
                                    />
                                    <SeleccionPrima errors={errors} formValues={formValues} handleInputChange={handleInputChange} />
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
