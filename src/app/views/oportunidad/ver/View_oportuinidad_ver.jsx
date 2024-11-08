import { useEffect, useState } from "react";
import { InformacionBasicaOportunidad } from "./InformacionBasicaOportunidad";
import { InformacionBasicaExpedienteUnidad } from "./InformacionBasicaExpedienteUnidad";
import { EstimacionesOportunidad } from "./EstimacionesOportunidad";
import { getSpecificLead } from "../../../../store/leads/thunksLeads";
import { useDispatch } from "react-redux";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import { getSpecificOportunidad, updateOpportunityProbability, updateOpportunityStatus } from "../../../../store/oportuinidad/thunkOportunidad";
import Swal from "sweetalert2";
import { ModalEditarOportunidad } from "../EditarOportunidad/ModalEditarOportunidad";

export const View_oportuinidad_ver = () => {
    const dispatch = useDispatch();
    // Estado para controlar la pestaña activa en la interfaz.
    const [activeTab, setActiveTab] = useState("infoPot");

    // Función para cambiar la pestaña activa.
    // Recibe la clave de la pestaña seleccionada ('tabKey') y actualiza el estado 'activeTab'.
    const handleTabClick = (tabKey) => {
        setActiveTab(tabKey); // Actualiza el estado con la pestaña seleccionada
    };

    // Estado para almacenar los detalles del lead y la oportunidad seleccionados.
    const [leadDetails, setLeadDetails] = useState({});
    const [OportunidadDetails, setOportunidadDetails] = useState({});

    // Función asíncrona para obtener los detalles de un lead específico.
    const fetchLeadDetails = async (idLead) => {
        try {
            // Llama a la acción 'getSpecificLead' pasando el 'idLead' y espera su resultado.
            const leadData = await dispatch(getSpecificLead(idLead));

            // Almacena los detalles obtenidos en el estado 'leadDetails' para su uso en la vista.
            setLeadDetails(leadData);
        } catch (error) {
            // Manejo de errores en caso de que la solicitud falle.
            console.error("Error al obtener los detalles del lead:", error);
        }
    };

    // Función asíncrona para obtener los detalles de una oportunidad específica.
    const fetchOportunidadDetails = async (idOportunidad) => {
        try {
            // Llama a la acción 'getSpecificOportunidad' pasando el 'idOportunidad' y espera su resultado.
            const oportunidadData = await dispatch(getSpecificOportunidad(idOportunidad));

            // Almacena los detalles obtenidos en el estado 'oportunidadDetails' para su uso en la vista.
            setOportunidadDetails(oportunidadData);
        } catch (error) {
            // Manejo de errores en caso de que la solicitud falle.
            console.error("Error al obtener los detalles de la oportunidad:", error);
        }
    };

    // Función para obtener el valor de un parámetro específico de la URL.
    const getQueryParam = (param) => {
        // Crea una instancia de 'URLSearchParams' con los parámetros de la URL.
        const value = new URLSearchParams(location.search).get(param);

        // Verifica si el valor es numérico; si lo es, lo convierte a número.
        if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
            return Number(value); // Retorna el valor como número si es posible.
        }
        return value; // Si no es numérico, retorna el valor original como cadena de texto.
    };

    // Efecto para cargar detalles del lead y la oportunidad al montar el componente.
    useEffect(() => {
        // Obtiene los parámetros 'data' (para lead) y 'data2' (para oportunidad) desde la URL.
        const leadId = getQueryParam("data"); // Extrae el ID del lead desde la URL.
        const oportuinidadId = getQueryParam("data2"); // Extrae el ID de la oportunidad desde la URL.

        // Si 'leadId' es válido (mayor que 0), llama a las funciones para obtener los detalles correspondientes.
        if (leadId && leadId > 0) {
            fetchLeadDetails(leadId); // Solicita los detalles del lead.
            fetchOportunidadDetails(oportuinidadId); // Solicita los detalles de la oportunidad.
        }
    }, []); // El efecto se ejecuta al montar el componente.

    const handleStatusChange = (estado, idOportunidad) => {
        // Preguntar al usuario si desea cambiar el estado de la oportunidad
        Swal.fire({
            title: "¿Deseas cambiar el estado de la oportunidad?",
            text: "Esta acción actualizará el estado de esta oportunidad.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sí, cambiar",
            cancelButtonText: "Cancelar",
        }).then((result) => {
            // Si el usuario confirma, ejecutamos el dispatch para actualizar el estado
            if (result.isConfirmed) {
                dispatch(updateOpportunityStatus(estado, idOportunidad)); // Llamada a la acción que actualiza el estado de la oportunidad

                // Confirmación de cambio de estado
                Swal.fire({
                    title: "¡Estado actualizado!",
                    text: "El estado de la oportunidad ha sido cambiado con éxito.",
                    icon: "success",
                    timer: 1500,
                    showConfirmButton: false,
                }).then(() => {
                    fetchOportunidadDetails(idOportunidad); // Solicita los detalles de la oportunidad.
                });
            }
        });
    };

    const handleProbabilidadChange = (probabilidad, idOportunidad) => {
        // Preguntar al usuario si desea cambiar la probabilidad
        Swal.fire({
            title: "¿Deseas cambiar la probabilidad?",
            text: "Esta acción actualizará la probabilidad de esta oportunidad.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sí, cambiar",
            cancelButtonText: "Cancelar",
        }).then((result) => {
            // Si el usuario confirma, ejecutamos el dispatch
            if (result.isConfirmed) {
                dispatch(updateOpportunityProbability(probabilidad, idOportunidad));

                // Confirmación de cambio
                Swal.fire({
                    title: "¡Probabilidad actualizada!",
                    text: "La probabilidad de la oportunidad ha sido cambiada.",
                    icon: "success",
                    timer: 1500,
                    showConfirmButton: false,
                }).then(() => {
                    fetchOportunidadDetails(idOportunidad); // Solicita los detalles de la oportunidad.
                });
            }
        });
    };

    // Estado para controlar la visibilidad del modal
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Función para abrir el modal
    const handleOpenModal = () => {
        setIsModalOpen(true);
    };

    // Función para cerrar el modal
    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    return (
        <>
            <div className="bg-dark card">
                <div className="card-body">
                    <div className="d-flex align-items-center">
                        <div className="flex-grow-1 me-3">
                            <h3 className="text-white">Vista general de la oportunidad </h3>
                            <p className="text-white text-opacity-75 text-opa mb-0">#{OportunidadDetails.tranid_oport}</p>
                        </div>
                        <div className="flex-shrink-0">
                            <img alt="img" loading="lazy" width="92" height="90" decoding="async" data-nimg="1" className="img-fluid wid-80" srcSet="" src="https://light-able-react-light.vercel.app/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fimg-accout-alert.a2294f08.png&w=96&q=75" style={{ color: "transparent" }} />
                        </div>
                    </div>
                </div>
            </div>{" "}
            <div className="row">
                <div className="col-xxl-3 col-lg-5">
                    <div className="overflow-hidden card">
                        <div className="position-relative card-body">
                            <div className="text-center mt-3">
                                <div className="chat-avtar d-inline-flex mx-auto">
                                    <img alt="User image" loading="lazy" width="100" height="100" decoding="async" data-nimg="1" className="rounded-circle img-fluid wid-90 img-thumbnail" src="/opt.png" style={{ color: "transparent" }} />
                                    <i className="chat-badge bg-success me-2 mb-2"></i>
                                </div>
                                <h5 className="mb-0">#{OportunidadDetails.tranid_oport}</h5>
                                <p className="text-muted text-sm">{leadDetails.nombre_lead}</p>
                                <ul className="list-inline mx-auto my-4">
                                    <blockquote className="blockquote  blockquote-reverse font-size-16 mb-0">{Object.keys(leadDetails).length > 0 && <ButtonActions leadData={leadDetails} className="mb-4" />}</blockquote>

                                    <ul className="list-inline mx-auto my-4">
                                        <li className="list-inline-item">
                                            <button className="btn btn-sm btn-dark" onClick={handleOpenModal}>
                                                <i className="ti ti-edit-circle f-24"></i> Editar Oportunidad
                                            </button>
                                        </li>
                                        <li className="list-inline-item">
                                            {OportunidadDetails?.chek_oport === 0 ? (
                                                <button
                                                    className="btn btn-sm btn-success"
                                                    onClick={() => handleProbabilidadChange(1, OportunidadDetails.id_oportunidad_oport)} // Cambia a "Oportunidades + probable"
                                                >
                                                    <i className="ti ti-check f-24"></i> Oportunidades + probable
                                                </button>
                                            ) : (
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleProbabilidadChange(0, OportunidadDetails.id_oportunidad_oport)} // Cambia a "Oportunidades - probable"
                                                >
                                                    <i className="ti ti-x f-24"></i> Oportunidades - probable
                                                </button>
                                            )}
                                        </li>
                                    </ul>
                                    <ul className="list-inline mx-auto my-4">
                                        <li className="list-inline-item">
                                            {OportunidadDetails.estatus_oport === 1 ? (
                                                <button
                                                    className="btn btn-sm btn-danger"
                                                    onClick={() => handleStatusChange(0, OportunidadDetails.id_oportunidad_oport)} // Función para cambiar el estado a 0 (Inactivar)
                                                >
                                                    <i className="ti ti-x f-24"></i> Inactivar Oportunidad
                                                </button>
                                            ) : (
                                                <button
                                                    className="btn btn-sm btn-success"
                                                    onClick={() => handleStatusChange(1, OportunidadDetails.id_oportunidad_oport)} // Función para cambiar el estado a 1 (Activar)
                                                >
                                                    <i className="ti ti-edit-circle f-24"></i> Activar Oportunidad
                                                </button>
                                            )}
                                        </li>
                                    </ul>
                                </ul>
                            </div>
                        </div>
                        <div className="flex-column list-group list-group-flush account-pills mb-0 nav nav-pills" id="user-set-tab" aria-orientation="vertical" role="tablist">
                            <a onClick={() => handleTabClick("infoPot")} role="tab" className={`list-group-item list-group-item-action nav-link ${activeTab === "infoPot" ? "active" : ""}`}>
                                <span className="f-w-500">
                                    <i className="ph-duotone ph-user-circle m-r-10"></i>Informacion Oportunidad
                                </span>
                            </a>
                            <a onClick={() => handleTabClick("Expediente")} role="tab" className={`list-group-item list-group-item-action nav-link ${activeTab === "Expediente" ? "active" : ""}`}>
                                <span className="f-w-500">
                                    <i className="ph-duotone ph-calendar m-r-10"></i> Expediente de unidad
                                </span>
                            </a>
                            <a onClick={() => handleTabClick("Estimaciones")} role="tab" className={`list-group-item list-group-item-action nav-link ${activeTab === "Estimaciones" ? "active" : ""}`}>
                                <span className="f-w-500">
                                    <i className="ph-duotone ph-notebook m-r-10"></i> Estimaciones
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
                                <p className="mb-0 text-muted me-1">Codigo Oportunidad</p>
                                <p className="mb-0">#{OportunidadDetails.tranid_oport}</p>
                            </div>
                            <div className="d-inline-flex align-items-center justify-content-between w-100 mb-3">
                                <p className="mb-0 text-muted me-1">Cliente Relacionado</p>
                                <p className="mb-0">{leadDetails.nombre_lead}</p>
                            </div>
                            <div className="d-inline-flex align-items-center justify-content-between w-100 mb-3">
                                <p className="mb-0 text-muted me-1">Estado Oportunidad</p>
                                <p
                                    className="mb-0"
                                    style={{
                                        color: OportunidadDetails.estatus_oport === 1 ? "green" : "red",
                                    }}
                                >
                                    {OportunidadDetails.estatus_oport === 1 ? "Activo" : "Inactivo"}
                                </p>
                            </div>
                            <div className="d-inline-flex align-items-center justify-content-between w-100">
                                <p className="mb-0 text-muted me-1">Metodo de Pago</p>
                                <p className="mb-0">{OportunidadDetails.nombre_motivo_pago}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-xxl-9 col-lg-7">
                    <div className="tab-content" id="user-set-tabContent">
                        {activeTab === "infoPot" && (
                            <div id="react-aria8348725315-:r6:-tabpane-infoPot" role="tabpanel" aria-labelledby="react-aria8348725315-:r6:-tab-infoPot" className="fade fade tab-pane active show">
                                <InformacionBasicaOportunidad oportuinidadId={OportunidadDetails} cliente={leadDetails.nombre_lead} />
                            </div>
                        )}
                        {activeTab === "Expediente" && (
                            <div id="react-aria8348725315-:r6:-tabpane-Expediente" role="tabpanel" aria-labelledby="react-aria8348725315-:r6:-tab-Expediente" className="fade fade tab-pane active show">
                                <InformacionBasicaExpedienteUnidad idExpediente={OportunidadDetails.exp_custbody38_oport} />
                            </div>
                        )}
                        {activeTab === "Estimaciones" && (
                            <div id="react-aria8348725315-:r6:-tabpane-Estimaciones" role="tabpanel" aria-labelledby="react-aria8348725315-:r6:-tab-Estimaciones" className="fade fade tab-pane active show">
                                <EstimacionesOportunidad />
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <ModalEditarOportunidad open={isModalOpen} onClose={handleCloseModal} OportunidadDetails={OportunidadDetails} />
        </>
    );
};
