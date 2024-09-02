import React, { useState, useEffect } from "react";

export const ModalLeads = ({ leadData, onClose }) => {
    const [showModal, setShowModal] = useState(false);

    useEffect(() => {
        setShowModal(true); // Mostrar el modal cuando los datos de leadData estén disponibles
    }, [leadData]);

    const handleClose = () => {
        setShowModal(false);
        if (onClose) onClose(); // Ejecutar la función de cierre si se proporciona
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
