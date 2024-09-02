import React, { useState, useEffect } from "react";

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

    return (
        <div className={`modal fade bd-example-modal-lg ${showModal ? "show" : ""}`} tabIndex="-1" aria-labelledby="myLargeModalLabel" style={{ display: showModal ? "block" : "none" }} aria-modal="true" role="dialog" onClick={handleClose}>
            <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
                <div className="modal-content">
                    <div className="modal-header">
                        <h5 className="modal-title h4" id="myLargeModalLabel">
                            {leadData?.name || "Detalle del Lead"}
                        </h5>
                        <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={handleClose}></button>
                    </div>
                    <div className="modal-body">
                        {/* Aquí iría el contenido del modal, por ejemplo, los detalles de leadData */}
                        <p>{leadData?.details || "No hay detalles disponibles"}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
