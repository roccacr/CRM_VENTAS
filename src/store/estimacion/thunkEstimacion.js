import { crearEstimacion } from "./Api_provider_estimacion";

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
