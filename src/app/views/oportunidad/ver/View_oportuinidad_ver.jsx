import { useEffect, useRef, useState } from "react";
import { InformacionBasicaOportunidad } from "./InformacionBasicaOportunidad";
import { InformacionBasicaExpedienteUnidad } from "./InformacionBasicaExpedienteUnidad";
import { EstimacionesOportunidad } from "./EstimacionesOportunidad";
import { getSpecificLead } from "../../../../store/leads/thunksLeads";
import { useDispatch } from "react-redux";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import { getSpecificOportunidad, updateOpportunityProbability, updateOpportunityStatus } from "../../../../store/oportuinidad/thunkOportunidad";
import Swal from "sweetalert2";
import { ModalEditarOportunidad } from "../EditarOportunidad/ModalEditarOportunidad";
import SticNotesContainer from "../../../../components/sticknotes/SticNotesContainer";

export const View_oportuinidad_ver = () => {
    const dispatch = useDispatch();
    const previousUrlAtEntryRef = useRef(localStorage.getItem("previousUrl"));

    useEffect(() => {
        const previousUrlAtEntry = previousUrlAtEntryRef.current;
        if (!previousUrlAtEntry) return;

        const currentPreviousUrl = localStorage.getItem("previousUrl");
        if (currentPreviousUrl !== previousUrlAtEntry) {
            localStorage.setItem("previousUrl", previousUrlAtEntry);
        }
    });
    // Estado para controlar la pestaÃ±a activa en la interfaz.
    const [activeTab, setActiveTab] = useState("infoPot");

    // FunciÃ³n para cambiar la pestaÃ±a activa.
    // Recibe la clave de la pestaÃ±a seleccionada ('tabKey') y actualiza el estado 'activeTab'.
    const handleTabClick = (tabKey) => {
        setActiveTab(tabKey); // Actualiza el estado con la pestaÃ±a seleccionada
    };

    // Estado para almacenar los detalles del lead y la oportunidad seleccionados.
    const [leadDetails, setLeadDetails] = useState({});
    const [OportunidadDetails, setOportunidadDetails] = useState({});

    // FunciÃ³n asÃ­ncrona para obtener los detalles de un lead especÃ­fico.
    const fetchLeadDetails = async (idLead) => {
        try {
            // Llama a la acciÃ³n 'getSpecificLead' pasando el 'idLead' y espera su resultado.
            const leadData = await dispatch(getSpecificLead(idLead));

            // Almacena los detalles obtenidos en el estado 'leadDetails' para su uso en la vista.
            setLeadDetails(leadData);
        } catch (error) {
            // Manejo de errores en caso de que la solicitud falle.
            console.error("Error al obtener los detalles del lead:", error);
        }
    };

    // FunciÃ³n asÃ­ncrona para obtener los detalles de una oportunidad especÃ­fica.
    const fetchOportunidadDetails = async (idOportunidad) => {
        try {
            // Llama a la acciÃ³n 'getSpecificOportunidad' pasando el 'idOportunidad' y espera su resultado.
            const oportunidadData = await dispatch(getSpecificOportunidad(idOportunidad));


            // Almacena los detalles obtenidos en el estado 'oportunidadDetails' para su uso en la vista.
            setOportunidadDetails(oportunidadData);
        } catch (error) {
            // Manejo de errores en caso de que la solicitud falle.
            console.error("Error al obtener los detalles de la oportunidad:", error);
        }
    };

    // FunciÃ³n para obtener el valor de un parÃ¡metro especÃ­fico de la URL.
    const getQueryParam = (param) => {
        // Crea una instancia de 'URLSearchParams' con los parÃ¡metros de la URL.
        const value = new URLSearchParams(location.search).get(param);

        // Verifica si el valor es numÃ©rico; si lo es, lo convierte a nÃºmero.
        if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
            return Number(value); // Retorna el valor como nÃºmero si es posible.
        }
        return value; // Si no es numÃ©rico, retorna el valor original como cadena de texto.
    };

    // Efecto para cargar detalles del lead y la oportunidad al montar el componente.
    useEffect(() => {
        // Obtiene los parÃ¡metros 'data' (para lead) y 'data2' (para oportunidad) desde la URL.
        const leadId = getQueryParam("data"); // Extrae el ID del lead desde la URL.
        const oportuinidadId = getQueryParam("data2"); // Extrae el ID de la oportunidad desde la URL.

        // Si 'leadId' es vÃ¡lido (mayor que 0), llama a las funciones para obtener los detalles correspondientes.
        if (leadId && leadId > 0) {
            fetchLeadDetails(leadId); // Solicita los detalles del lead.
            fetchOportunidadDetails(oportuinidadId); // Solicita los detalles de la oportunidad.
        }
    }, []); // El efecto se ejecuta al montar el componente.

    const handleStatusChange = (estado, idOportunidad) => {
        // Preguntar al usuario si desea cambiar el estado de la oportunidad
        Swal.fire({
            title: "Â¿Deseas cambiar el estado de la oportunidad?",
            text: "Esta acciÃ³n actualizarÃ¡ el estado de esta oportunidad.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "SÃ­, cambiar",
            cancelButtonText: "Cancelar",
        }).then((result) => {
            // Si el usuario confirma, ejecutamos el dispatch para actualizar el estado
            if (result.isConfirmed) {
                dispatch(updateOpportunityStatus(estado, idOportunidad)); // Llamada a la acciÃ³n que actualiza el estado de la oportunidad

                // ConfirmaciÃ³n de cambio de estado
                Swal.fire({
                    title: "Â¡Estado actualizado!",
                    text: "El estado de la oportunidad ha sido cambiado con Ã©xito.",
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
            title: "Â¿Deseas cambiar la probabilidad?",
            text: "Esta acciÃ³n actualizarÃ¡ la probabilidad de esta oportunidad.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "SÃ­, cambiar",
            cancelButtonText: "Cancelar",
        }).then((result) => {
            // Si el usuario confirma, ejecutamos el dispatch
            if (result.isConfirmed) {
                dispatch(updateOpportunityProbability(probabilidad, idOportunidad));

                // ConfirmaciÃ³n de cambio
                Swal.fire({
                    title: "Â¡Probabilidad actualizada!",
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

    // FunciÃ³n para abrir el modal
    const handleOpenModal = () => {
        setIsModalOpen(true);
    };

    // FunciÃ³n para cerrar el modal
    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    // FunciÃ³n callback para recargar los datos despuÃ©s de editar
    const handleEditSuccess = () => {
        // Obtener el ID de la oportunidad desde los parÃ¡metros de URL
        const oportuinidadId = getQueryParam("data2");

        // Recargar los detalles de la oportunidad
        if (oportuinidadId && oportuinidadId > 0) {
            fetchOportunidadDetails(oportuinidadId);
        }
    };

    return (
        <>
            {/* Sticky Notes Container */}
            <div style={{ position: 'relative', zIndex: 999 }}>
                <SticNotesContainer
                    idinternoLead={getQueryParam("data")}
                    transactionType="opportunity"
                    transactionId={getQueryParam("data2")}
                    sourceUrl={window.location.href}
                />
            </div>

            <div className="bg-dark card">
                <div className="card-body">
                    <div className="d-flex align-items-center">
                        <div className="flex-grow-1 me-3">
                            <h3 className="text-white">Vista general de la oportunidad </h3>
                            <p className="text-white text-opacity-75 text-opa mb-0">#{OportunidadDetails?.tranid_oport || ""}</p>
                        </div>
                        <div className="flex-shrink-0">
                            <img
                                alt="img"
                                loading="lazy"
                                width="92"
                                height="90"
                                decoding="async"
                                data-nimg="1"
                                className="img-fluid wid-80"
                                srcSet=""
                                src="https://light-able-react-light.vercel.app/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fimg-accout-alert.a2294f08.png&w=96&q=75"
                                style={{ color: "transparent" }}
                            />
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
                                    <img
                                        alt="User image"
                                        loading="lazy"
                                        width="100"
                                        height="100"
                                        decoding="async"
                                        data-nimg="1"
                                        className="rounded-circle img-fluid wid-90 img-thumbnail"
                                        src="/opt.png"
                                        style={{ color: "transparent" }}
                                    />
                                    <i className="chat-badge bg-success me-2 mb-2"></i>
                                </div>
                                <h5 className="mb-0">#{OportunidadDetails?.tranid_oport || ""}</h5>
                                <p className="text-muted text-sm">{leadDetails.nombre_lead}</p>
                                <ul className="list-inline mx-auto my-4">
                                    <blockquote className="blockquote blockquote-reverse font-size-16 mb-0">
                                        {Object.keys(leadDetails).length > 0 && <ButtonActions leadData={leadDetails} className="mb-4" />}
                                    </blockquote>
                                    <li className="list-inline-item mb-2">
                                        {" "}
                                        {/* Espacio entre botones */}
                                        <button className="btn btn-sm btn-dark" onClick={handleOpenModal}>
                                            <i className="ti ti-edit-circle f-24"></i> Editar Oportunidad
                                        </button>
                                    </li>
                                    <li className="list-inline-item mb-2">
                                        {" "}
                                        {/* Espacio entre botones */}
                                        {OportunidadDetails?.chek_oport === 0 ? (
                                            <button
                                                className="btn btn-sm btn-success"
                                                onClick={() => handleProbabilidadChange(1, OportunidadDetails?.id_oportunidad_oport)}
                                            >
                                                <i className="ti ti-check f-24"></i> Oportunidades + probable
                                            </button>
                                        ) : (
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleProbabilidadChange(0, OportunidadDetails?.id_oportunidad_oport)}
                                            >
                                                <i className="ti ti-x f-24"></i> Oportunidades - probable
                                            </button>
                                        )}
                                    </li>
                                    <li className="list-inline-item mb-2">
                                        {" "}
                                        {/* Espacio entre botones */}
                                        {OportunidadDetails?.estatus_oport === 1 ? (
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleStatusChange(0, OportunidadDetails?.id_oportunidad_oport)}
                                            >
                                                <i className="ti ti-x f-24"></i> Inactivar Oportunidad
                                            </button>
                                        ) : (
                                            <button
                                                className="btn btn-sm btn-success"
                                                onClick={() => handleStatusChange(1, OportunidadDetails?.id_oportunidad_oport)}
                                            >
                                                <i className="ti ti-edit-circle f-24"></i> Activar Oportunidad
                                            </button>
                                        )}
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div
                            className="flex-column list-group list-group-flush account-pills mb-0 nav nav-pills"
                            id="user-set-tab"
                            aria-orientation="vertical"
                            role="tablist"
                        >
                            <a
                                onClick={() => handleTabClick("infoPot")}
                                role="tab"
                                className={`list-group-item list-group-item-action nav-link ${activeTab === "infoPot" ? "active" : ""}`}
                            >
                                <span className="f-w-500">
                                    <i className="ph-duotone ph-user-circle m-r-10"></i>Informacion Oportunidad
                                </span>
                            </a>
                            <a
                                onClick={() => handleTabClick("Expediente")}
                                role="tab"
                                className={`list-group-item list-group-item-action nav-link ${activeTab === "Expediente" ? "active" : ""}`}
                            >
                                <span className="f-w-500">
                                    <i className="ph-duotone ph-calendar m-r-10"></i> Expediente de unidad
                                </span>
                            </a>
                            <a
                                onClick={() => handleTabClick("Estimaciones")}
                                role="tab"
                                className={`list-group-item list-group-item-action nav-link ${activeTab === "Estimaciones" ? "active" : ""}`}
                            >
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
                                <p className="mb-0">#{OportunidadDetails?.tranid_oport || "0"}</p>
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
                                        color: OportunidadDetails?.estatus_oport === 1 ? "green" : "red",
                                    }}
                                >
                                    {OportunidadDetails?.estatus_oport === 1 ? "Activo" : "Inactivo"}
                                </p>
                            </div>
                            <div className="d-inline-flex align-items-center justify-content-between w-100">
                                <p className="mb-0 text-muted me-1">Metodo de Pago</p>
                                <p className="mb-0">{OportunidadDetails?.nombre_motivo_pago}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="col-xxl-9 col-lg-7">
                    <div className="tab-content" id="user-set-tabContent">
                        {activeTab === "infoPot" && (
                            <div
                                id="react-aria8348725315-:r6:-tabpane-infoPot"
                                role="tabpanel"
                                aria-labelledby="react-aria8348725315-:r6:-tab-infoPot"
                                className="fade fade tab-pane active show"
                            >
                                <InformacionBasicaOportunidad oportuinidadId={OportunidadDetails} cliente={leadDetails.nombre_lead} />
                            </div>
                        )}
                        {activeTab === "Expediente" && (
                            <div
                                id="react-aria8348725315-:r6:-tabpane-Expediente"
                                role="tabpanel"
                                aria-labelledby="react-aria8348725315-:r6:-tab-Expediente"
                                className="fade fade tab-pane active show"
                            >
                                <InformacionBasicaExpedienteUnidad idExpediente={OportunidadDetails.exp_custbody38_oport} />
                            </div>
                        )}
                        {activeTab === "Estimaciones" && (
                            <div
                                id="react-aria8348725315-:r6:-tabpane-Estimaciones"
                                role="tabpanel"
                                aria-labelledby="react-aria8348725315-:r6:-tab-Estimaciones"
                                className="fade fade tab-pane active show"
                            >
                                <EstimacionesOportunidad OportunidadDetails={OportunidadDetails} cliente={leadDetails} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <ModalEditarOportunidad
                open={isModalOpen}
                onClose={handleCloseModal}
                OportunidadDetails={OportunidadDetails}
                onSuccess={handleEditSuccess}
            />
        </>
    );
};

