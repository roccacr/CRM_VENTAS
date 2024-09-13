import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";

export const ModalLeads = ({ leadData, onClose }) => {
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        // Usar setTimeout para evitar el retraso en el renderizado inicial
        const timer = setTimeout(() => {
            setShowModal(true);
        }, 100); // Solo 10ms para permitir que se monte y luego mostrarlo rápidamente
        return () => clearTimeout(timer);
    }, [leadData]);

    const handleClose = () => {
        setShowModal(false);
        setTimeout(() => {
            if (onClose) onClose(); // Ejecutar la función de cierre si se proporciona
        }, 100); // Dar tiempo para la animación de cierre
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
                        popup: "smaller-swal", // Añadir clase personalizada
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
                        <div className="d-flex flex-wrap gap-2">
                            <button type="button" className="btn btn-shadow" style={{ backgroundColor: "#25d366", color: "#fff", borderColor: "#25d366" }}>
                                <i className="fab fa-whatsapp"></i> Ir a Whatsapp
                            </button>
                            <button type="button" className="btn btn-shadow" style={{ backgroundColor: "#25d366", color: "#fff", borderColor: "#25d366" }}>
                                <i className="fab fa-whatsapp"></i> Whatsapp y Contacto
                            </button>
                            <button type="button" className="btn btn-shadow" style={{ backgroundColor: "#c0392b", color: "#fff", borderColor: "#c0392b" }}>
                                <i className="fab fa-wpforms"></i> Nota de Contacto
                            </button>
                            <button type="button" className="btn btn-shadow btn-danger" style={{ backgroundColor: "#2c3e50 ", color: "#fff", borderColor: "#2c3e50" }}>
                                <i className="fas fa-calendar-check"></i> Crear un evento
                            </button>
                            <button type="button" className="btn btn-shadow btn-warning" style={{ backgroundColor: "#78281f ", color: "#fff", borderColor: "#78281f" }}>
                                <i className="fas fa-window-close"></i> Dar como perdido
                            </button>
                            <button type="button" className="btn btn-shadow btn-info">
                                Info
                            </button>
                            <button type="button" className="btn btn-shadow btn-light">
                                Light
                            </button>
                            <button type="button" className="btn btn-shadow btn-dark">
                                Dark
                            </button>
                            <button type="button" className="btn btn-shadow btn-link">
                                Link
                            </button>
                        </div>
                        {/* Aquí iría el contenido del modal, por ejemplo, los detalles de leadData */}
                    </div>
                </div>
            </div>
        </div>
    );
};
