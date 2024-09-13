import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { getBitacoraLeads } from "../../../store/leads/thunksLeads";

export const ModalLeads = ({ leadData, onClose }) => {
    const dispatch = useDispatch(); // Hook para despachar acciones a Redux.
    const [showModal, setShowModal] = useState(false);
    const [isMobile, setIsMobile] = useState(window.matchMedia("(max-width: 768px)").matches);
    const [showPreload, setShowPreload] = useState(true); // Estado para manejar el preload
    const [bitacora, setBitacora] = useState([]); // Estado para almacenar los datos de la bitácora

    useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 768px)");
        const handleMediaQueryChange = (e) => setIsMobile(e.matches);
        mediaQuery.addEventListener("change", handleMediaQueryChange);
        return () => mediaQuery.removeEventListener("change", handleMediaQueryChange);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setShowModal(true), 100);
        return () => clearTimeout(timer);
    }, [leadData]);

    useEffect(() => {
        const fetchBitacora = async () => {
            try {
                const result = await dispatch(getBitacoraLeads(leadData?.idinterno_lead));
                setBitacora(result); // Guardamos los resultados en el estado
                setShowPreload(false); // Ocultamos el preload después de que los datos son cargados
            } catch (error) {
                console.error("Error fetching bitacora:", error);
                setShowPreload(false); // Aseguramos que se oculte el preload en caso de error
            }
        };
        fetchBitacora();
    }, [dispatch, leadData]);

    const handleClose = () => {
        setShowModal(false);
        setTimeout(() => onClose && onClose(), 100);
    };

    const handleCopy = () => {
        const leadName = leadData?.nombre_lead || "No cuenta con nombre de cliente";
        navigator.clipboard.writeText(leadName).then(() => {
            console.log("Texto copiado al portapapeles:", leadName);
        });
    };

    const buttonData = [
        { text: "Ir a Whatsapp", icon: "fab fa-whatsapp", color: "#25d366" },
        { text: "Whatsapp y Contacto", icon: "fab fa-whatsapp", color: "#25d366" },
        { text: "Nota de Contacto", icon: "fab fa-wpforms", color: "#c0392b" },
        { text: "Crear un evento", icon: "fas fa-calendar-check", color: "#2c3e50" },
        { text: "Dar como perdido", icon: "fas fa-window-close", color: "#78281f" },
        { text: "Colocar en seguimiento", icon: "fas fa-location-arrow", color: "#f1c40f" },
        { text: "Crear Oportunidad", icon: "fas fa-level-up-alt", color: "#af7ac5" },
        { text: "Lista Oportunidades", icon: "fas fa-stream", color: "#2471a3" },
        { text: "Llamar cliente", icon: "fas fa-phone", color: "#2e86c1" },
        { text: "Ver Perfil", icon: "fas fa-user-circle", color: "#7b7d7d" },
    ];

    const renderButtons = (forDropdown = false) =>
        buttonData.map((btn, idx) => (
            <li
                key={idx}
                className={forDropdown ? "dropdown-item" : "btn btn-shadow"}
                style={
                    !forDropdown ? { backgroundColor: btn.color, color: "#fff", borderColor: btn.color, marginBottom: "0px" } : { marginBottom: "5px" } // Estilos sin color para el dropdown
                }
            >
                <i className={btn.icon}></i> {btn.text}
            </li>
        ));

    const formatDate = (dateString) => {
        const date = new Date(dateString);

        // Ajustar la fecha a la zona horaria de Costa Rica (UTC-6)
        const localDate = new Date(date.getTime() - 6 * 60 * 60 * 1000);

        // Extraer año, mes y día
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, "0");
        const day = String(localDate.getDate()).padStart(2, "0");

        // Extraer horas, minutos y segundos, ajustando al formato de 12 horas
        let hours = localDate.getHours();
        const minutes = String(localDate.getMinutes()).padStart(2, "0");
        const seconds = String(localDate.getSeconds()).padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        hours = hours ? hours : 12; // Si la hora es '0', que sea '12'
        hours = String(hours).padStart(2, "0");

        // Formato de la fecha
        const formattedDate = `${year}-${month}-${day}`;

        // Formato de la hora
        const formattedTime = `${hours}:${minutes}:${seconds} ${ampm}`;

        // Retornar ambos valores por separado
        return { formattedDate, formattedTime };
    };

    // Ordenar la bitácora por fecha más reciente antes de mapearla
    const sortedBitacora = [...bitacora].sort((a, b) => new Date(b.fecha_creado_bit) - new Date(a.fecha_creado_bit));

    return (
        <div className={`modal fade bd-example-modal-lg ${showModal ? "show" : ""}`} tabIndex="-1" aria-labelledby="myLargeModalLabel" style={{ display: showModal ? "block" : "none" }} aria-modal="true" role="dialog" onClick={handleClose}>
            <div className="modal-dialog modal-lg" style={{ maxWidth: isMobile ? "98%" : "68%", margin: "4.99rem auto" }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-content">
                    <div className="modal-header">
                        <div className="d-inline-block">
                            <h4 onClick={handleCopy} style={{ cursor: "pointer" }}>
                                {leadData?.nombre_lead || "..."}{" "}
                                <i className="material-icons-two-tone" onClick={handleCopy} style={{ cursor: "pointer" }}>
                                    content_copy
                                </i>
                            </h4>
                            <p className="m-b-0">Proyecto: {leadData?.proyecto_lead}</p>
                            <p className="m-b-0">Campaña: {leadData?.campana_lead}</p>
                            <p className="m-b-0">Asesor: {leadData?.name_admin}</p>
                        </div>
                        <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={handleClose}></button>
                    </div>

                    <div className="modal-body">
                        <p style={{ textAlign: "center" }}>¿Qué deseas hacer con este lead?</p>

                        {/* Botones visibles en pantallas grandes */}
                        <div className="d-none d-lg-flex justify-content-center text-center flex-wrap gap-2">{renderButtons()}</div>

                        {/* Menú desplegable para pantallas pequeñas sin colores */}
                        <div className="d-lg-none d-flex justify-content-center">
                            <div className="btn-group" onClick={(e) => e.stopPropagation()}>
                                <button type="button" className="btn btn-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                                    Opciones de Lead
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end" onClick={(e) => e.stopPropagation()}>
                                    {renderButtons(true)}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card latest-activity-card">
                    <div className="card-header">
                        <h5>
                            {" "}
                            <i className="fas fa-drafting-compass"></i> Últimas Acciones Realizadas a este lead{" "}
                        </h5>
                    </div>
                    {showPreload ? (
                        <div className="preload-content" style={{ textAlign: "center", padding: "20px" }}>
                            <p>Cargando últimas acciones...</p>
                        </div>
                    ) : (
                        <div className="card-body">
                            {/* Recorremos los datos de la bitácora ya ordenados */}
                            {sortedBitacora.length > 0 ? (
                                sortedBitacora.map((entry, idx) => {
                                    const { formattedDate, formattedTime } = formatDate(entry.fecha_creado_bit);
                                    return (
                                        <div className="latest-update-box" key={idx}>
                                            <div className="row p-t-20 p-b-30">
                                                <div className="col-auto text-end update-meta">
                                                    {/* Mostramos la fecha y la hora formateadas por separado */}
                                                    <p className="text-muted m-b-0 d-inline-flex">{formattedTime}</p>
                                                    <div className="border border-2 border-success text-success update-icon">
                                                        <i className="ph-duotone ph-rocket"></i>
                                                    </div>
                                                </div>
                                                <div className="col">
                                                    <span className="badge bg-dark m-b-0" style={{ marginBottom: "10px" }}>
                                                        {" "}
                                                        {entry.estado_bit}
                                                    </span>

                                                    <p className="text-muted m-b-0">Accion: {entry.detalle_bit}</p>
                                                    <p className="text-muted m-b-0">Motivo: {entry.nombre_caida}</p>
                                                    <h6 className="mb-0 me-2"> {formattedDate} </h6>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p>No hay acciones recientes para este lead.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
