import { obtenerOrdenVenta, updateAplicarComicion } from "./Api_provider_estimacion";


/**
 * Función para obtener la orden de venta.
 * 
 * @param {string} idTransaccion - El ID de la transacción para la cual se obtiene la orden de venta.
 * @returns {Function} Una función asíncrona que realiza la solicitud a la API.
 */
export const obtenerOrdendeventa = (idTransaccion) => {

    return async () => {
        try {
            // Llama a la API para crear la ordenDeventa utilizando el id de la transaccion.
            const result = await obtenerOrdenVenta({ idTransaccion });

            // Retorna el primer elemento de los datos obtenidos, asumiendo que contiene la información principal requerida.
            return result;
        } catch (error) {
            // Captura y registra cualquier error que ocurra durante la solicitud para facilitar la depuración.
            console.error("Error al crear la ordenDeventa:", error);
        }
    };
};


export const AplicarComicion = (valor, idTransaccion) => {
    return async () => {
        try {
            // Llama a la API para crear la ordenDeventa utilizando el id de la transaccion.
            const result = await updateAplicarComicion({ valor, idTransaccion });

            // Retorna el primer elemento de los datos obtenidos, asumiendo que contiene la información principal requerida.
            return result;
        } catch (error) {
            // Captura y registra cualquier error que ocurra durante la solicitud para facilitar la depuración.
            console.error("Error al aplicar comicion", error);
        }
    };
};
