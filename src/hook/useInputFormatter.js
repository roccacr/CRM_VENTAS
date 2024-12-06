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
    //  porcentaje = Math.round(porcentaje * 10000) / 10000;

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
    const cashback_neta = cleanAndParseFloat(formValues.custbodyix_salesorder_cashback)
    const reserva_neta = cleanAndParseFloat(formValues.custbody52)

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

    const total_neta = (
        prima_total_neta -
        cashback_neta -
        reserva_neta -
        monto_prima_unico * monto_tracto_unico -
        monto_prima_fraccionado * monto_tracto_fraccionado -
        monto_prima_extra * monto_tracto_extra -
        monto_prima_extra_uno * monto_tracto_extra_uno -
        monto_prima_extra_dos * monto_tracto_extra_dos -
        monto_prima_extra_tres * monto_tracto_extra_tres
    );

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
    var monto_sin_prima_total = (monto_total_sin_prima - monto_prima_total_sin_prima);

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


export const calculoContraEntregaSinprimaTotal = (formValues) => {
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

export const calculoContraEntregaMontoCalculado = (formValues) => {
    // Parsear y limpiar el monto total (custbody_ix_total_amount) desde el formulario.
    const MontoCalculado = cleanAndParseFloat(formValues.custbody163);

    // Calcular el monto sin prima total restando la prima del monto total.
    var total = MontoCalculado*1;

    // Formatear el resultado con un número configurable:
    // - Siempre muestra al menos 2 decimales.
    // - Permite hasta 5 decimales para mantener precisión.
    const formateado = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 5,
    }).format(total);

    // Devuelve el monto total formateado como una cadena.
    return formateado;
};
