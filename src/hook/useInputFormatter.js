export const limpiarCampos = (newValue) => {
    // Elimina todos los caracteres no deseados dejando solo números, puntos, comas y guiones
    const cleanedValue = newValue.replace(/[^0-9.,-]/g, "");
    return cleanedValue; // Devuelve el valor limpio
};

const cleanAndParseFloat = (value) => {
    // Si el valor es nulo o vacío, retorna 0
    if (!value) return 0;
    // Elimina las comas como separadores de miles para convertir correctamente
    const cleanedValue = value.replace(/,/g, "");
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

    // Realiza el cálculo del precio de venta neto
    const monto_total_precio_venta_neto = precio_de_lista + descuento_directo + extrasPagadasPorelcliente - cashback - monto_de_cortecias;

    // Formatea el resultado con dos decimales
    const Formater = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(monto_total_precio_venta_neto);

    return Formater; // Devuelve el precio neto formateado
};

export const montoTotal = (formValues) => {
    // CALCULA EL MONTO TOTAL

    // Obtiene y convierte el precio de lista
    var precio_de_lista_mo = cleanAndParseFloat(formValues.custbody13);
    // Obtiene y convierte la diferencia sobre el precio de lista
    var extra_sobre_precio_lista_mo = cleanAndParseFloat(formValues.diferecia);

    // Calcula el monto total sumando el precio de lista y la diferencia
    var calcula_monto_total = precio_de_lista_mo + extra_sobre_precio_lista_mo;

    // Formatea el resultado con dos decimales
    const Formater = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(calcula_monto_total);

    return Formater; // Devuelve el monto total formateado
};
