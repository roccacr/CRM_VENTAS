import { commonRequestData, fetchData } from "../../api";


export const fetchLeadsAsyncNew = async ({ idnetsuite_admin, rol_admin }) => {
    // Crea un objeto requestData combinando commonRequestData con el email y la contraseña proporcionados
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        rol_admin,
    };

    // Realiza una solicitud utilizando fetchData y retorna la respuesta
    return await fetchData("leads/home/new", requestData);
};

export const fetchLeadsAsyncAttention = async ({ idnetsuite_admin, rol_admin }) => {
    // Crea un objeto requestData combinando commonRequestData con el email y la contraseña proporcionados
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        rol_admin,
    };

    // Realiza una solicitud utilizando fetchData y retorna la respuesta
    return await fetchData("leads/home/attention", requestData);
};