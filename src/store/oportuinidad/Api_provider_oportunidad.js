// Importa las funciones comunes necesarias para realizar solicitudes API desde la ruta especificada.
import { commonRequestData, fetchData } from "../../api";

// Define una función asincrónica para obtener las ubicaciones mediante un ID específico.
export const get_Ubicaciones = async ({ idUbicacion }) => {
    // Construye el objeto de datos para la solicitud, combinando los datos comunes con los parámetros específicos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (como tokens de autenticación o configuraciones generales).
        idUbicacion, // ID utilizado para identificar y filtrar las ubicaciones solicitadas.
    };

    // Realiza una solicitud a la API para obtener las ubicaciones correspondientes al ID proporcionado.
    // La URL "oportunidad/getUbicaciones" apunta al endpoint que procesa esta petición en el servidor.
    // El objeto `requestData` incluye todos los parámetros necesarios para que la solicitud sea válida.
    return await fetchData("oportunidad/getUbicaciones", requestData); // Retorna los datos obtenidos de la API sobre la ubicación solicitada.
};

// Define una función asincrónica para obtener clases mediante un ID específico.
export const get_Clases = async ({ idClases }) => {

    // Construye el objeto de datos para la solicitud, combinando los datos comunes con los parámetros específicos.
    const requestData = {
        ...commonRequestData, // Datos comunes requeridos para cada solicitud (como tokens de autenticación o configuraciones generales).
        idClases, // ID utilizado para identificar y filtrar las clases solicitadas.
    };

    // Realiza una solicitud a la API para obtener las clases correspondientes al ID proporcionado.
    // La URL "oportunidad/getClases" apunta al endpoint que procesa esta petición en el servidor.
    // El objeto `requestData` incluye todos los parámetros necesarios para que la solicitud sea válida.
    return await fetchData("oportunidad/getClases", requestData); // Retorna los datos obtenidos de la API sobre las clases solicitadas.
};
