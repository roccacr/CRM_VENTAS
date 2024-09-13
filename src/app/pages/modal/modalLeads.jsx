import React, { useState, useEffect } from "react";

export const ModalLeads = ({ leadData, onClose }) => {
    const [showModal, setShowModal] = useState(false);
    const [isMobile, setIsMobile] = useState(window.matchMedia("(max-width: 768px)").matches);

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

    return (
        <div className={`modal fade bd-example-modal-lg ${showModal ? "show" : ""}`} tabIndex="-1" aria-labelledby="myLargeModalLabel" style={{ display: showModal ? "block" : "none" }} aria-modal="true" role="dialog" onClick={handleClose}>
            <div className="modal-dialog modal-lg" style={{ maxWidth: isMobile ? "98%" : "68%", margin: "2.75rem auto" }} onClick={(e) => e.stopPropagation()}>
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

                {/* Acciones recientes */}
                <div className="card latest-activity-card">
                    <div className="card-header">
                        <h5>
                            {" "}
                            <i className="fas fa-drafting-compass"></i> Últimas Acciones Realizadas a este lead{" "}
                        </h5>
                    </div>
                    <div className="card-body">
                        <div className="latest-update-box">
                            <div className="row p-t-20 p-b-30">
                                <div className="col-auto text-end update-meta">
                                    <p className="text-muted m-b-0 d-inline-flex">08:00 AM</p>
                                    <div className="border border-2 border-success text-success update-icon">
                                        <i className="ph-duotone ph-rocket"></i>
                                    </div>
                                </div>
                                <div className="col">
                                    <a href="#!" className="d-inline-flex align-items-center">
                                        <h6 className="mb-0 me-2">Create report</h6>
                                        <span className="badge bg-success">Done</span>
                                    </a>
                                    <p className="text-muted m-b-0">The trip was an amazing and a life changing experience!!</p>
                                </div>
                            </div>
                            <div className="row p-b-30">
                                <div className="col-auto text-end update-meta">
                                    <p className="text-muted m-b-0 d-inline-flex">08:20 AM</p>
                                    <div className="border border-2 border-primary text-primary update-icon">
                                        <i className="ph-duotone ph-rocket"></i>
                                    </div>
                                </div>
                                <div className="col">
                                    <a href="#!" className="d-inline-flex align-items-center">
                                        <h6 className="mb-0 me-2">Create report</h6>
                                        <span className="badge bg-primary">Running</span>
                                    </a>
                                    <p className="text-muted m-b-0">Free courses for all our customers at A1 Conference Room - 9:00 am tomorrow!</p>
                                </div>
                            </div>
                            <div className="row p-b-30">
                                <div className="col-auto text-end update-meta">
                                    <p className="text-muted m-b-0 d-inline-flex">08:20 AM</p>
                                    <div className="border border-2 border-warning text-warning update-icon">
                                        <i className="ph-duotone ph-hand-palm"></i>
                                    </div>
                                </div>
                                <div className="col">
                                    <a href="#!" className="d-inline-flex align-items-center">
                                        <h6 className="mb-0 me-2">Create report</h6>
                                        <span className="badge bg-warning">Pending</span>
                                    </a>
                                    <p className="text-muted m-b-0">Free courses for all our customers at A1 Conference Room - 9:00 am tomorrow!</p>
                                </div>
                            </div>
                            <div className="row p-b-30">
                                <div className="col-auto text-end update-meta">
                                    <p className="text-muted m-b-0 d-inline-flex">08:20 AM</p>
                                    <div className="border border-2 border-warning text-warning update-icon">
                                        <i className="ph-duotone ph-hand-palm"></i>
                                    </div>
                                </div>
                                <div className="col">
                                    <a href="#!" className="d-inline-flex align-items-center">
                                        <h6 className="mb-0 me-2">Create report</h6>
                                        <span className="badge bg-warning">Pending</span>
                                    </a>
                                    <p className="text-muted m-b-0">Free courses for all our customers at A1 Conference Room - 9:00 am tomorrow!</p>
                                </div>
                            </div>

                            <div className="row">
                                <div className="col-auto text-end update-meta">
                                    <p className="text-muted m-b-0 d-inline-flex">09:15 AM</p>
                                    <div className="border border-2 border-danger text-danger update-icon">N</div>
                                </div>
                                <div className="col">
                                    <a href="#!" className="d-inline-flex align-items-center">
                                        <h6 className="mb-0 me-2">Create report</h6>
                                        <span className="badge bg-danger">Not Start</span>
                                    </a>
                                    <p className="text-muted m-b-0">
                                        Happy Hour! Free drinks at{" "}
                                        <span>
                                            {" "}
                                            <a href="#!" className="text-primary">
                                                Cafe-Bar all{" "}
                                            </a>{" "}
                                        </span>
                                        day long!
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
