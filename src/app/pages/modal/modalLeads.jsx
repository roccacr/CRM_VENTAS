import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";

export const ModalLeads = ({ leadData, onClose }) => {
    const [showModal, setShowModal] = useState(false);
    const [isMobile, setIsMobile] = useState(window.matchMedia("(max-width: 768px)").matches);

    useEffect(() => {
        // Detect if the screen width changes and update isMobile state
        const mediaQuery = window.matchMedia("(max-width: 768px)");
        const handleMediaQueryChange = (e) => setIsMobile(e.matches);

        mediaQuery.addEventListener("change", handleMediaQueryChange);

        return () => {
            mediaQuery.removeEventListener("change", handleMediaQueryChange);
        };
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowModal(true);
        }, 100);
        return () => clearTimeout(timer);
    }, [leadData]);

    const handleClose = () => {
        setShowModal(false);
        setTimeout(() => {
            if (onClose) onClose();
        }, 100);
    };

    const handleCopy = () => {
        const leadName = leadData?.nombre_lead || "No cuenta con nombre de cliente";
        navigator.clipboard
            .writeText(leadName)
            .then(() => {
                Swal.fire({
                    position: "top-end",
                    icon: "success",
                    title: "Nombre copiado",
                    showConfirmButton: false,
                    width: "20em",
                    timer: 1500,
                    customClass: {
                        popup: "smaller-swal",
                    },
                });
            })
            .catch((err) => {
                console.error("Error al copiar al portapapeles: ", err);
            });
    };

    return (
        <div className={`modal fade bd-example-modal-lg ${showModal ? "show" : ""}`} tabIndex="-1" aria-labelledby="myLargeModalLabel" style={{ display: showModal ? "block" : "none" }} aria-modal="true" role="dialog" onClick={handleClose}>
            <div
                className="modal-dialog modal-lg"
                onClick={(e) => e.stopPropagation()}
                style={{ maxWidth: isMobile ? "98%" : "68%", margin: "2.75rem auto" }} // Adjusts maxWidth based on device
            >
                <div className="modal-content">
                    <div className="modal-header">
                        <div className="d-inline-block">
                            <h4 className="m-b-0" onClick={handleCopy} style={{ cursor: "pointer" }}>
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

                        {/* Botones visibles solo en pantallas grandes y centrados */}
                        <div className="d-none d-lg-flex justify-content-center text-center flex-wrap gap-2">
                            <button type="button" className="btn btn-shadow" style={{ backgroundColor: "#25d366", color: "#fff", borderColor: "#25d366" }}>
                                <i className="fab fa-whatsapp"></i> Ir a Whatsapp
                            </button>
                            <button type="button" className="btn btn-shadow" style={{ backgroundColor: "#25d366", color: "#fff", borderColor: "#25d366" }}>
                                <i className="fab fa-whatsapp"></i> Whatsapp y Contacto
                            </button>
                            <button type="button" className="btn btn-shadow" style={{ backgroundColor: "#c0392b", color: "#fff", borderColor: "#c0392b" }}>
                                <i className="fab fa-wpforms"></i> Nota de Contacto
                            </button>
                            <button type="button" className="btn btn-shadow btn-danger" style={{ backgroundColor: "#2c3e50", color: "#fff", borderColor: "#2c3e50" }}>
                                <i className="fas fa-calendar-check"></i> Crear un evento
                            </button>
                            <button type="button" className="btn btn-shadow btn-warning" style={{ backgroundColor: "#78281f", color: "#fff", borderColor: "#78281f" }}>
                                <i className="fas fa-window-close"></i> Dar como perdido
                            </button>
                        </div>
                        <br />
                        <div className="d-none d-lg-flex justify-content-center text-center flex-wrap gap-2">
                            <button type="button" className="btn btn-shadow btn-warning" style={{ backgroundColor: "#f1c40f", color: "#fff", borderColor: "#f1c40f" }}>
                                <i className="fas fa-location-arrow"></i> Colocar en seguimiento
                            </button>
                            <button type="button" className="btn btn-shadow btn-light" style={{ backgroundColor: "#af7ac5", color: "#fff", borderColor: "#af7ac5" }}>
                                <i className="fas fa-level-up-alt"></i> Crear Oportunidad
                            </button>
                            <button type="button" className="btn btn-shadow btn-dark" style={{ backgroundColor: "#2471a3", color: "#fff", borderColor: "#2471a3" }}>
                                <i className="fas fa-stream"></i> Lista Oportunidades
                            </button>
                            <button type="button" className="btn btn-shadow btn-link" style={{ backgroundColor: "#2e86c1", color: "#fff", borderColor: "#2e86c1" }}>
                                <i className="fas fa-phone"></i> Llamar cliente
                            </button>
                            <button type="button" className="btn btn-shadow btn-link" style={{ backgroundColor: "#7b7d7d", color: "#fff", borderColor: "#7b7d7d" }}>
                                <i className="fas fa-user-circle"></i> Ver Perfil
                            </button>
                        </div>

                        {/* Menú desplegable para pantallas pequeñas */}
                        <div className="d-lg-none d-flex justify-content-center">
                            {" "}
                            {/* Centro el dropdown en pantallas pequeñas */}
                            <div className="btn-group">
                                <button type="button" className="btn btn-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                                    Opciones de Lead
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end">
                                    <li>
                                        <button className="dropdown-item" type="button" style={{ backgroundColor: "#25d366", color: "#fff", borderColor: "#25d366" }}>
                                            <i className="fab fa-whatsapp"></i> Ir a Whatsapp
                                        </button>
                                    </li>
                                    <li>
                                        <button className="dropdown-item" type="button" style={{ backgroundColor: "#25d366", color: "#fff", borderColor: "#25d366" }}>
                                            <i className="fab fa-whatsapp"></i> Whatsapp y Contacto
                                        </button>
                                    </li>
                                    <li>
                                        <button className="dropdown-item" type="button" style={{ backgroundColor: "#c0392b", color: "#fff", borderColor: "#c0392b" }}>
                                            <i className="fab fa-wpforms"></i> Nota de Contacto
                                        </button>
                                    </li>
                                    <li>
                                        <button className="dropdown-item" type="button" style={{ backgroundColor: "#2c3e50", color: "#fff", borderColor: "#2c3e50" }}>
                                            <i className="fas fa-calendar-check"></i> Crear un evento
                                        </button>
                                    </li>
                                    <li>
                                        <button className="dropdown-item" type="button" style={{ backgroundColor: "#78281f", color: "#fff", borderColor: "#78281f" }}>
                                            <i className="fas fa-window-close"></i> Dar como perdido
                                        </button>
                                    </li>
                                    <li>
                                        <button className="dropdown-item" type="button" style={{ backgroundColor: "#f1c40f", color: "#fff", borderColor: "#f1c40f" }}>
                                            <i className="fas fa-location-arrow"></i> Colocar en seguimiento
                                        </button>
                                    </li>
                                    <li>
                                        <button className="dropdown-item" type="button" style={{ backgroundColor: "#af7ac5", color: "#fff", borderColor: "#af7ac5" }}>
                                            <i className="fas fa-level-up-alt"></i> Crear Oportunidad
                                        </button>
                                    </li>
                                    <li>
                                        <button className="dropdown-item" type="button" style={{ backgroundColor: "#2471a3", color: "#fff", borderColor: "#2471a3" }}>
                                            <i className="fas fa-stream"></i> Lista Oportunidades
                                        </button>
                                    </li>
                                    <li>
                                        <button className="dropdown-item" type="button" style={{ backgroundColor: "#2e86c1", color: "#fff", borderColor: "#2e86c1" }}>
                                            <i className="fas fa-phone"></i> Llamar cliente
                                        </button>
                                    </li>
                                    <li>
                                        <button className="dropdown-item" type="button" style={{ backgroundColor: "#7b7d7d", color: "#fff", borderColor: "#7b7d7d" }}>
                                            <i className="fas fa-user-circle"></i> Ver Perfil
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
