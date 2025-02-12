import React from "react";
import { ModalHeader } from "./components/ModalHeader";
import { ActionButtons } from "./components/ActionButtons";
import { RecentActions } from "./components/RecentActions";
import { BUTTON_DATA } from "./constants";
import { useModalLeads } from "../../../hooks/useModalLeads";
import { useLeadActions } from "../../../hooks/useLeadActions";

/**
 * Componente `ModalLeads`
 *
 * Este componente es un modal que muestra información detallada de un lead y permite realizar múltiples acciones
 * relacionadas con él. Es interactivo y responsivo, con funcionalidades como copiar información, manejar acciones
 * personalizadas y mostrar las últimas actividades del lead.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {Object} props.leadData - Información del lead que se muestra en el modal.
 * @param {Function} props.onClose - Función que se llama para cerrar el modal.
 *
 * @returns {JSX.Element} El componente modal renderizado.
 */
export const ModalLeads = ({ leadData, onClose }) => {
    // Custom hooks para manejar el estado y las acciones del modal
    const { showModal, isMobile, showPreload, bitacora, setShowModal } = useModalLeads(leadData);
    const { handleWhatsappClick, handleNote, handleEvents, handleWhatsappAndNote, handleLoss, handfollow_up, crearOportunidad, handleOpportunityList, handleCallClient, PerfilUsuario, handleBck, handedit } = useLeadActions();

    /**
     * Cierra el modal con un pequeño retraso para permitir animaciones.
     */
    const handleClose = () => {
        setShowModal(false);
        setTimeout(() => onClose && onClose(), 100);
    };

    /**
     * Copia el nombre del lead al portapapeles.
     */
    const handleCopy = () => {
        const leadName = leadData?.nombre_lead || "No cuenta con nombre de cliente";
        navigator.clipboard.writeText(leadName);
    };

    /**
     * Copia el teléfono del lead al portapapeles.
     */
    const handleCopyPhone = () => {
        const leadPhone = leadData?.telefono_lead || "No cuenta con teléfono";
        navigator.clipboard.writeText(leadPhone);
    };

    /**
     * Formatea una fecha y hora en formato local con AM/PM.
     *
     * @param {string} dateString - Fecha en formato ISO.
     * @returns {Object} Objeto con la fecha y hora formateadas.
     */
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const localDate = new Date(date.getTime() - 6 * 60 * 60 * 1000); // Ajuste de zona horaria
        const year = localDate.getFullYear();
        const month = String(localDate.getMonth() + 1).padStart(2, "0");
        const day = String(localDate.getDate()).padStart(2, "0");
        let hours = localDate.getHours();
        const minutes = String(localDate.getMinutes()).padStart(2, "0");
        const seconds = String(localDate.getSeconds()).padStart(2, "0");
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12 || 12;
        hours = String(hours).padStart(2, "0");

        return {
            formattedDate: `${year}-${month}-${day}`,
            formattedTime: `${hours}:${minutes}:${seconds} ${ampm}`,
        };
    };

    // Ordena la bitácora por fecha (más reciente primero).
    const sortedBitacora = [...bitacora].sort((a, b) => new Date(b.fecha_creado_bit) - new Date(a.fecha_creado_bit));

    /**
     * Renderiza los botones de acción.
     *
     * @param {boolean} forDropdown - Indica si los botones son para un menú desplegable.
     * @returns {JSX.Element[]} Arreglo de botones renderizados.
     */
    const renderButtons = (forDropdown = false) =>
        BUTTON_DATA.map((btn, idx) => {
            // Mapeo de acciones a funciones
            const actionMap = {
                handleWhatsappClick: () => handleWhatsappClick(leadData?.telefono_lead),
                handleNote: () => handleNote(leadData),
                handleEvents: () => handleEvents(leadData),
                handleWhatsappAndNote: () => handleWhatsappAndNote(leadData),
                handleLoss: () => handleLoss(leadData),
                handfollow_up: () => handfollow_up(leadData),
                crearOportunidad: () => crearOportunidad(leadData),
                handleOpportunityList: () => handleOpportunityList(leadData),
                handleCallClient: () => handleCallClient(leadData?.telefono_lead),
                PerfilUsuario: () => PerfilUsuario(leadData),
                handleBck: () => handleBck(),
                handedit: () => handedit(leadData)
            };

            return (
                <li
                    key={idx}
                    className={forDropdown ? "dropdown-item" : "btn btn-shadow"}
                    style={
                        !forDropdown
                            ? { backgroundColor: btn.color, color: "#fff", borderColor: btn.color, marginBottom: "0px" }
                            : { marginBottom: "5px" }
                    }
                    onClick={() => {
                        const action = actionMap[btn.action];
                        if (action) {
                            action();
                        }
                    }}
                >
                    <i className={btn.icon}></i> {btn.text}
                </li>
            );
        });

    return (
        <div
            className={`modal fade bd-example-modal-lg ${showModal ? "show" : ""}`}
            tabIndex="-1"
            aria-labelledby="myLargeModalLabel"
            style={{ display: showModal ? "block" : "none" }}
            aria-modal="true"
            role="dialog"
            onClick={handleClose}
        >
            <div
                className="modal-dialog modal-lg"
                style={{ maxWidth: isMobile ? "98%" : "68%", margin: "4.99rem auto" }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-content">
                    {/* Cabecera del modal */}
                    <ModalHeader leadData={leadData} handleClose={handleClose} handleCopy={handleCopy} handleCopyPhone={handleCopyPhone} />
                    {/* Botones de acción */}
                    <div className="modal-body">
                        <ActionButtons buttonData={BUTTON_DATA} renderButtons={renderButtons} />
                    </div>
                </div>
                {/* Acciones recientes */}
                <RecentActions showPreload={showPreload} sortedBitacora={sortedBitacora} formatDate={formatDate} />
            </div>
        </div>
    );
};
