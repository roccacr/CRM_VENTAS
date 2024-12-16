import { crearEstimacion, extraerEstimacionNetsuite, obtenerEstimacionesOportunidad } from "./Api_provider_estimacion";

/**
 * Función para manejar la creación de una estimación a partir de los datos proporcionados en un formulario.
 * @param {object} formulario - Los datos del formulario utilizados para la creación de la estimación.
 * @returns {Function} - Una función asincrónica que realiza la solicitud y maneja los resultados.
 */
export const crearEstimacionFormulario = (formulario) => {

    return async () => {
        try {
            // Llama a la API para crear la estimación utilizando los datos del formulario.
            const result = await crearEstimacion({ formulario });

            // Retorna el primer elemento de los datos obtenidos, asumiendo que contiene la información principal requerida.
            return result.data["0"];
        } catch (error) {
            // Captura y registra cualquier error que ocurra durante la solicitud para facilitar la depuración.
            console.error("Error al crear la estimación:", error);
        }
    };
};


// Función para obtener la lista de estimaciones relacionadas con una oportunidad específica, identificada por su ID de transacción.
export const obtenerEstimacionesPorOportunidad = (idOportunidad) => {
    return async () => {
        try {
            // Realiza la llamada a la API para obtener las estimaciones relacionadas con la oportunidad especificada.
            const respuesta = await obtenerEstimacionesOportunidad({ idOportunidad });


            // Retorna el primer elemento de los datos obtenidos, que contiene la información principal de la estimación.
            return respuesta.data.data;
        } catch (error) {
            // Captura y registra cualquier error que ocurra durante la solicitud para facilitar su depuración.
            console.error("Error al obtener las estimaciones de la oportunidad:", error);
        }
    };
};


export const extarerEstimacion = (idEstimacion) => {
    return async () => {
        try {
            // Realiza la llamada a la API para obtener las estimaciones relacionadas con la estimación especificada.
            const respuesta = await extraerEstimacionNetsuite({ idEstimacion });

            console.log("🚀 -----------------------------------------------------------------🚀");
            console.log("🚀 ~ file: thunkEstimacion.js:49 ~ return ~ respuesta:", respuesta);
            console.log("🚀 -----------------------------------------------------------------🚀");

            // Retorna el primer elemento de los datos obtenidos, que contiene la información principal de la estimación.
            return respuesta?.data || null; // Devuelve null si los datos están indefinidos.
        } catch (error) {
            // Captura y registra cualquier error que ocurra durante la solicitud para facilitar su depuración.
            console.error("Error al obtener los datos de la estimación:", error);
            throw error; // Re-lanza el error para permitir que sea manejado por el contexto externo.
        }
    };
};
