export const limpiarCampos = (newValue) => {
    // Elimina todos los caracteres no deseados dejando solo números, puntos, comas y guiones
    const cleanedValue = newValue.replace(/[^0-9.,-]/g, ""); // Expresión regular para filtrar caracteres
    return cleanedValue; // Devuelve el valor limpio
};

const cleanAndParseFloat = (value) => {
    // Si el valor es nulo o indefinido, retorna 0
    if (value == null || value === "") return 0;
    // Asegúrate de que el valor sea una cadena antes de aplicar .replace
    const cleanedValue = typeof value === "string" ? value.replace(/,/g, "") : value.toString();
    // Convierte el valor limpio a un número flotante, retorna 0 si no es válido
    return parseFloat(cleanedValue) || 0;
};

export const precioVentaNeto = (formValues) => {
    // CALCULA EL PRECIO DE VENTA NETO

    // Obtiene y convierte el precio de lista
    const precio_de_lista = cleanAndParseFloat(formValues.custbody13);
    // Obtiene y convierte el descuento directo
    const descuento_directo = cleanAndParseFloat(formValues.custbody132);
    // Obtiene y convierte los extras pagados por el cliente
    const extrasPagadasPorelcliente = cleanAndParseFloat(formValues.custbody46);
    // Obtiene y convierte el cashback aplicado
    const cashback = cleanAndParseFloat(formValues.custbodyix_salesorder_cashback);
    // Obtiene y convierte el monto de cortesías
    const monto_de_cortecias = cleanAndParseFloat(formValues.custbody16);

    // Realiza el cálculo del precio de venta neto sumando y restando valores
    const monto_total_precio_venta_neto = precio_de_lista + descuento_directo + extrasPagadasPorelcliente - cashback - monto_de_cortecias;

    // Formatea el resultado con dos decimales
    const Formater = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2, // Asegura que siempre haya al menos dos decimales
        maximumFractionDigits: 2, // Limita el máximo a dos decimales
    }).format(monto_total_precio_venta_neto);

    return Formater; // Devuelve el precio neto formateado
};

export const montoTotal = (formValues) => {
    // CALCULA EL MONTO TOTAL

    // Obtiene y convierte el precio de lista
    const precio_de_lista_mo = cleanAndParseFloat(formValues.custbody13);

    // Obtiene y convierte el descuento directo
    const descuento_directo = cleanAndParseFloat(formValues.custbody132);
    // Obtiene y convierte los extras pagados por el cliente
    const extrasPagadasPorelcliente = cleanAndParseFloat(formValues.custbody46);

    // Calcula el monto total sumando precio de lista, descuento directo y extras
    const calcula_monto_total = precio_de_lista_mo + descuento_directo + extrasPagadasPorelcliente;

    // Formatea el resultado con dos decimales
    const Formater = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2, // Asegura al menos dos decimales
        maximumFractionDigits: 2, // Limita el máximo a dos decimales
    }).format(calcula_monto_total);

    return Formater; // Devuelve el monto total formateado
};

/**
 * Calcula el monto total a partir de un valor base y un porcentaje proporcionado.
 * @param {Object} formValues - Valores de formulario que contienen el monto base y el porcentaje.
 * @returns {string} - El monto total calculado y formateado con hasta cinco decimales.
 */
export const calcularPrimaToal = (monto, porcentaje) => {
    // Obtiene y convierte el monto total desde el formulario
    const montoTotal = cleanAndParseFloat(monto);
    // Obtiene y convierte el porcentaje desde el formulario
    let montoPorcentaje = cleanAndParseFloat(porcentaje);

    // Si el porcentaje es mayor que 1, se convierte a formato decimal (ejemplo: 15 -> 0.15)
    if (montoPorcentaje > 1) {
        montoPorcentaje /= 100; // Ajusta el porcentaje a formato decimal
    }

    // Calcula el monto total multiplicando el monto base por el porcentaje
    const calculaMontoTotal = montoTotal * montoPorcentaje;

    // Formatea el resultado con hasta cinco decimales (precisión ajustada)
    const formateado = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2, // Siempre muestra al menos 2 decimales
        maximumFractionDigits: 5, // Hasta 5 decimales para manejar precisión
    }).format(calculaMontoTotal);

    // Devuelve el monto total formateado como una cadena
    return formateado;
};

export const montoPrimaNeta = (montoPrimaTotal, formValues) => {
    // Obtiene y convierte el monto total desde el formulario
    const mnPrimaTotal = cleanAndParseFloat(montoPrimaTotal);
    // Obtiene y convierte el monto de reserva
    let montoReserva = cleanAndParseFloat(formValues.custbody52);

    // Obtiene y convierte el cashback
    let cashback = cleanAndParseFloat(formValues.custbodyix_salesorder_cashback);

    // Calcula el monto prima neta restando reserva y cashback del monto prima total
    const total = mnPrimaTotal - montoReserva - cashback;

    // Formatea el resultado con hasta cinco decimales (precisión ajustada)
    const formateado = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2, // Siempre muestra al menos 2 decimales
        maximumFractionDigits: 5, // Hasta 5 decimales para manejar precisión
    }).format(total);

    // Devuelve el monto total formateado como una cadena
    return formateado;
};

export const calculoPrimaTotalPorcentaje = (formValues) => {
    // Convierte y limpia los valores de entrada
    let montoPrimaTotal = cleanAndParseFloat(formValues.custbody39);
    let montoTotal = cleanAndParseFloat(formValues.custbody_ix_total_amount);

    // Validar que montoTotal no sea cero o nulo para evitar divisiones inválidas
    if (!montoTotal || montoTotal === 0) {
        throw new Error("El monto total no puede ser cero o inválido."); // Lanza un error si el monto total no es válido
    }

    // Calcula el porcentaje como decimal dividiendo monto prima total entre monto total
    let porcentaje = montoPrimaTotal / montoTotal;

    // Redondea a 5 decimales para mayor precisión
    porcentaje = Math.round(porcentaje * 1e9) / 1e9;

    // Devuelve el porcentaje redondeado
    return porcentaje;
};

export const calculoMontoSegunPorcentaje = (formValues) => {
    // Convierte y limpia los valores de entrada
    let porcentaje = cleanAndParseFloat(formValues.custbody60);
    let montoTotal = cleanAndParseFloat(formValues.custbody_ix_total_amount);

    // Calcula el porcentaje como decimal dividiendo monto prima total entre monto total
    let monto = montoTotal * porcentaje;

    const formateado = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2, // Siempre muestra al menos 2 decimales
        maximumFractionDigits: 5, // Hasta 5 decimales para manejar precisión
    }).format(monto);

    // Devuelve el monto total formateado como una cadena
    return formateado;
};

export const calculoPrimaAsignable = (total, formValues) => {
    /* PRIMA NETA */
    const prima_total_neta = cleanAndParseFloat(total);
    const cashback_neta = cleanAndParseFloat(formValues.custbodyix_salesorder_cashback);
    const reserva_neta = cleanAndParseFloat(formValues.custbody52);

    //MONTOS PRIMAS UNICA
    const monto_prima_unico = formValues.custbody177 === false ? 0 : cleanAndParseFloat(formValues.custbody181);
    const monto_tracto_unico = formValues.custbody177 === false ? 0 : cleanAndParseFloat(formValues.custbody182);

    //MONTOS PRIMAS
    const monto_prima_fraccionado = formValues.custbody176 === false ? 0 : cleanAndParseFloat(formValues.custbody179);
    const monto_tracto_fraccionado = formValues.custbody176 === false ? 0 : cleanAndParseFloat(formValues.custbody180);

    //MONTOS PRIMAS
    const monto_prima_extra = formValues.custbody178 === false ? 0 : cleanAndParseFloat(formValues.custbody183);
    const monto_tracto_extra = formValues.custbody178 === false ? 0 : cleanAndParseFloat(formValues.custbody184);

    //MONTOS PRIMAS +1
    const monto_prima_extra_uno = formValues.prima_extra_uno === false ? 0 : cleanAndParseFloat(formValues.monto_extra_uno);
    const monto_tracto_extra_uno = formValues.prima_extra_uno === false ? 0 : cleanAndParseFloat(formValues.monto_tracto_uno);

    //MONTOS PRIMAS +2
    const monto_prima_extra_dos = formValues.prima_extra_dos === false ? 0 : cleanAndParseFloat(formValues.monto_extra_dos);
    const monto_tracto_extra_dos = formValues.prima_extra_dos === false ? 0 : cleanAndParseFloat(formValues.monto_tracto_dos);

    //MONTOS PRIMAS +3
    const monto_prima_extra_tres = formValues.prima_extra_tres === false ? 0 : cleanAndParseFloat(formValues.monto_extra_tres);
    const monto_tracto_extra_tres = formValues.prima_extra_tres === false ? 0 : cleanAndParseFloat(formValues.monto_tracto_tres);

    const total_neta =
        prima_total_neta -
        cashback_neta -
        reserva_neta -
        monto_prima_unico * monto_tracto_unico -
        monto_prima_fraccionado * monto_tracto_fraccionado -
        monto_prima_extra * monto_tracto_extra -
        monto_prima_extra_uno * monto_tracto_extra_uno -
        monto_prima_extra_dos * monto_tracto_extra_dos -
        monto_prima_extra_tres * monto_tracto_extra_tres;

    const formateado = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2, // Siempre muestra al menos 2 decimales
        maximumFractionDigits: 5, // Hasta 5 decimales para manejar precisión
    }).format(total_neta);

    // Devuelve el monto total formateado como una cadena
    return formateado;
};

/**
 * Calcula el monto total sin prima y lo formatea.
 *
 * @param {Object} formValues - Objeto que contiene los valores del formulario.
 * @returns {string} - Monto total sin prima formateado como una cadena.
 */
export const calculoContraEntrega = (formValues) => {
    // Parsear y limpiar el monto total (custbody_ix_total_amount) desde el formulario.
    const monto_total_sin_prima = cleanAndParseFloat(formValues.custbody_ix_total_amount);

    // Parsear y limpiar el monto de prima total (custbody39) desde el formulario.
    const monto_prima_total_sin_prima = cleanAndParseFloat(formValues.custbody39);

    // Calcular el monto sin prima total restando la prima del monto total.
    var monto_sin_prima_total = monto_total_sin_prima - monto_prima_total_sin_prima;

    // Formatear el resultado con un número configurable:
    // - Siempre muestra al menos 2 decimales.
    // - Permite hasta 5 decimales para mantener precisión.
    const formateado = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 5,
    }).format(monto_sin_prima_total);

    // Devuelve el monto total formateado como una cadena.
    return formateado;
};

// Calcula y actualiza el monto total sin prima restando la prima al monto total.
export const calculoContraEntregaSinprimaTotal = (
    valoresFormulario, // Valores actuales del formulario.
    setValoresFormulario, // Función para actualizar los valores del formulario.
) => {
    // Convierte el monto total (custbody_ix_total_amount) a un número flotante válido.
    const montoTotal = cleanAndParseFloat(valoresFormulario.custbody_ix_total_amount);

    // Convierte el monto de prima total (custbody39) a un número flotante válido.
    const montoPrimaTotal = cleanAndParseFloat(valoresFormulario.custbody39);

    // Calcula el monto total sin incluir la prima.
    const montoSinPrimaTotal = montoTotal - montoPrimaTotal;

    // Formatea el resultado con al menos 2 decimales y hasta 5 decimales para precisión.
    const montoFormateado = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 5,
    }).format(montoSinPrimaTotal);

    // Actualiza los valores del formulario con el porcentaje y el monto sin prima.
    setValoresFormulario((valoresPrevios) => ({
        ...valoresPrevios,
        custbody67: "100%", // Indica que el porcentaje es del 100%.
        custbody163: montoFormateado, // Monto total sin prima formateado.
    }));
};


// Calcula y actualiza el monto de contra entrega basado en el total calculado.
export const calculoContraEntregaMontoCalculado = (
    valoresFormulario, // Valores actuales del formulario.
    setValoresFormulario // Función para actualizar los valores del formulario.
) => {
    // Convierte el monto total calculado (custbody163) a un número flotante válido.
    const montoTotalCalculado = cleanAndParseFloat(valoresFormulario.custbody163);

    // Calcula el monto de contra entrega (aquí simplemente se multiplica por 1).
    const montoContraEntrega = montoTotalCalculado * 1;

    // Formatea el monto con al menos 2 decimales y hasta 5 decimales para precisión.
    const montoFormateado = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 5,
    }).format(montoContraEntrega);

    // Actualiza los valores del formulario con el porcentaje y el monto calculado.
    setValoresFormulario((valoresPrevios) => ({
        ...valoresPrevios,
        custbody67: "100%", // Indica que el porcentaje es del 100%.
        custbody_ix_salesorder_hito6: montoFormateado, // Monto formateado del hito 6.
    }));
};


// Calcula y actualiza el avance de obra dividiendo el monto sin prima en hitos específicos.
export const calculoAvenceObra = (
    valoresFormulario, // Valores actuales del formulario.
    setValoresFormulario, // Función para actualizar los valores del formulario.
    montoTotal, // Monto total sin incluir la prima.
    montoPrimaTotal, // Monto de la prima total.
) => {
    // Convierte el monto total a un número flotante válido.
    const montoTotalCalculado = cleanAndParseFloat(montoTotal);

    // Convierte el monto de la prima total a un número flotante válido.
    const montoPrimaCalculado = cleanAndParseFloat(montoPrimaTotal);

    // Calcula el monto total excluyendo el monto de la prima.
    const montoSinPrimaTotal = montoTotalCalculado - montoPrimaCalculado;

    // Función auxiliar para formatear números con al menos 2 decimales y hasta 5 decimales.
    const formatearNumero = (valor) =>
        new Intl.NumberFormat("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 5,
        }).format(valor);

    // Calcula los valores de cada hito con base en los porcentajes establecidos.
    const hito1 = formatearNumero(montoSinPrimaTotal * 0.15); // 15%
    const hito2 = formatearNumero(montoSinPrimaTotal * 0.25); // 25%
    const hito3 = formatearNumero(montoSinPrimaTotal * 0.25); // 25%
    const hito4 = formatearNumero(montoSinPrimaTotal * 0.15); // 15%
    const hito5 = formatearNumero(montoSinPrimaTotal * 0.15); // 15%
    const hito6 = formatearNumero(montoSinPrimaTotal * 0.05); // 5%

    // Formatea el monto total sin prima para almacenamiento.
    const montoSinPrimaFormateado = formatearNumero(montoSinPrimaTotal);

    // Actualiza los valores del formulario con los resultados de los cálculos.
    setValoresFormulario((valoresPrevios) => ({
        ...valoresPrevios,
        custbody163: montoSinPrimaFormateado, // Total sin prima formateado.
        custbodyix_salesorder_hito1: hito1, // Valor del primer hito (15%).
        custbody_ix_salesorder_hito2: hito2, // Valor del segundo hito (25%).
        custbody_ix_salesorder_hito3: hito3, // Valor del tercer hito (25%).
        custbody_ix_salesorder_hito4: hito4, // Valor del cuarto hito (15%).
        custbody_ix_salesorder_hito5: hito5, // Valor del quinto hito (15%).
        custbody_ix_salesorder_hito6: hito6, // Valor del sexto hito (5%).
    }));

    // Retorna un mensaje indicando que la actualización se realizó con éxito.
    return "Actualización realizada";
};


// Calcula y actualiza el monto de avance diferenciado, excluyendo el monto de prima.
export const calculoAvanceDiferenciado = (
    valoresFormulario, // Valores actuales del formulario.
    setValoresFormulario, // Función para actualizar los valores del formulario.
    montoTotal, // Monto total sin incluir la prima.
    montoPrimaTotal // Monto de la prima total.
) => {
    // Limpia y convierte el monto total a un número flotante válido.
    const montoTotalCalculado = cleanAndParseFloat(montoTotal);

    // Limpia y convierte el monto de la prima total a un número flotante válido.
    const montoPrimaCalculado = cleanAndParseFloat(montoPrimaTotal);

    // Calcula el monto total sin incluir la prima.
    const montoSinPrimaTotal = montoTotalCalculado - montoPrimaCalculado;

    // Función para formatear un número con 2 a 5 decimales para mayor precisión.
    const formatearNumero = (valor) =>
        new Intl.NumberFormat("en-US", {
            minimumFractionDigits: 2, // Asegura al menos 2 decimales.
            maximumFractionDigits: 5, // Limita a un máximo de 5 decimales.
        }).format(valor);

    // Formatea el monto total sin prima utilizando la función de formateo.
    const montoSinPrimaFormateado = formatearNumero(montoSinPrimaTotal);

    // Actualiza los valores del formulario con el monto sin prima formateado.
    setValoresFormulario((valoresPrevios) => ({
        ...valoresPrevios, // Conserva los valores existentes del formulario.
        custbody163: montoSinPrimaFormateado, // Actualiza el campo `custbody163` con el monto formateado.
    }));

    // Retorna un mensaje indicando que la actualización se realizó con éxito.
    return "Actualización realizada";
};


// Función para calcular el monto de un hito diferenciado basado en un porcentaje ingresado
export const calculoHito1Diferenciado = (
    porcentajeIngresado, // Nuevo valor ingresado por el usuario
    montoTotal, // Monto total sin incluir la prima
    montoPrimaTotal, // Monto de la prima total
    setFormValues, // Función para actualizar los valores del formulario
    valoresPrevios, // Los valores actuales del formulario
    campoActualizar, // Nombre del campo a actualizar
    porcentajeRestante, // Porcentaje restante calculado
    updatedValues, // Valores actualizados del formulario
) => {
    // Limpia y convierte el porcentaje ingresado a un número flotante válido
    const porcentajeCalculado = cleanAndParseFloat(porcentajeIngresado);

    // Limpia y convierte el monto total a un número flotante válido
    const montoTotalCalculado = cleanAndParseFloat(montoTotal);

    // Calcula el monto del hito multiplicando el monto total por el porcentaje calculado
    const montoHitoCalculado = montoTotalCalculado * porcentajeCalculado;

    // Formatea el monto del hito con 2 a 5 decimales para mayor precisión
    const montoHitoFormateado = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 5,
    }).format(montoHitoCalculado);

    // Limpia y convierte el monto total asignado a un valor flotante válido
    const montoTotalAsignado = cleanAndParseFloat(updatedValues.custbody163);

    // Construye un arreglo con los valores de los hitos activados
    const valores = [
        updatedValues.hito_chek_uno ? cleanAndParseFloat(updatedValues.custbodyix_salesorder_hito1) : 0,
        updatedValues.hito_chek_dos ? cleanAndParseFloat(updatedValues.custbody_ix_salesorder_hito2) : 0,
        updatedValues.hito_chek_tres ? cleanAndParseFloat(updatedValues.custbody_ix_salesorder_hito3) : 0,
        updatedValues.hito_chek_cuatro ? cleanAndParseFloat(updatedValues.custbody_ix_salesorder_hito4) : 0,
        updatedValues.hito_chek_cinco ? cleanAndParseFloat(updatedValues.custbody_ix_salesorder_hito5) : 0,
        updatedValues.hito_chek_seis ? cleanAndParseFloat(updatedValues.custbody_ix_salesorder_hito6) : 0,
    ];

    // Suma los valores de los hitos seleccionados
    const sumaHitos = valores.reduce((acumulador, valor) => acumulador + valor, 0);

    // Calcula la diferencia entre el monto total asignado y la suma de los hitos activados
    const diferencia = montoTotalAsignado - sumaHitos;

    // Actualiza dinámicamente los valores del formulario con los nuevos cálculos
    setFormValues({
        ...valoresPrevios, // Mantiene los valores previos del formulario
        [campoActualizar]: montoHitoFormateado, // Actualiza el campo específico con el monto calculado
        total_porcentaje: `${porcentajeRestante.toFixed(2)}%`, // Actualiza el porcentaje restante formateado
        valortotals: diferencia, // Actualiza la diferencia calculada
    });
};



// Función para calcular el monto diferenciado para un hito específico y actualizar valores en el formulario
export const calculoHito1DiferenciadoMonto = (MontoSinPrimaTotal, campoActualizar, updatedValues, setFormValues, name) => {
    // Limpia y convierte el monto sin prima total a un valor numérico
    const montoTotalAsignado = cleanAndParseFloat(MontoSinPrimaTotal);

    // Crea un arreglo con los valores de los hitos activados; si no están activados, se asigna 0
    const valores = [
        updatedValues.hito_chek_uno ? cleanAndParseFloat(updatedValues.custbodyix_salesorder_hito1) : 0,
        updatedValues.hito_chek_dos ? cleanAndParseFloat(updatedValues.custbody_ix_salesorder_hito2) : 0,
        updatedValues.hito_chek_tres ? cleanAndParseFloat(updatedValues.custbody_ix_salesorder_hito3) : 0,
        updatedValues.hito_chek_cuatro ? cleanAndParseFloat(updatedValues.custbody_ix_salesorder_hito4) : 0,
        updatedValues.hito_chek_cinco ? cleanAndParseFloat(updatedValues.custbody_ix_salesorder_hito5) : 0,
        updatedValues.hito_chek_seis ? cleanAndParseFloat(updatedValues.custbody_ix_salesorder_hito6) : 0,
    ];

    // Suma los valores de los hitos seleccionados
    const sumaHitos = valores.reduce((acumulador, valor) => acumulador + valor, 0);

    // Calcula la diferencia entre el monto total asignado y la suma de los hitos activados
    const diferencia = montoTotalAsignado - sumaHitos;

    // Verifica si la diferencia es negativa e informa al usuario si la suma de hitos excede el monto total
    if (diferencia < 0) {
        alert(
            `La suma de los montos de los hitos activados (${sumaHitos}) supera el MONTO SIN PRIMA TOTAL (${montoTotalAsignado}). Por favor, revisa los valores.`,
        );
    }

    // Limpia y convierte el valor total y el monto asociado al nombre proporcionado
    let montoTotal = cleanAndParseFloat(updatedValues.custbody_ix_total_amount);
    let montoPrimaTotal = cleanAndParseFloat(updatedValues[name]);

    // Valida que el monto total sea válido y diferente de cero para evitar errores en la división
    if (!montoTotal || montoTotal === 0) {
        throw new Error("El monto total no puede ser cero o inválido."); // Lanza un error si el monto total es inválido
    }

    // Calcula el porcentaje como un valor decimal (montoPrimaTotal / montoTotal)
    let porcentaje = montoPrimaTotal / montoTotal;

    // Redondea el porcentaje a 9 decimales para precisión
    porcentaje = Math.round(porcentaje * 1e9) / 1e9;

    // Actualiza los valores del formulario con la diferencia calculada y el porcentaje para el campo especificado
    setFormValues({
        ...updatedValues, // Mantiene los valores actuales del formulario
        valortotals: diferencia, // Actualiza la diferencia calculada
        [campoActualizar]: porcentaje, // Asigna el porcentaje calculado al campo específico
    });
};



// Función para recalcular montos y actualizar los valores del formulario
export const recalcultarMontoshitos = (updatedValues, setFormValues) => {
    // Obtiene el monto total asignado después de limpiar y convertir el valor
    const montoTotalAsignado = cleanAndParseFloat(updatedValues.custbody163);

    // Construye una lista de valores basada en los hitos seleccionados (marcados como true)
    const valores = [
        updatedValues.hito_chek_uno ? cleanAndParseFloat(updatedValues.custbodyix_salesorder_hito1) : 0,
        updatedValues.hito_chek_dos ? cleanAndParseFloat(updatedValues.custbody_ix_salesorder_hito2) : 0,
        updatedValues.hito_chek_tres ? cleanAndParseFloat(updatedValues.custbody_ix_salesorder_hito3) : 0,
        updatedValues.hito_chek_cuatro ? cleanAndParseFloat(updatedValues.custbody_ix_salesorder_hito4) : 0,
        updatedValues.hito_chek_cinco ? cleanAndParseFloat(updatedValues.custbody_ix_salesorder_hito5) : 0,
        updatedValues.hito_chek_seis ? cleanAndParseFloat(updatedValues.custbody_ix_salesorder_hito6) : 0,
    ];

    // Calcula la suma de los valores de los hitos seleccionados
    const sumaHitos = valores.reduce((acumulador, valor) => acumulador + valor, 0);

    // Calcula la diferencia entre el monto total asignado y la suma de los hitos seleccionados
    const diferencia = montoTotalAsignado - sumaHitos;

    // Construye una lista de porcentajes basados en los hitos seleccionados
    const porcentajes = [
        updatedValues.hito_chek_uno === true ? updatedValues.custbody62 : 0,
        updatedValues.hito_chek_dos === true ? updatedValues.custbody63 : 0,
        updatedValues.hito_chek_tres === true ? updatedValues.custbody64 : 0,
        updatedValues.hito_chek_cuatro === true ? updatedValues.custbody65 : 0,
        updatedValues.hito_chek_cinco === true ? updatedValues.custbody66 : 0,
        updatedValues.hito_chek_seis === true ? updatedValues.custbody67 : 0,
    ];

    // Calcula la suma de los porcentajes válidos (conversión a número y manejo de valores no válidos)
    const sumaPorcentajes = porcentajes
        .map((p) => parseFloat(p) || 0) // Convierte a número o usa 0 si no es válido
        .reduce((sum, value) => sum + value, 0); // Suma los valores

    // Calcula el porcentaje restante basado en los porcentajes válidos
    const porcentajeRestante = 100 - sumaPorcentajes * 100;

    // Actualiza los valores del formulario con los nuevos cálculos
    setFormValues({
        ...updatedValues, // Mantiene los valores existentes actualizados
        valortotals: diferencia, // Asigna la diferencia calculada
        total_porcentaje: `${porcentajeRestante.toFixed(2)}%`, // Formatea el porcentaje restante con dos decimales
    });
};
