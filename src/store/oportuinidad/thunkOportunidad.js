import { get_Ubicaciones, get_Clases } from "./Api_provider_oportunidad";

// Define una función que retorna otra función asincrónica para obtener las ubicaciones según su ID.
export const getfetch_Ubicaciones = (idUbicacion) => {
    return async () => {
        try {
            // Llama a la API para obtener las ubicaciones correspondientes al ID proporcionado.
            const result = await get_Ubicaciones({ idUbicacion });

            // Retorna el primer elemento del resultado para su uso posterior en la lógica de la aplicación.
            return result.data["0"];
        } catch (error) {
            // Registra cualquier error en la consola para facilitar el análisis y depuración.
            console.error("Error al cargar las ubicaciones:", error);
        }
    };
};

// Define una función que retorna otra función asincrónica para obtener las clases según su ID.
export const getfetch_Clases = (idClases) => {

    return async () => {
        try {
            // Llama a la API para obtener las clases correspondientes al ID proporcionado.
            const result = await get_Clases({ idClases });

            // Retorna el primer elemento del resultado para su uso posterior en la lógica de la aplicación.
            return result.data["0"];
        } catch (error) {
            // Registra cualquier error en la consola para facilitar el análisis y depuración.
            console.error("Error al cargar las clases:", error);
        }
    };
};


