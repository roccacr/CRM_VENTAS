import { getAllExpedientes, updateExpediente } from "./Api_expedintes_Providers";

/**
 * Función para obtener y gestionar la lista de expedientes.
 *
 * Esta función es un thunk (acción asíncrona) que despacha una solicitud para obtener
 * la lista completa de expedientes a través de la función `getAllExpedientes()`.
 * Utiliza Redux para actualizar el estado con los datos obtenidos.
 *
 * @returns {Function} - Devuelve una función asíncrona que maneja la lógica de obtención de datos.
 */
export const getFileList = () => {
    return async () => {
        try {
            // Llama a la función getAllExpedientes para obtener la lista completa de expedientes
            const result = await getAllExpedientes();



            // Si la API responde con éxito, despacha una acción para actualizar el estado de Redux.
            // La propiedad "0" de result.data contiene la lista de expedientes obtenida.
            // dispatch(setLeadsNew(result.data["0"])); // Actualiza el estado con la lista de expedientes.

            return result.data["0"]; // Devuelve los datos obtenidos para posibles usos adicionales.
        } catch (error) {
            // En caso de error, muestra el error en la consola para diagnóstico.
            console.error("Error al cargar la lista completa de expedientes", error);
        }
    };
};


// Acción de Redux Thunk
// Acción de Redux Thunk para actualizar un expediente específico.
export const actualizarExpediente = (id_expediente) => {
    /**
     * Esta función retorna otra función asincrónica que recibe `dispatch` como argumento.
     * Esto permite utilizar Redux Thunk para ejecutar lógica asíncrona (como llamadas a la API) 
     * antes de despachar acciones al store de Redux.
     */
    return async () => {
        try {
            // Llama a la función `updateExpediente` para actualizar el expediente mediante una API.
            // Se pasa el ID del expediente como parámetro para identificar el expediente a actualizar.
            await updateExpediente({ id_expediente });

            // Devuelve "ok" si la actualización es exitosa.
            return "ok";
        } catch (error) {
            // Registra en la consola cualquier error que ocurra durante la actualización del expediente.
            console.error("Error al actualizar el expediente de unidad:", error);

            // Podrías añadir un manejo de errores adicional aquí, 
            // como despachar una acción para actualizar el estado de error en Redux.
        }
    };
};

