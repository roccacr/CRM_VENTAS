import { editarOrdenVenta, insertarOrdenVenta, insertarOrdenVentaBd, obtenerOrdenVenta, updateAplicarComicion } from "./Api_provider_estimacion";


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


/**
 * Crea una orden de venta basada en una estimación y un leadId.
 * @param {number} idEstimacion - Identificador de la estimación.
 * @param {number} leadId - Identificador del lead.
 * @returns {Function} - Función asincrónica que maneja la creación de la orden de venta.
 */
export const crearOrdenVenta = (idEstimacion, leadId) => {
    return async (dispatch, getState) => {
        try {
            console.clear();
            let resultado = { msg: '', statusNormal: 400, data: null };
            
            // Llamada a la API para insertar la orden de venta.
            const result = await insertarOrdenVenta({ idEstimacion, leadId });
            const detalle = result.data?.Detalle;
            const datosOrden = detalle ? JSON.parse(detalle.msg) : null;

            if (detalle?.status === 200 && datosOrden) {
                // Extraer valores de la respuesta de la API con manejo seguro de datos.
                const idOrden = detalle.id;
                const tranid = datosOrden.tranid || 0;
                const opportunityInternalId = datosOrden.opportunity?.internalid || 0;
                const employeeInternalId = datosOrden.salesteam?.[0]?.employee?.internalid || 0;
                const entityInternalId = datosOrden.entity?.internalid || 0;
                const custbody38Value = datosOrden.custbody38?.internalid || 0;
                const custbody17Value = datosOrden.custbody17?.internalid || 0;
                const subsidiaryInternalId = datosOrden.subsidiary?.internalid || 0;

                // Dispatch para insertar la orden de venta en el estado de la aplicación.
                resultado = await dispatch(
                    InsertarOrdenVentaBds(
                        tranid, idOrden, idEstimacion, opportunityInternalId, 
                        employeeInternalId, entityInternalId, custbody38Value, 
                        subsidiaryInternalId, leadId, custbody17Value
                    )
                );
                return {
                    msg: 'Orden de venta creada correctamente',
                    statusNormal: 200,
                    data: detalle,
                    resultado
                };
            } else {
                Swal.fire(
                    'Error en la creación',
                    'No se pudo crear la orden de venta. Contacta al administrador de sistemas.',
                    'error'
                );
            }
            return resultado;
        } catch (error) {
            console.error('Error al crear la orden de venta:', error);
            return { msg: 'Error interno', status: 500, data: null };
        }
    };
};


export const InsertarOrdenVentaBds = (tranid, id_orden, idEstimacion, opportunityInternalId, employeeInternalId, entityInternalId, custbody38Value, subsidiaryInternalId, leadId, custbody17Value) => {
    return async () => {
        try {
            console.clear();
            // Llama a la API para crear la ordenDeventa utilizando el id de la transaccion.
            const result = await insertarOrdenVentaBd({ tranid, id_orden, idEstimacion, opportunityInternalId, employeeInternalId, entityInternalId, custbody38Value, subsidiaryInternalId, leadId, custbody17Value });
            
            // Retorna el primer elemento de los datos obtenidos, asumiendo que contiene la información principal requerida.
            return result;
        } catch (error) {
            // Captura y registra cualquier error que ocurra durante la solicitud para facilitar la depuración.
            console.error("Error al crear la orden de venta", error);
        }
    };
};




/**
 * Función para manejar la edición de una orden de venta a partir de los datos proporcionados en un formulario.
 * @param {object} formulario - Los datos del formulario utilizados para la edición de la orden de venta.
 * @returns {Function} - Una función asincrónica que realiza la solicitud y maneja los resultados.
*/
export const editarOrdenVentaFormulario = (formulario) => {

    return async () => {
        try {
            // Llama a la API para editar la estimación utilizando los datos del formulario.
            const result = await editarOrdenVenta({ formulario });
 
            // Retorna el primer elemento de los datos obtenidos, asumiendo que contiene la información principal requerida.
            return result;
        } catch (error) {
            // Captura y registra cualquier error que ocurra durante la solicitud para facilitar la depuración.
            console.error("Error al editar la orden de venta:", error);
        }
    };
 };
 