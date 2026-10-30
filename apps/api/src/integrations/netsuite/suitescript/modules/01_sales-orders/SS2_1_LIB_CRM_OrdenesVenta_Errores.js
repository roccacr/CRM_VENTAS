/**
 * Errores de lectura propios de ordenes de venta (los consume providerError).
 *
 * @NApiVersion 2.1
 */
define([], () => {
    "use strict";

    return Object.freeze({
        notFound: { code: "SALES_ORDER_NOT_FOUND", message: "La orden de venta no existe." },
        readFailed: { code: "SALES_ORDER_READ_ERROR", message: "No se pudo consultar la orden de venta." },
    });
});
