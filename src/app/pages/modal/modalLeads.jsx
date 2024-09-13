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
            <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
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
                        {/* Aquí iría el contenido del modal, por ejemplo, los detalles de leadData */}
                        <p>{leadData?.email_lead || "No cuenta con correo electronico"}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
