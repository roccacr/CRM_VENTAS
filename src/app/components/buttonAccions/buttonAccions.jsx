import React, { useState } from "react";
import { ModalLeads } from "../../pages/modal/modalLeads";


export const ButtonActions = ({ leadData }) => {
    const [isModalOpen, setIsModalOpen] = useState(false); // Estado para controlar la visibilidad del modal

    // Maneja el clic en el botón para abrir el modal.
    const handleOpenModal = () => {
        setIsModalOpen(true); // Mostrar el modal
    };

    // Cierra el modal.
    const handleCloseModal = () => {
        setIsModalOpen(false);
    };

    return (
        <>
            <button className="btn btn-dark" onClick={handleOpenModal}>
                Realizar Nueva Acción al Cliente
            </button>

            {/* Mostrar el modal solo si está abierto */}
            {isModalOpen && leadData && <ModalLeads leadData={leadData} onClose={handleCloseModal} />}
        </>
    );
};
