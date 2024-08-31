import { commonRequestData, fetchData } from "../../api";

export const fetchNewLeads = async ({ idnetsuite_admin, rol_admin }) => {
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        rol_admin,
    };
    return await fetchData("home/new", requestData);
};

export const fetchLeadsUnderAttention = async ({ idnetsuite_admin, rol_admin }) => {
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        rol_admin,
    };
    return await fetchData("home/attention", requestData);
};

export const fetchAllEvents = async ({ idnetsuite_admin, rol_admin }) => {
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        rol_admin,
    };
    return await fetchData("events/home/events", requestData);
};

export const updateEventStatus = async ({ idnetsuite_admin, id_calendar, newStatus }) => {
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        id_calendar,
        newStatus,
    };
    return await fetchData("events/home/updateEventsStatusAsync", requestData);
};

export const fetchOpportunities = async ({ idnetsuite_admin, rol_admin }) => {
    const requestData = {
        ...commonRequestData,
        idnetsuite_admin,
        rol_admin,
    };
    return await fetchData("home/fetchOportunityAsync", requestData);
};
