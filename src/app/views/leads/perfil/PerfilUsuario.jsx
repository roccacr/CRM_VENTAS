import { useEffect, useState } from "react";
import { getBitacoraLeads, getSpecificLead, updateLeadStatus } from "../../../../store/leads/thunksLeads";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import { useDispatch } from "react-redux";
import { HeaderContent } from "./HeaderContent";
import { Seguimiento } from "./Seguimiento";
import { Eventos } from "./Eventos";
import { Oportunidades } from "./Oportunidades";
import { InfromacionCompleta } from "./InfromacionCompleta";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

export const PerfilUsuario = () => {
    const dispatch = useDispatch();
    // Estado para almacenar los detalles generales del lead.
    const [leadDetails, setLeadDetails] = useState({});
    const [activeTab, setActiveTab] = useState("LineTime");
    const [BitacoraLeads, setBitacora] = useState([]);

    const handleTabClick = (tabKey) => {
        setActiveTab(tabKey); // Actualiza el estado con la pestaña seleccionada
    };

    const fetchLeadDetails = async (idLead) => {
        try {
            // Llama a la acción 'getSpecificLead' y actualiza el estado 'leadDetails'.
            const leadData = await dispatch(getSpecificLead(idLead));

            // Guarda todos los detalles del lead en el estado 'leadDetails' para su uso posterior.
            setLeadDetails(leadData);
        } catch (error) {
            console.error("Error al obtener los detalles del lead:", error); // Manejo de errores.
        }
    };

    const fetchBitacora = async (idLead) => {
        try {
            const result = await dispatch(getBitacoraLeads(idLead)); // Llama a la acción de Redux para obtener la bitácora del lead.
            setBitacora(result); // Almacena los resultados en el estado.
        } catch (error) {
            console.error("Error fetching bitacora:", error); // Maneja cualquier error.
        }
    };

    // Función para obtener el valor de un parámetro específico de la URL.
    const getQueryParam = (param) => {
        // Crea una instancia de 'URLSearchParams' con los parámetros de la URL.
        const value = new URLSearchParams(location.search).get(param);

        // Verifica si el valor es numérico. Si lo es, lo convierte a un número.
        if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
            return Number(value); // Retorna el valor como número.
        }
        return value; // Si no es numérico, retorna el valor original como cadena de texto.
    };

    useEffect(() => {
        // Obtiene los parámetros 'idLead', 'idCalendar', y 'idDate' desde la URL.
        const leadId = getQueryParam("data"); // Extrae el ID del lead desde la URL.

        // Si 'leadId' es válido (mayor que 0), llama a la función para obtener los detalles del lead.
        if (leadId && leadId > 0) {
            fetchLeadDetails(leadId); // Ejecuta la solicitud para obtener los detalles del lead.
            fetchBitacora(leadId); // Ejecuta la solicitud para obtener la bitácora del lead.
        }
    }, [location.search]); // El efecto se ejecuta nuevamente si 'location.search' cambia.
    const navigate = useNavigate();
        const handleClienteStatusChange = (estado, idCliente) => {
            // Preguntar al usuario si desea cambiar el estado del cliente
            Swal.fire({
                title: "¿Deseas cambiar el estado del cliente?",
                text: "Esta acción actualizará el estado del cliente seleccionado.",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Sí, cambiar",
                cancelButtonText: "Cancelar",
            }).then((result) => {
                // Si el usuario confirma, ejecutamos el dispatch para actualizar el estado
                if (result.isConfirmed) {
                    dispatch(updateLeadStatus(estado, idCliente)); // Llamada a la acción que actualiza el estado del cliente

                    // Confirmación de cambio de estado
                    Swal.fire({
                        title: "¡Estado del cliente actualizado!",
                        text: "El estado del cliente ha sido cambiado con éxito.",
                        icon: "success",
                        timer: 1500,
                        showConfirmButton: false,
                    }).then(() => {
                        fetchLeadDetails(idCliente); // Ejecuta la solicitud para obtener los detalles del lead.
                    });
                }
            });
        };

    const irEditarCliente = (irEditarCliente) => {
        navigate(`/leads/edit?id=${irEditarCliente}`);
    };
    return (
        <>
            <HeaderContent leadInformations={leadDetails} />
            <div className="row">
                <div className="col-xxl-3 col-lg-5">
                    <div className="overflow-hidden card">
                        <div className="position-relative card-body">
                            <div className="text-center mt-3">
                                <div className="chat-avtar d-inline-flex mx-auto">
                                    <img alt="User image" loading="lazy" width="100" height="100" decoding="async" data-nimg="1" className="rounded-circle img-fluid wid-90 img-thumbnail" src="/avatar.webp" style={{ color: "transparent" }} />
                                    <i className="chat-badge bg-success me-2 mb-2"></i>
                                </div>
                                <h5 className="mb-0">{leadDetails.nombre_lead}</h5>
                                <p className="text-muted text-sm">{leadDetails.segimineto_lead || ""}</p>
                                <ul className="list-inline mx-auto my-4">
                                    <blockquote className="blockquote  blockquote-reverse font-size-16 mb-0">{Object.keys(leadDetails).length > 0 && <ButtonActions leadData={leadDetails} className="mb-4" />}</blockquote>

                                    <ul className="list-inline mx-auto my-4">
                                        <li className="list-inline-item">
                                            <button onClick={() => irEditarCliente(leadDetails.idinterno_lead)} className="btn btn-sm btn-dark">
                                                {" "}
                                                <i className="ti ti-edit-circle f-24"></i> Editar Perfil{" "}
                                            </button>
                                        </li>
                                        <li className="list-inline-item">
                                            {leadDetails.estado_lead === 1 ? (
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleClienteStatusChange(0, leadDetails.idinterno_lead)} // Cambiar a "Inactivar cliente"
                                                >
                                                    <i className="ti ti-x f-24"></i> Inactivar cliente
                                                </button>
                                            ) : (
                                                <button
                                                    className="btn btn-sm btn-success"
                                                    onClick={() => handleClienteStatusChange(1, leadDetails.idinterno_lead)} // Cambiar a "Activar cliente"
                                                >
                                                    <i className="ti ti-checks f-24"></i> Activar cliente
                                                </button>
                                            )}
                                        </li>
                                    </ul>
                                </ul>
                            </div>
                        </div>
                        <div className="flex-column list-group list-group-flush account-pills mb-0 nav nav-pills" id="user-set-tab" aria-orientation="vertical" role="tablist">
                            <a onClick={() => handleTabClick("LineTime")} role="tab" className={`list-group-item list-group-item-action nav-link ${activeTab === "LineTime" ? "active" : ""}`}>
                                <span className="f-w-500">
                                    <i className="ph-duotone ph-user-circle m-r-10"></i>Bitácora de Seguimiento
                                </span>
                            </a>
                            <a onClick={() => handleTabClick("Eventos")} role="tab" className={`list-group-item list-group-item-action nav-link ${activeTab === "Eventos" ? "active" : ""}`}>
                                <span className="f-w-500">
                                    <i className="ph-duotone ph-calendar m-r-10"></i> Lista de eventos
                                </span>
                            </a>
                            <a onClick={() => handleTabClick("Oportunidades")} role="tab" className={`list-group-item list-group-item-action nav-link ${activeTab === "Oportunidades" ? "active" : ""}`}>
                                <span className="f-w-500">
                                    <i className="ph-duotone ph-notebook m-r-10"></i> Oportunidades
                                </span>
                            </a>
                            <a onClick={() => handleTabClick("Informacion")} role="tab" className={`list-group-item list-group-item-action nav-link ${activeTab === "Informacion" ? "active" : ""}`}>
                                <span className="f-w-500">
                                    <i className="ph-duotone ph-user-circle m-r-10"></i> Informacion Completada
                                </span>
                            </a>
                        </div>
                    </div>
                    <div className="card">
                        <div className="card-header">
                            <h5>Informacion Basica</h5>
                        </div>
                        <div className="position-relative card-body">
                            <div className="d-inline-flex align-items-center justify-content-between w-100 mb-3">
                                <p className="mb-0 text-muted me-1">Correo</p>
                                <p className="mb-0">{leadDetails.email_lead}</p>
                            </div>
                            <div className="d-inline-flex align-items-center justify-content-between w-100 mb-3">
                                <p className="mb-0 text-muted me-1">Telefono</p>
                                <p className="mb-0">{leadDetails.telefono_lead}</p>
                            </div>
                            <div className="d-inline-flex align-items-center justify-content-between w-100 mb-3">
                                <p className="mb-0 text-muted me-1">Proyecto</p>
                                <p className="mb-0">{leadDetails.proyecto_lead}</p>
                            </div>
                            <div className="d-inline-flex align-items-center justify-content-between w-100">
                                <p className="mb-0 text-muted me-1">Campaña</p>
                                <p className="mb-0">{leadDetails.campana_lead}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-xxl-9 col-lg-7">
                    <div className="tab-content" id="user-set-tabContent">
                        {activeTab === "LineTime" && (
                            <div id="react-aria8348725315-:r6:-tabpane-LineTime" role="tabpanel" aria-labelledby="react-aria8348725315-:r6:-tab-LineTime" className="fade fade tab-pane active show">
                                <Seguimiento BitacoraLeads={BitacoraLeads} />
                            </div>
                        )}
                        {activeTab === "Eventos" && (
                            <div id="react-aria8348725315-:r6:-tabpane-Eventos" role="tabpanel" aria-labelledby="react-aria8348725315-:r6:-tab-Eventos" className="fade fade tab-pane active show">
                                <Eventos leadDetails={leadDetails.idinterno_lead} />
                            </div>
                        )}
                        {activeTab === "Oportunidades" && (
                            <div id="react-aria8348725315-:r6:-tabpane-Oportunidades" role="tabpanel" aria-labelledby="react-aria8348725315-:r6:-tab-Oportunidades" className="fade fade tab-pane active show">
                                <Oportunidades leadDetails={leadDetails.idinterno_lead} />
                            </div>
                        )}
                        {activeTab === "Informacion" && (
                            <div id="react-aria8348725315-:r6:-tabpane-Informacion" role="tabpanel" aria-labelledby="react-aria8348725315-:r6:-tab-Informacion" className="fade fade tab-pane active show">
                                <InfromacionCompleta leadDetails={leadDetails} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
