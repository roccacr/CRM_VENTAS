import { useState, useEffect } from "react";
import { Modal } from "@mui/material";
import {
    calcularPrimaToal,
    calculoAvanceDiferenciado,
    calculoAvenceObra,
    calculoContraEntregaMontoCalculado,
    calculoContraEntregaSinprimaTotal,
    calculoHito1Diferenciado,
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
import { data } from "jquery";

export const ModalEstimacion = ({ open, onClose, OportunidadDetails, cliente }) => {
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
        custbody163: 0,
        //avance_diferenciado_hito11
        custbody62: 0.15,
        custbodyix_salesorder_hito1: "",

        //avnace_obra_hito12
        custbody63: 0.25,
        custbody_ix_salesorder_hito2: "",

        //avance_diferenciado_hito13
        custbody64: 0.25,
        custbody_ix_salesorder_hito3: "",

        //avance_diferenciado_hito14
        custbody65: 0.15,
        custbody_ix_salesorder_hito4: "",

        //avance_diferenciado_hito15
        custbody66: 0.15,
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

        // Lista de campos que requieren limpieza específica
        const campos = ["custbody132", "custbody46", "custbodyix_salesorder_cashback", "custbody52", "custbody16", "custbody39", "custbody60"];

        // Procesar campos específicos con reglas adicionales
        if (campos.includes(name)) {
            newValue = limpiarCampos(value); // Limpia el valor usando una función personalizada

            // Procesamiento especial para "custbody132"
            if (name === "custbody132") {
                newValue = `-${newValue.replace(/^-+/, "")}`; // Remueve guiones iniciales dejando solo uno
                if (newValue === "-0" || newValue === "-") {
                    newValue = ""; // Ajusta valores inválidos a vacío
                }
            }
        }

        // Campos que afectan cálculos complejos
        const afectaCalculos = ["custbody132", "custbody46", "custbodyix_salesorder_cashback", "custbody52", "custbody16"];
        if (afectaCalculos.includes(name)) {
            setFormValues((prevValues) => {
                const updatedValues = { ...prevValues, [name]: newValue };

                // Cálculos relacionados con el precio y montos
                const pvn = precioVentaNeto(updatedValues); // Precio de venta neto
                const montot = montoTotal(updatedValues); // Monto total
                const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60); // Prima total
                const montoPrimaNet = montoPrimaNeta(montoPrimaTotal, updatedValues); // Prima neta
                const asignable = calculoPrimaAsignable(montoPrimaTotal, updatedValues); // Prima asignable

                // Cálculos específicos según el tipo de operación
                if (parseInt(updatedValues.custbody75, 10) === 2) {
                    calculoAvenceObra(updatedValues, setFormValues, montot, montoPrimaTotal);
                }

                if (parseInt(updatedValues.custbody75, 10) === 1) {
                    calculoContraEntregaSinprimaTotal(updatedValues, setFormValues);
                    calculoContraEntregaMontoCalculado(updatedValues, setFormValues);
                }

                if (parseInt(updatedValues.custbody75, 10) === 7) {
                    calculoAvanceDiferenciado(updatedValues, setFormValues, montot, montoPrimaTotal);
                }

                // Retorna el estado actualizado con los cálculos
                return {
                    ...updatedValues,
                    pvneto: pvn,
                    neta: asignable,
                    custbody_ix_total_amount: montot,
                    custbody39: montoPrimaTotal,
                    custbody_ix_salesorder_monto_prima: montoPrimaNet,
                };
            });
            return; // Detiene el flujo para evitar actualizaciones innecesarias
        }

        // Procesa cambios en el campo "custbody39" (Prima total)
        if (name === "custbody39") {
            setFormValues((prevValues) => {
                const updatedValues = { ...prevValues, [name]: newValue };

                // Cálculos relacionados con porcentajes y primas
                const total = calculoPrimaTotalPorcentaje(updatedValues); // Porcentaje total
                const montoPrimaNet = montoPrimaNeta(newValue, updatedValues); // Prima neta
                const asignable = calculoPrimaAsignable(newValue, updatedValues); // Prima asignable


                if (parseInt(updatedValues.custbody75, 10) === 2) {
                    const montot = montoTotal(updatedValues); // Monto total
                    const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60); // Prima total
                    calculoAvenceObra(updatedValues, setFormValues, montot, montoPrimaTotal);
                }

                if (parseInt(updatedValues.custbody75, 10) === 1) {
                    calculoContraEntregaSinprimaTotal(updatedValues, setFormValues);
                    calculoContraEntregaMontoCalculado(updatedValues, setFormValues);
                }

                if (parseInt(updatedValues.custbody75, 10) === 7) {
                    const montot = montoTotal(updatedValues); // Monto total
                    const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60); // Prima total
                    calculoAvanceDiferenciado(updatedValues, setFormValues, montot, montoPrimaTotal);
                }

                // Retorna el estado actualizado
                return {
                    ...updatedValues,
                    custbody60: total,
                    custbody_ix_salesorder_monto_prima: montoPrimaNet,
                    neta: asignable,
                };
            });
            return; // Detiene el flujo
        }

        // Procesa cambios en campos relacionados con porcentajes
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

                // Cálculos derivados según el porcentaje
                const total = calculoMontoSegunPorcentaje(updatedValues); // Monto total basado en porcentaje
                const montoPrimaNet = montoPrimaNeta(total, updatedValues); // Prima neta
                const asignable = calculoPrimaAsignable(total, updatedValues); // Prima asignable

                if (parseInt(updatedValues.custbody75, 10) === 2) {
                    const montot = montoTotal(updatedValues); // Monto total
                    const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60); // Prima total
                    calculoAvenceObra(updatedValues, setFormValues, montot, montoPrimaTotal);
                }

                if (parseInt(updatedValues.custbody75, 10) === 1) {
                    calculoContraEntregaSinprimaTotal(updatedValues, setFormValues);
                    calculoContraEntregaMontoCalculado(updatedValues, setFormValues);
                }

                 if (parseInt(updatedValues.custbody75, 10) === 7) {
                     const montot = montoTotal(updatedValues); // Monto total
                     const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60); // Prima total
                     calculoAvanceDiferenciado(updatedValues, setFormValues, montot, montoPrimaTotal);
                 }

                // Retorna el estado actualizado
                return {
                    ...updatedValues,
                    custbody39: total,
                    custbody_ix_salesorder_monto_prima: montoPrimaNet,
                    neta: asignable,
                };
            });
            return; // Detiene el flujo
        }

        if (name === "custbody75") {
           setFormValues((prevValues) => {
               const updatedValues = { ...prevValues, [name]: newValue };

               // Cálculos relacionados con el precio y montos
               const pvn = precioVentaNeto(updatedValues); // Precio de venta neto
               const montot = montoTotal(updatedValues); // Monto total
               const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60); // Prima total
               const montoPrimaNet = montoPrimaNeta(montoPrimaTotal, updatedValues); // Prima neta
               const asignable = calculoPrimaAsignable(montoPrimaTotal, updatedValues); // Prima asignable

               // Cálculos específicos según el tipo de operación
               if (parseInt(updatedValues.custbody75, 10) === 2) {
                   calculoAvenceObra(updatedValues, setFormValues, montot, montoPrimaTotal);
               }

               if (parseInt(updatedValues.custbody75, 10) === 1) {
                   calculoContraEntregaSinprimaTotal(updatedValues, setFormValues);
                   calculoContraEntregaMontoCalculado(updatedValues, setFormValues);
               }

                if (parseInt(updatedValues.custbody75, 10) === 7) {
                    const montot = montoTotal(updatedValues); // Monto total
                    const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60); // Prima total
                    calculoAvanceDiferenciado(updatedValues, setFormValues, montot, montoPrimaTotal);
                }

               // Retorna el estado actualizado con los cálculos
               return {
                   ...updatedValues,
                   pvneto: pvn,
                   neta: asignable,
                   custbody_ix_total_amount: montot,
                   custbody39: montoPrimaTotal,
                   custbody_ix_salesorder_monto_prima: montoPrimaNet,
               };
           });
            return;
        }

        if (name === "custbody62") {
            setFormValues((prevValues) => {
                const updatedValues = { ...prevValues, [name]: newValue };
                const montot = montoTotal(updatedValues); // Monto total
                const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60); // Prima total
                calculoHito1Diferenciado(newValue, montot, montoPrimaTotal, setFormValues, updatedValues);


                // Retorna el estado actualizado con los cálculos
                return {
                    ...updatedValues,
                };
            });
            return;
        }

        // Actualización genérica para otros campos
        setFormValues({
            ...formValues,
            [name]: newValue,
        });

        // Limpia errores del campo actualizado
        setErrors({ ...errors, [name]: "" });
    };

    // Reglas de validación: Configuran los campos del formulario indicando si son obligatorios y el mensaje de error correspondiente
    const validationRules = {
        // Validación del cliente
        entity: {
            required: false, // Este campo no es obligatorio
            message: "El nombre del cliente es obligatorio", // Mensaje en caso de que sea requerido en el futuro
        },

        // Validaciones para campos relacionados con pre-reserva
        custbody191: {
            required: !!formValues.pre_reserva, // Obligatorio solo si hay una pre-reserva activa
            message: "Pre-reserva: Este campo es obligatorio y debe ser seleccionado.",
        },
        custbody189: {
            required: !!formValues.pre_reserva,
            message: "Pre-reserva: Este campo es obligatorio y debe ser seleccionado.",
        },
        custbody206: {
            required: !!formValues.pre_reserva,
            message: "Pre-reserva: Este campo es obligatorio y debe ser seleccionado.",
        },
        custbody190: {
            required: !!formValues.pre_reserva,
            message: "Pre-reserva: Este campo es obligatorio y debe ser seleccionado.",
        },

        // Validaciones para campos relacionados con primas (custbody176)
        custbody179: {
            required: !!formValues.custbody176,
            message: "Este valor es requerido",
        },
        custbody179_date: {
            required: !!formValues.custbody176,
            message: "Este valor es requerido",
        },
        custbody180: {
            required: !!formValues.custbody176,
            message: "Este valor es requerido",
        },
        custbody193: {
            required: !!formValues.custbody176,
            message: "Este valor es requerido",
        },

        // Validaciones para otras primas relacionadas (custbody177 y custbody178)
        custbody181: {
            required: !!formValues.custbody177,
            message: "Este valor es requerido",
        },
        custbody182_date: {
            required: !!formValues.custbody177,
            message: "Este valor es requerido",
        },
        custbody182: {
            required: !!formValues.custbody177,
            message: "Este valor es requerido",
        },
        custbody194: {
            required: !!formValues.custbody177,
            message: "Este valor es requerido",
        },

        custbody183: {
            required: !!formValues.custbody178,
            message: "Este valor es requerido",
        },
        custbody184_date: {
            required: !!formValues.custbody178,
            message: "Este valor es requerido",
        },
        custbody184: {
            required: !!formValues.custbody178,
            message: "Este valor es requerido",
        },
        custbody195: {
            required: !!formValues.custbody178,
            message: "Este valor es requerido",
        },

        // Validaciones para primas adicionales (prima_extra_uno, prima_extra_dos, prima_extra_tres)
        monto_extra_uno: {
            required: !!formValues.prima_extra_uno,
            message: "Este valor es requerido",
        },
        custbody184_uno_date: {
            required: !!formValues.prima_extra_uno,
            message: "Este valor es requerido",
        },
        monto_tracto_uno: {
            required: !!formValues.prima_extra_uno,
            message: "Este valor es requerido",
        },
        custbody195_uno: {
            required: !!formValues.prima_extra_uno,
            message: "Este valor es requerido",
        },

        monto_extra_dos: {
            required: !!formValues.prima_extra_dos,
            message: "Este valor es requerido",
        },
        custbody184_dos_date: {
            required: !!formValues.prima_extra_dos,
            message: "Este valor es requerido",
        },
        monto_tracto_dos: {
            required: !!formValues.prima_extra_dos,
            message: "Este valor es requerido",
        },
        custbody195_dos: {
            required: !!formValues.prima_extra_dos,
            message: "Este valor es requerido",
        },

        monto_extra_tres: {
            required: !!formValues.prima_extra_tres,
            message: "Este valor es requerido",
        },
        custbody184_tres_date: {
            required: !!formValues.prima_extra_tres,
            message: "Este valor es requerido",
        },
        monto_tracto_tres: {
            required: !!formValues.prima_extra_tres,
            message: "Este valor es requerido",
        },
        custbody195_tres: {
            required: !!formValues.prima_extra_tres,
            message: "Este valor es requerido",
        },

        // Validación de campos esenciales
        custbody39: {
            required: true, // Campo siempre obligatorio
            message: "Este valor es requerido",
        },
        custbody60: {
            required: true, // Campo siempre obligatorio
            message: "Este valor es requerido",
        },

        date_hito_6: {
            required: parseInt(formValues.custbody75, 10) === 1 ? true : false, // Campo obligatorio si custbody75 es igual a 2
            message: "Este valor es requerido",
        },
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
        e.preventDefault(); // Previene el comportamiento predeterminado del formulario (recargar la página)

        // Valida los datos del formulario antes de proceder
        if (validateForm()) {
            console.log("Formulario válido:", formValues); // Imprime los valores del formulario si la validación es exitosa

            // Aquí puedes implementar la lógica para enviar los datos del formulario,
            // como realizar una solicitud a un servidor o actualizar el estado global
        } else {
            console.log("Errores en el formulario:", errors); // Imprime los errores si la validación falla
        }
    };

    useEffect(() => {
        if (!open) return; // Si el componente no está "abierto", salir inmediatamente

        setIsLoading(true); // Indicar que se está cargando la información necesaria

        // Extraer datos de la oportunidad y del cliente
        const dataOportunidad = OportunidadDetails;
        const dataCliente = cliente;

        // Convertir el precio de venta único en un valor numérico eliminando caracteres no numéricos
        const precioVenta = parseFloat(dataOportunidad.precioVentaUncio_exp.replace(/\D/g, ""));

        // Calcular el monto de la prima como el 15% del precio de venta (escala de 0 a 100)
        const montoPrima = (precioVenta * 0.15) / 100;

        // Determinar el valor para "hito6" basado en una condición específica
        let hito6 = 0;
        hito6 = parseInt(dataOportunidad.custbody75_oport, 10) === 1 ? "100%" : parseInt(dataOportunidad.custbody75_oport, 10) === 2 ? "0.05" : 0;

        // Obtener la fecha actual y formatearla como mm/dd/yyyy
         const today = new Date();
         const formattedDate = today.toISOString().split("T")[0];
         const entregaEstimada = dataOportunidad.entregaEstimada ? dataOportunidad.entregaEstimada.split("/").reverse().join("-") : "";

        // Actualizar los valores del formulario con la información procesada
        setFormValues((prevValues) => ({
            ...prevValues,
            entity: dataCliente.nombre_lead, // Asignar el nombre del cliente
            custbody114: dataOportunidad.entregaEstimada, // Fecha estimada de entrega
            proyecto_lead_est: dataCliente.proyecto_lead, // Proyecto asociado al cliente
            custbody38: dataOportunidad.codigo_exp, // Código único de la oportunidad
            tranid_oport: dataOportunidad.tranid_oport, // ID de transacción de la oportunidad
            expectedclosedate: dataOportunidad.expectedclosedate_oport, // Fecha esperada de cierre
            entitystatus: dataOportunidad.Motico_Condicion, // Estado o condición de la oportunidad
            custbody13: dataOportunidad.precioVentaUncio_exp, // Precio de venta único original
            custbody18: dataOportunidad.precioDeVentaMinimo, // Precio mínimo permitido para la venta
            custbody_ix_total_amount: dataOportunidad.precioVentaUncio_exp, // Total del precio de venta
            custbody39: montoPrima.toFixed(2), // Prima calculada con dos decimales
            custbody_ix_salesorder_monto_prima: montoPrima.toFixed(2), // Monto de la prima para la orden de venta
            neta: montoPrima.toFixed(2), // Prima neta calculada con precisión

            // Método de pago y otros campos adicionales
            custbody75: dataOportunidad.custbody75_oport, // Método de pago seleccionado
            custbody67: hito6, // Hito de progreso basado en condiciones específicas
            fech_reserva: formattedDate, // Fecha de la reserva
            date_hito_6: entregaEstimada,
        }));

        setIsLoading(false); // Indicar que la carga de datos ha finalizado
    }, [open, cliente, OportunidadDetails]);

    return (
        // Componente Modal que se muestra cuando `open` es true
        <Modal
            open={open}
            onClose={onClose}
            className="modal fade show"
            style={{ display: "block" }} // Forzar que el modal siempre se muestre en pantalla
            aria-modal="true" // Indicador de accesibilidad para navegadores
        >
            <div
                className="modal-dialog"
                style={{ maxWidth: "89%", margin: "1.75rem auto" }} // Estilo personalizado para el tamaño y centrado del modal
            >
                <div className="modal-content">
                    <div className="modal-body">
                        {isLoading ? (
                            // Mostrar un indicador de carga mientras los datos se procesan
                            <div
                                className="d-flex justify-content-center align-items-center"
                                style={{ height: "200px" }} // Asegurar el centrado vertical y horizontal del spinner
                            >
                                <div className="spinner-border" role="status">
                                    <span className="visually-hidden">Cargando...</span> {/* Texto accesible para lectores de pantalla */}
                                </div>
                            </div>
                        ) : (
                            // Contenido principal del modal cuando no está cargando
                            <>
                                <h4>GENERAR ESTIMACIÓN</h4> {/* Título principal del modal */}
                                <form onSubmit={handleSubmit}>
                                    {" "}
                                    {/* Manejo del envío del formulario */}
                                    {/* Componente para gestionar la primera línea del formulario */}
                                    <PrimeraLinea formValues={formValues} handleInputChange={handleInputChange} errors={errors} />
                                    {/* Componente para cálculo de primas */}
                                    <CalculodePrima
                                        errors={errors}
                                        formValues={formValues}
                                        handleInputChange={handleInputChange}
                                        handleDiscountSelection={handleDiscountSelection}
                                    />
                                    {/* Componente para selección de primas */}
                                    <SeleccionPrima errors={errors} formValues={formValues} handleInputChange={handleInputChange} />
                                    {/* Componente para selección de método de pago */}
                                    <MetodoPago formValues={formValues} handleInputChange={handleInputChange} errors={errors} />
                                    {/* Botón para guardar la estimación */}
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
