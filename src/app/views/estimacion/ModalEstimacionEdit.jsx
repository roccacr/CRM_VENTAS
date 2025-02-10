import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { Modal } from "@mui/material";
import { useDispatch } from "react-redux";
import {
    calcularPrimaToal,
    calculoAvanceDiferenciado,
    calculoAvenceObra,
    calculoContraEntregaMontoCalculado,
    calculoContraEntregaSinprimaTotal,
    calculoHito1Diferenciado,
    calculoHito1DiferenciadoMonto,
    calculoMontoSegunPorcentaje,
    calculoPrimaAsignable,
    calculoPrimaTotalPorcentaje,
    limpiarCampos,
    montoPrimaNeta,
    montoTotal,
    precioVentaNeto,
    recalcultarMontoshitos,
} from "../../../hook/useInputFormatter";
import { PrimeraLinea } from "./PrimeraLinea";
import { CalculodePrima } from "./CalculodePrima";
import { SeleccionPrima } from "./SeleccionPrima";
import { MetodoPago } from "./MetodoPago";
import { crearEstimacionFormulario, extarerEstimacion } from "../../../store/estimacion/thunkEstimacion";

export const ModalEstimacionEdit = ({ open, onClose, idEstimacion }) => {
    // Estado para manejar si el contenido del modal está cargando
    const [isLoading, setIsLoading] = useState(false);
    const dispatch = useDispatch();

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
        custbody185: 2000,
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
        custbody75: 0,

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
        hito_chek_uno: false,
        hito_chek_dos: false,
        hito_chek_tres: false,
        hito_chek_cuatro: false,
        hito_chek_cinco: false,
        hito_chek_seis: false,
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
        custbody193: "PRIMA",
        custbody179_date: "",

        //($('#chec_uica').prop('checked')) ? "T" : "F";
        custbody177: "",
        custbody181: 0,
        custbody182: 1,
        custbody194: "PRIMA",
        custbody182_date: "",

        // ($('#chec_extra').prop('checked')) ? "T" : "F";
        custbody178: "",
        custbody183: "",
        custbody184: 1,
        custbody195: "PRIMA",
        custbody184_date: "",

        prima_extra_uno: "",
        monto_extra_uno: 0,
        monto_tracto_uno: 1,
        desc_extra_uno: "PRIMA",
        custbody184_uno_date: "",

        prima_extra_dos: "",
        monto_extra_dos: "",
        monto_tracto_dos: 1,
        desc_extra_dos: "PRIMA",
        custbody184_dos_date: "",

        prima_extra_tres: "",
        monto_extra_tres: "",
        monto_tracto_tres: 1,
        desc_extra_tres: "PRIMA",
        custbody184_tres_date: "",

        //entrega estimada
        custbody114: "",
        isDiscounted: null,

        total_porcentaje: "100",
        valortotals: 0,
        custbody52: 0,
        pre_reserva: false,


    });

    // Estado para manejar los errores del formulario
    const [errors, setErrors] = useState({});

    // Maneja la selección de descuento por parte del usuario
    const handleDiscountSelection = (e) => {
        // Extrae el valor seleccionado del evento
        const { value } = e.target;

        // Actualiza el estado del formulario con el valor seleccionado.
        // Si el valor está vacío, se establece isDiscounted como null, de lo contrario, se guarda el valor.
        setFormValues({
            ...formValues, // Mantiene los valores actuales del formulario
            isDiscounted: value === "" ? null : value, // Asigna null si el valor es vacío, de lo contrario, asigna el valor
        });
    };

    // Maneja los cambios en los inputs del formulario
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        // Determina el nuevo valor según el tipo de input
        const newValue = type === "checkbox" ? checked : value;

        // Lista de campos que requieren limpieza específica
        const camposLimpieza = [
            "custbody132",
            "custbody46",
            "custbodyix_salesorder_cashback",
            "custbody52",
            "custbody16",
            "custbody39",
            "custbody60",
        ];

        // Mapeo de los campos relacionados con cada hito para facilitar la actualización del estado
        const hitoMappings = {
            hito_chek_uno: { custbody: "custbody62", salesOrder: "custbodyix_salesorder_hito1", date: "date_hito_1" },
            hito_chek_dos: { custbody: "custbody63", salesOrder: "custbody_ix_salesorder_hito2", date: "date_hito_2" },
            hito_chek_tres: { custbody: "custbody64", salesOrder: "custbody_ix_salesorder_hito3", date: "date_hito_3" },
            hito_chek_cuatro: { custbody: "custbody65", salesOrder: "custbody_ix_salesorder_hito4", date: "date_hito_4" },
            hito_chek_cinco: { custbody: "custbody66", salesOrder: "custbody_ix_salesorder_hito5", date: "date_hito_5" },
            hito_chek_seis: { custbody: "custbody67", salesOrder: "custbody_ix_salesorder_hito6", date: "date_hito_6" },
        };

        // Verifica si el nombre del hito existe en el mapeo
        if (hitoMappings[name]) {
            // Extrae los nombres de los campos relevantes para el hito actual
            const { custbody, salesOrder, date } = hitoMappings[name];

            // Actualiza el estado del formulario
            setFormValues((prevValues) => {
                // Construye un nuevo objeto de estado con los valores actualizados
                const updatedValues = {
                    ...prevValues, // Mantiene los valores previos del estado
                    [custbody]: "0", // Reinicia el valor asociado al campo custbody del hito
                    [salesOrder]: 0, // Reinicia el valor del campo de orden de venta asociado
                    [date]: "", // Limpia la fecha asociada al hito
                    [name]: newValue, // Actualiza el valor del checkbox del hito
                };

                // Recalcula los montos de los hitos usando los valores actualizados
                recalcultarMontoshitos(updatedValues, setFormValues);

                return updatedValues; // Retorna el nuevo estado para actualizar
            });
        }

        // Aplica reglas específicas de limpieza para ciertos campos
        // Si el campo actual está en la lista de `camposLimpieza`, procesa el valor con una función personalizada.
        // De lo contrario, usa el valor nuevo sin procesamiento adicional.
        const valorProcesado = camposLimpieza.includes(name) ? procesarValor(name, value) : newValue;

        // Define una lista de campos que requieren cálculos complejos antes de ser actualizados
        const camposCalculos = ["custbody132", "custbody46", "custbodyix_salesorder_cashback", "custbody52", "custbody16"];
        if (camposCalculos.includes(name)) {
            // Realiza cálculos complejos específicos para el campo actual
            actualizarConCalculos(name, valorProcesado);
            return; // Termina la ejecución para evitar pasos adicionales innecesarios
        }

        // Maneja cambios específicos en el campo de "prima total"
        // Se utiliza una función especializada para actualizar este campo
        if (name === "custbody39") {
            actualizarPrimaTotal(name, valorProcesado);
            return; // Detiene el flujo después de manejar este caso específico
        }

        //limpiamos lo valores de las primas cuando se deselecciona el checkbox
        if (name === "custbody39") {
            actualizarPrimaTotal(name, valorProcesado);
            return; // Detiene el flujo después de manejar este caso específico
        }

        // /// Maneja cambios relacionados con porcentajes
        // // Define una lista de campos que representan porcentajes y requieren un manejo específico
        const camposPorcentaje = [
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
        ];

        // Si el campo pertenece a `camposPorcentaje`, utiliza la función para actualizar el valor del porcentaje
        if (camposPorcentaje.includes(name)) {
            actualizarPorcentaje(name, valorProcesado);
            return; // Detiene el flujo después de manejar el campo
        }

        // Define manejadores específicos para ciertos campos, ejecutando lógica personalizada
        const manejadores = {
            custbody75: () => actualizarCustbody75(name, valorProcesado), // Lógica para el campo `custbody75`
            custbody62: () => actualizarHitoDiferenciado(name, valorProcesado, "custbodyix_salesorder_hito1"), // Hito 1
            custbody63: () => actualizarHitoDiferenciado(name, valorProcesado, "custbody_ix_salesorder_hito2"), // Hito 2
            custbody64: () => actualizarHitoDiferenciado(name, valorProcesado, "custbody_ix_salesorder_hito3"), // Hito 3
            custbody65: () => actualizarHitoDiferenciado(name, valorProcesado, "custbody_ix_salesorder_hito4"), // Hito 4
            custbody66: () => actualizarHitoDiferenciado(name, valorProcesado, "custbody_ix_salesorder_hito5"), // Hito 5
            custbody67: () => actualizarHitoDiferenciado(name, valorProcesado, "custbody_ix_salesorder_hito6"), // Hito 6
        };

        // Define manejadores específicos para actualizar montos asociados a los hitos
        const manejadoresMonto = {
            custbodyix_salesorder_hito1: () => actualizarHitoDiferenciadoMonto(name, valorProcesado, "custbody62"), // Monto Hito 1
            custbody_ix_salesorder_hito2: () => actualizarHitoDiferenciadoMonto(name, valorProcesado, "custbody63"), // Monto Hito 2
            custbody_ix_salesorder_hito3: () => actualizarHitoDiferenciadoMonto(name, valorProcesado, "custbody64"), // Monto Hito 3
            custbody_ix_salesorder_hito4: () => actualizarHitoDiferenciadoMonto(name, valorProcesado, "custbody65"), // Monto Hito 4
            custbody_ix_salesorder_hito5: () => actualizarHitoDiferenciadoMonto(name, valorProcesado, "custbody66"), // Monto Hito 5
            custbody_ix_salesorder_hito6: () => actualizarHitoDiferenciadoMonto(name, valorProcesado, "custbody67"), // Monto Hito 6
        };

        // Verifica si el campo tiene un manejador asignado y lo ejecuta
        if (manejadores[name]) {
            manejadores[name](); // Lógica específica para el campo
        }

        // Verifica si el campo tiene un manejador de monto asignado y lo ejecuta
        if (manejadoresMonto[name]) {
            manejadoresMonto[name](); // Lógica específica para actualizar el monto asociado al campo
        }

        // Actualización genérica para otros campos
        // Si el campo no requiere manejo especial, simplemente actualiza su valor en el estado del formulario
        setFormValues({
            ...formValues, // Mantiene los valores actuales del formulario
            [name]: valorProcesado, // Actualiza el valor del campo específico con el valor procesado
        });

        // Limpia errores relacionados con el campo
        // Establece el mensaje de error del campo como vacío para indicar que no hay errores
        setErrors({
            ...errors, // Mantiene los errores existentes de otros campos
            [name]: "", // Elimina cualquier error asociado al campo actualizado
        });

        // Mapa de campos a restablecer por cada checkbox de primas
        const mapaPrimas = {
            custbody176: {
                campos: ["custbody179", "custbody179_date", "custbody180", "custbody193"],
                numero: 1,
            },
            custbody177: {
                campos: ["custbody181", "custbody182_date", "custbody182", "custbody194"],
                numero: 2,
            },
            custbody178: {
                campos: ["custbody183", "custbody184_date", "custbody184", "custbody195"],
                numero: 3,
            },
            prima_extra_uno: {
                campos: ["monto_extra_uno", "custbody184_uno_date", "monto_tracto_uno", "desc_extra_uno"],
                numero: 4,
            },
            prima_extra_dos: {
                campos: ["monto_extra_dos", "custbody184_dos_date", "monto_tracto_dos", "desc_extra_dos"],
                numero: 5,
            },
            prima_extra_tres: {
                campos: ["monto_extra_tres", "custbody184_tres_date", "monto_tracto_tres", "desc_extra_tres"],
                numero: 6,
            },
        };

        // Lógica única para manejar todas las primas
        if (mapaPrimas[name] && !newValue) {
            // Obtener configuración de la prima actual
            const { campos, numero } = mapaPrimas[name];

            // Actualizar porcentaje primero
            actualizarPorcentaje(name, valorProcesado);

            // Restablecer campos relacionados
            setFormValues((prevValues) => ({
                ...prevValues,
                [campos[0]]: "0", // Restablece monto
                [campos[1]]: "", // Limpia fecha
                [campos[2]]: 1, // Tractos a 1
                [campos[3]]: `PRIMA ${numero}`, // Descripción estándar
            }));
        }
    };

    // Procesa el valor de campos específicos con reglas adicionales
    const procesarValor = (name, value) => {
        // Aplica una limpieza inicial al valor utilizando una función genérica
        let processedValue = limpiarCampos(value);

        // Aplica reglas específicas para el campo "custbody132"
        if (name === "custbody132") {
            // Asegura que el valor procesado tenga un solo guion inicial
            processedValue = `-${processedValue.replace(/^-+/, "")}`;

            // Si el valor es "-0" o solo "-", lo ajusta a una cadena vacía para evitar valores inválidos
            if (processedValue === "-0" || processedValue === "-") {
                processedValue = ""; // Establece como vacío para mantener consistencia
            }
        }

        // Retorna el valor procesado (ya sea limpio o con las reglas específicas aplicadas)
        return processedValue;
    };

    // Actualiza el estado con cálculos complejos según el campo modificado
    const actualizarConCalculos = (name, value) => {
        // Actualiza el estado utilizando la función `setFormValues`
        setFormValues((prevValues) => {
            // Copia el estado actual y actualiza el valor del campo modificado
            const updatedValues = { ...prevValues, [name]: value };

            // Calcula el precio de venta neto basado en los valores actualizados
            const pvn = precioVentaNeto(updatedValues);

            // Calcula el monto total basado en los valores actualizados
            const montot = montoTotal(updatedValues);

            // Calcula la prima total utilizando el monto total y un valor porcentual (`custbody60`)
            const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60);

            // Calcula la prima neta basándose en la prima total y otros valores actualizados
            const montoPrimaNet = montoPrimaNeta(montoPrimaTotal, updatedValues);

            // Calcula el valor asignable para la prima utilizando la prima total y valores adicionales
            const asignable = calculoPrimaAsignable(montoPrimaTotal, updatedValues);

            // Ejecuta cálculos específicos adicionales, si es necesario, utilizando los valores actualizados
            ejecutarCálculosEspecíficos(updatedValues, montot, montoPrimaTotal);

            // Retorna el nuevo estado con todos los valores calculados incluidos
            return {
                ...updatedValues, // Mantiene los valores actualizados del estado
                pvneto: pvn, // Asigna el precio de venta neto
                neta: asignable, // Asigna la prima asignable calculada
                custbody_ix_total_amount: montot, // Asigna el monto total calculado
                custbody39: montoPrimaTotal, // Asigna la prima total calculada
                custbody_ix_salesorder_monto_prima: montoPrimaNet, // Asigna la prima neta calculada
            };
        });
    };

    // Actualiza el estado al modificar custbody39 (Prima total)
    const actualizarPrimaTotal = (name, value) => {
        setFormValues((prevValues) => {
            // Copia el estado actual y actualiza el valor de "custbody39" (Prima total)
            const updatedValues = { ...prevValues, [name]: value };

            // Calcula el porcentaje total de prima basado en los valores actualizados
            const total = calculoPrimaTotalPorcentaje(updatedValues);

            // Calcula la prima neta utilizando el nuevo valor de prima total y los valores actualizados
            const montoPrimaNet = montoPrimaNeta(value, updatedValues);

            // Calcula la prima asignable a partir del nuevo valor de prima total y los valores actuales
            const asignable = calculoPrimaAsignable(value, updatedValues);

            // Ejecuta cálculos adicionales personalizados según los valores actualizados
            ejecutarCálculosEspecíficos(updatedValues);

            // Retorna el nuevo estado actualizado con los valores calculados
            return {
                ...updatedValues, // Mantiene los valores existentes del estado
                custbody60: total, // Asigna el porcentaje total calculado
                custbody_ix_salesorder_monto_prima: montoPrimaNet, // Actualiza la prima neta calculada
                neta: asignable, // Actualiza la prima asignable calculada
            };
        });
    };

    /**
     * Maneja la actualización de campos relacionados con porcentajes en el formulario.
     * Realiza cálculos basados en el valor actualizado y actualiza el estado del formulario
     * con los nuevos valores calculados.
     *
     * @param {string} name - El nombre del campo que se está actualizando.
     * @param {number} value - El nuevo valor del campo.
     */
    const actualizarPorcentaje = (name, value) => {
        setFormValues((prevValues) => {
            // 1. Copia el estado actual del formulario y actualiza el valor del campo específico.
            const updatedValues = { ...prevValues, [name]: value };

            // 2. Calcula el monto total basado en el porcentaje actualizado.
            const total = calculoMontoSegunPorcentaje(updatedValues);

            // 3. Calcula la prima neta basada en el monto total y los valores actualizados.
            const montoPrimaNet = montoPrimaNeta(total, updatedValues);

            // 4. Calcula la prima asignable utilizando el monto total y los valores actuales.
            const asignable = calculoPrimaAsignable(total, updatedValues);

            // 5. Ejecuta cálculos adicionales personalizados si es necesario.
            ejecutarCálculosEspecíficos(updatedValues);

            // 6. Si el campo actualizado es "custbody60", retorna un estado con campos adicionales.
            if (name === "custbody60") {
                return {
                    ...updatedValues, // Mantiene todos los valores existentes del estado.
                    custbody39: total, // Actualiza el monto total calculado.
                    custbody_ix_salesorder_monto_prima: montoPrimaNet, // Actualiza la prima neta calculada.
                    neta: asignable, // Actualiza la prima asignable calculada.
                };
            }

            // 7. Si el campo no es "custbody60", retorna un estado sin los campos adicionales.
            return {
                ...updatedValues, // Mantiene todos los valores existentes del estado.
                neta: asignable, // Actualiza la prima asignable calculada.
            };
        });
    };

    // Maneja actualizaciones del campo custbody75
    const actualizarCustbody75 = (name, value) => {
        setFormValues((prevValues) => {
            // Copia el estado actual y actualiza el valor de "custbody75"
            const updatedValues = { ...prevValues, [name]: value };

            // Calcula el precio de venta neto basado en los valores actualizados
            const pvn = precioVentaNeto(updatedValues);

            // Calcula el monto total basado en los valores actualizados
            const montot = montoTotal(updatedValues);

            // Calcula la prima total utilizando el monto total y un porcentaje definido (`custbody60`)
            const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60);

            // Calcula la prima neta utilizando la prima total y los valores actualizados
            const montoPrimaNet = montoPrimaNeta(montoPrimaTotal, updatedValues);

            // Calcula la prima asignable utilizando la prima total y los valores actualizados
            const asignable = calculoPrimaAsignable(montoPrimaTotal, updatedValues);

            // Ejecuta cálculos adicionales personalizados basados en los valores calculados
            ejecutarCálculosEspecíficos(updatedValues, montot, montoPrimaTotal);

            // Retorna el nuevo estado actualizado con los valores calculados
            return {
                ...updatedValues, // Mantiene los valores existentes del estado
                pvneto: pvn, // Actualiza el precio de venta neto calculado
                neta: asignable, // Actualiza la prima asignable calculada
                custbody_ix_total_amount: montot, // Actualiza el monto total calculado
                custbody39: montoPrimaTotal, // Actualiza la prima total calculada
                custbody_ix_salesorder_monto_prima: montoPrimaNet, // Actualiza la prima neta calculada
            };
        });
    };

    // Maneja actualizaciones específicas para custbody62
    const actualizarHitoDiferenciado = (name, value, campoActualizar) => {
        setFormValues((prevValues) => {
            // Copia el estado actual y actualiza el valor del campo modificado
            const updatedValues = { ...prevValues, [name]: value };

            // Calcula el monto total y la prima total utilizando los valores actualizados
            const montot = montoTotal(updatedValues);
            const montoPrimaTotal = calcularPrimaToal(montot, updatedValues.custbody60);

            // Porcentaje inicial (100%)
            const porcentajeInicial = 100;

            // Define los porcentajes relacionados a los hitos, considerando si están marcados como chequeados
            const porcentajes = [
                updatedValues.hito_chek_uno === true ? updatedValues.custbody62 : 0,
                updatedValues.hito_chek_dos === true ? updatedValues.custbody63 : 0,
                updatedValues.hito_chek_tres === true ? updatedValues.custbody64 : 0,
                updatedValues.hito_chek_cuatro === true ? updatedValues.custbody65 : 0,
                updatedValues.hito_chek_cinco === true ? updatedValues.custbody66 : 0,
                updatedValues.hito_chek_seis === true ? updatedValues.custbody67 : 0,
            ];

            // Suma los porcentajes válidos después de convertirlos a números
            const sumaPorcentajes = porcentajes
                .map((p) => parseFloat(p) || 0) // Convierte cada valor a número o lo reemplaza por 0 si no es válido
                .reduce((sum, value) => sum + value, 0); // Suma todos los porcentajes

            // Calcula el porcentaje restante
            const porcentajeRestante = porcentajeInicial - sumaPorcentajes * 100;

            // Verifica si la suma de porcentajes excede el 100%
            if (sumaPorcentajes > 1) {
                alert(
                    `La suma de los porcentajes no puede exceder el 100%. El porcentaje actual es del ${(sumaPorcentajes * 100).toFixed(
                        2,
                    )}%. Por favor, ajusta los valores.`,
                );
            }

            // Calcula y actualiza el campo dinámico utilizando una función específica
            calculoHito1Diferenciado(
                value, // Nuevo porcentaje ingresado
                montot, // Monto total calculado
                montoPrimaTotal, // Prima total calculada
                setFormValues, // Función para actualizar el formulario
                updatedValues, // Valores actuales del formulario
                campoActualizar, // Campo que debe actualizarse dinámicamente
                porcentajeRestante, // Porcentaje restante calculado
                updatedValues, // Estado actualizado
            );

            return updatedValues; // Retorna el estado actualizado para reflejar los cambios
        });
    };

    // Maneja actualizaciones específicas para los montos de hitos
    const actualizarHitoDiferenciadoMonto = (name, value, campoActualizar) => {
        setFormValues((prevValues) => {
            // Copia y actualiza el estado con el nuevo valor
            const updatedValues = { ...prevValues, [name]: value };

            // Obtiene el monto inicial actualizado
            const montoInicial = updatedValues.custbody163;

            const porcentajeInicial = 100;

            // Calcular los porcentajes considerando solo los valores seleccionados
            const porcentajes = [
                updatedValues.hito_chek_uno ? Math.round(parseFloat(updatedValues.custbody62 || 0) * 100) / 100 : 0,
                updatedValues.hito_chek_dos ? Math.round(parseFloat(updatedValues.custbody63 || 0) * 100) / 100 : 0,
                updatedValues.hito_chek_tres ? Math.round(parseFloat(updatedValues.custbody64 || 0) * 100) / 100 : 0,
                updatedValues.hito_chek_cuatro ? Math.round(parseFloat(updatedValues.custbody65 || 0) * 100) / 100 : 0,
                updatedValues.hito_chek_cinco ? Math.round(parseFloat(updatedValues.custbody66 || 0) * 100) / 100 : 0,
                updatedValues.hito_chek_seis ? Math.round(parseFloat(updatedValues.custbody67 || 0) * 100) / 100 : 0,
            ];

            // Sumar los porcentajes actualizados
            const sumaPorcentajes = porcentajes.reduce((sum, val) => sum + val, 0);

            // Calcular el porcentaje restante correctamente
            const porcentajeRestante = porcentajeInicial - sumaPorcentajes * 100;
            const porcentajeRestanteFormateado = porcentajeRestante.toFixed(2); // Ejemplo: "40.00"

            // Verificar si la suma de los porcentajes excede el 100%
            if (sumaPorcentajes > 1) {
                alert(
                    `La suma de los porcentajes no puede exceder el 100%. El porcentaje actual es ${(sumaPorcentajes * 100).toFixed(
                        2,
                    )}%. Por favor, ajusta los valores.`,
                );
                return prevValues; // Evita continuar si hay error
            }

            // Crear un nuevo estado actualizado antes de llamar a la función de cálculo
            const updatedFormValues = { ...updatedValues, total_porcentaje: porcentajeRestanteFormateado };

            // Llamar a la función de cálculo con los valores correctos
            calculoHito1DiferenciadoMonto(
                montoInicial, // Monto inicial actualizado
                campoActualizar, // Campo a actualizar
                updatedFormValues, // Formulario actualizado
                setFormValues, // Setter del estado
                name, // Nombre del campo modificado
                porcentajeRestanteFormateado,
            );

            // Retornar el nuevo estado para actualizar correctamente
            return updatedFormValues;
        });
    };

    // Ejecuta cálculos específicos según el tipo de operación
    const ejecutarCálculosEspecíficos = (updatedValues, montot, montoPrimaTotal) => {
        // Determina el tipo de operación a partir del valor en custbody75
        const tipoOperacion = parseInt(updatedValues.custbody75, 10);

        // Lógica para cada tipo de operación
        if (tipoOperacion === 2) {
            // Cálculo para avance de obra
            setFormValues((prevValues) => ({
                ...prevValues, // Conserva los valores existentes del formulario.
                custbody62: 0.15, // Actualiza el campo `hito 1` con el monto total calculado.
                custbody63: 0.25, // Actualiza el campo `hito 2` con el monto total calculado.
                custbody64: 0.25, // Actualiza el campo `hito 3` con el monto total calculado.
                custbody65: 0.15, // Actualiza el campo `hito 4` con el monto total calculado.
                custbody66: 0.15, // Actualiza el campo `hito 5` con el monto total calculado.
                custbody67: 0.05, // Actualiza el campo `hito 6` con el monto total calculado.
            }));
            calculoAvenceObra(updatedValues, setFormValues, montot, montoPrimaTotal);
        } else if (tipoOperacion === 1) {
            // Cálculos para operaciones contra entrega
            calculoContraEntregaSinprimaTotal(updatedValues, setFormValues); // Sin prima total
            calculoContraEntregaMontoCalculado(updatedValues, setFormValues); // Con monto calculado
        } else if (tipoOperacion === 7) {
            setFormValues((prevValues) => ({
                ...prevValues, // Conserva los valores existentes del formulario.
                custbody62: 0, // Actualiza el campo `hito 1` con el monto total calculado.
                custbody63: 0, // Actualiza el campo `hito 2` con el monto total calculado.
                custbody64: 0, // Actualiza el campo `hito 3` con el monto total calculado.
                custbody65: 0, // Actualiza el campo `hito 4` con el monto total calculado.
                custbody66: 0, // Actualiza el campo `hito 5` con el monto total calculado.
                custbody67: 0, // Actualiza el campo `hito 6` con el monto total calculado.
                valortotals: 0, // Actualiza el campo `valor por asignar` con el monto total calculado.
                total_porcentaje: "100%", // actualiza el campo `total porcentaje` con el valor 100%.
                custbodyix_salesorder_hito1: 0, // Actualiza el campo `hito 1` con el monto total calculado.
                custbody_ix_salesorder_hito2: 0, // Actualiza el campo `hito 2` con el monto total calculado.
                custbody_ix_salesorder_hito3: 0, // Actualiza el campo `hito 3` con el monto total calculado.
                custbody_ix_salesorder_hito4: 0, // Actualiza el campo `hito 4` con el monto total calculado.
                custbody_ix_salesorder_hito5: 0, // Actualiza el campo `hito 5` con el monto total calculado.
                custbody_ix_salesorder_hito6: 0, // Actualiza el campo `hito 6` con el monto total calculado.
            }));
            // Cálculo para avance diferenciado
            calculoAvanceDiferenciado(updatedValues, setFormValues, montot, montoPrimaTotal);
        }
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
    const validateForm = () => {
        const newErrors = {}; // Objeto para almacenar los errores detectados

        // Itera sobre las reglas de validación definidas
        Object.keys(validationRules).forEach((field) => {
            const rule = validationRules[field]; // Reglas de validación para el campo actual
            const fieldValue = formValues[field]; // Valor actual del campo en el formulario

            // Verifica si el campo es obligatorio y si su valor es válido
            if (
                rule.required && // La regla indica que el campo es obligatorio
                (!fieldValue || (typeof fieldValue === "string" && !fieldValue.trim())) // El valor está vacío o no contiene texto
            ) {
                // Agrega un mensaje de error para el campo actual
                newErrors[field] = rule.message || "Este campo es obligatorio";
            }
        });

        console.log(newErrors);

        // Actualiza los errores en el estado del formulario
        setErrors(newErrors);

        // Retorna `true` si no se detectaron errores, `false` en caso contrario
        return Object.keys(newErrors).length === 0;
    };

    // Maneja el envío del formulario
    const handleSubmit = (e) => {
        e.preventDefault(); // Previene que la página se recargue al enviar el formulario

        // Valida los datos del formulario antes de proceder
        if (validateForm()) {
            // Confirmar si desea crear la estimación
            const confirmCreate = window.confirm("¿Desea crear la estimación?");

            if (confirmCreate) {
                // Si el usuario acepta
                dispatch(crearEstimacionFormulario(formValues));
                // Aquí puedes agregar la lógica para crear la estimación
            } else {
                // Si el usuario cancela
                alert("Operación cancelada.");
            }
        } else {
            console.log(validateForm);
            // Si la validación falla
            alert("Algunos campos no pueden quedar vacíos. Por favor, verifíquelos.");
        }
    };

    useEffect(() => {
        // Salir temprano si el modal no está abierto para evitar ejecuciones innecesarias
        if (!open) return;

        /**
         * Función asíncrona que obtiene y procesa los datos de una estimación
         * desde NetSuite y actualiza el estado del formulario
         */
        const fetchEstimacion = async () => {
            try {
                // Activar indicador de carga
                setIsLoading(true);

                /**
                 * Formatea una fecha string al formato YYYY-MM-DD
                 * @param {string} dateStr - Fecha en formato DD/MM/YYYY o YYYY-MM-DD
                 * @returns {string} Fecha formateada o string vacío si es inválida
                 */
                const formatDate = (dateStr) => {
                    if (!dateStr) return "";
                    if (dateStr.includes("/")) {
                        const [day, month, year] = dateStr.split("/");
                        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
                    }
                    return dateStr;
                };

                /**
                 * Obtiene un valor específico de un objeto de datos anidado
                 * @param {Object} data - Objeto que contiene los datos
                 * @param {string} identifier - Identificador para buscar el valor
                 * @param {string} field - Campo específico a obtener
                 * @returns {string} Valor encontrado o string vacío
                 */
                const getColumnValue = (data, identifier, field) => {
                    if (!data || typeof data !== 'object') return "";
                    return Object.values(data).find(
                        item => item?.custcol_indentificadorprima === identifier
                    )?.[field] || "";
                };

                // Obtener datos de la estimación desde NetSuite
                const estimacionData = await dispatch(extarerEstimacion(idEstimacion));
                const transactionData = estimacionData?.netsuite?.Detalle || {};
                const itemData = transactionData?.data?.sublists?.item || {};

                /**
                 * Formatea números con 2 decimales en formato estadounidense
                 * @param {string|number} value - Valor a formatear
                 * @returns {string} Número formateado con 2 decimales
                 */
                const formatNumber = (value) => {
                    let cleanValue = value;
                    if (typeof value === 'string') {
                        cleanValue = value.replace(/[^0-9.-]/g, '');
                    }
                    
                    return new Intl.NumberFormat("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    }).format(Number(cleanValue) || 0);
                };

                // Extraer y formatear datos financieros
                const financialData = {
                    listPrice: formatNumber(transactionData?.data?.fields?.custbody13),
                    directDiscount: formatNumber(transactionData?.data?.fields?.custbody132),
                    extrasPaidByClient: formatNumber(transactionData?.data?.fields?.custbody46),
                    cashback: formatNumber(transactionData?.data?.fields?.custbodyix_salesorder_cashback),
                    courtesyAmount: formatNumber(transactionData?.data?.fields?.custbody16),
                    custbody52: formatNumber(transactionData?.data?.fields?.custbody52),
                    custbody18: formatNumber(transactionData?.data?.fields?.custbody18),
                    custbody_ix_total_amount: formatNumber(transactionData?.data?.fields?.custbody_ix_total_amount) || 0
                };

                // Calcular precio de venta neto
                const netSalePrice = (
                    Number(financialData.listPrice.replace(/,/g, '')) +
                    Number(financialData.directDiscount.replace(/,/g, '')) + 
                    Number(financialData.extrasPaidByClient.replace(/,/g, '')) -
                    Number(financialData.cashback.replace(/,/g, '')) -
                    Number(financialData.courtesyAmount.replace(/,/g, ''))
                ).toFixed(2);

                // Actualizar estado del formulario con los nuevos valores
                setFormValues(prevValues => ({
                    ...prevValues,
                    rType: "estimacion",
                    
                    // Información básica de la transacción
                    entity: transactionData?.cli || "-",
                    custbody38: transactionData?.Exp || "-",
                    proyecto_lead_est: transactionData?.Exp || "-", 
                    entitystatus: transactionData?.Estado || "-",
                    subsidiary: transactionData?.Subsidaria || "-",

                    // Campos financieros
                    pvneto: formatNumber(netSalePrice),
                    custbody13: financialData.listPrice,
                    custbody132: financialData.directDiscount,
                    custbodyix_salesorder_cashback: financialData.cashback,
                    custbody46: financialData.extrasPaidByClient,
                    custbody16: financialData.courtesyAmount,
                    custbody52: financialData.custbody52,
                    custbody18: financialData.custbody18,

                    // Campos descriptivos y fechas
                    custbody47: transactionData?.data?.fields?.custbody47 || "-",
                    custbody35: transactionData?.data?.fields?.custbody35 || "-",
                    custbody114: transactionData?.data?.fields?.custbody114 || 0,
                    tranid_oport: transactionData?.opportunity_name || "-",
                    custbody_ix_total_amount: formatNumber(financialData.custbody_ix_total_amount) || 0,
                    expectedclosedate: transactionData?.data?.fields?.expectedclosedate || "-"
                }));

                // Actualizar fecha de reserva
                setFormValues(prevValues => ({
                    ...prevValues,
                    fech_reserva: "111111"
                }));

            } catch (error) {
                console.error('Error fetching estimacion:', error);
                alert('Error al obtener la estimación. Por favor, inténtelo de nuevo.');
            } finally {
                setIsLoading(false);
            }
        };

        // Ejecutar la función de obtención de datos
        fetchEstimacion();
    }, [open, idEstimacion, dispatch]); // Dependencias del efecto

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
