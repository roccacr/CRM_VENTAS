import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";

export const ModalLeads = ({ leadData, onClose }) => {
    const [showModal, setShowModal] = useState(false);

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
            <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "65%", margin: "2.75rem auto" }}>
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
                        {/* Hacemos uso de clases de Bootstrap para mejorar el responsive */}
                        <div className="d-flex flex-wrap gap-2 justify-content-center">
                            <button type="button" className="btn btn-shadow w-100 w-md-auto" style={{ backgroundColor: "#25d366", color: "#fff", borderColor: "#25d366" }}>
                                <i className="fab fa-whatsapp"></i> Ir a Whatsapp
                            </button>
                            <button type="button" className="btn btn-shadow w-100 w-md-auto" style={{ backgroundColor: "#25d366", color: "#fff", borderColor: "#25d366" }}>
                                <i className="fab fa-whatsapp"></i> Whatsapp y Contacto
                            </button>
                            <button type="button" className="btn btn-shadow w-100 w-md-auto" style={{ backgroundColor: "#c0392b", color: "#fff", borderColor: "#c0392b" }}>
                                <i className="fab fa-wpforms"></i> Nota de Contacto
                            </button>
                            <button type="button" className="btn btn-shadow w-100 w-md-auto" style={{ backgroundColor: "#2c3e50", color: "#fff", borderColor: "#2c3e50" }}>
                                <i className="fas fa-calendar-check"></i> Crear un evento
                            </button>
                            <button type="button" className="btn btn-shadow w-100 w-md-auto" style={{ backgroundColor: "#78281f", color: "#fff", borderColor: "#78281f" }}>
                                <i className="fas fa-window-close"></i> Dar como perdido
                            </button>
                            <button type="button" className="btn btn-shadow w-100 w-md-auto btn-info">
                                Info
                            </button>
                            <button type="button" className="btn btn-shadow w-100 w-md-auto btn-light">
                                Light
                            </button>
                            <button type="button" className="btn btn-shadow w-100 w-md-auto btn-dark">
                                Dark
                            </button>
                            <button type="button" className="btn btn-shadow w-100 w-md-auto btn-link">
                                Link
                            </button>

                            <div className="btn-group">
                                <button type="button" className="btn btn-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                                    Right-aligned menu example
                                </button>
                                <ul className="dropdown-menu dropdown-menu-end" style="">
                                    <li>
                                        <button className="dropdown-item" type="button">
                                            Action
                                        </button>
                                    </li>
                                    <li>
                                        <button className="dropdown-item" type="button">
                                            Another action
                                        </button>
                                    </li>
                                    <li>
                                        <button className="dropdown-item" type="button">
                                            Something else here
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
