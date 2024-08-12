import { commonRequestData, fetchData } from "../../api";


export const fetchLeadsAsync = async () => {
    // Crea un objeto requestData combinando commonRequestData con el email y la contraseña proporcionados
    const requestData = {
        ...commonRequestData,
    };

    // Realiza una solicitud utilizando fetchData y retorna la respuesta
    return await fetchData("leads", requestData);
};
