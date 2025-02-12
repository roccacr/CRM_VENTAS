import React from "react";

/**
 * Componente que renderiza el encabezado de un modal con información del lead
 * @param {Object} props - Propiedades del componente
 * @param {Object} props.leadData - Datos del lead
 * @param {string} props.leadData.nombre_lead - Nombre del lead
 * @param {string} props.leadData.telefono_lead - Teléfono del lead
 * @param {string} props.leadData.proyecto_lead - Proyecto asociado al lead
 * @param {string} props.leadData.campana_lead - Campaña asociada al lead
 * @param {string} props.leadData.name_admin - Nombre del asesor asignado
 * @param {Function} props.handleClose - Función para cerrar el modal
 * @param {Function} props.handleCopy - Función para copiar el nombre del lead
 * @param {Function} props.handleCopyPhone - Función para copiar el teléfono del lead
 * @returns {JSX.Element} Encabezado del modal
 */
export const ModalHeader = ({ leadData, handleClose, handleCopy, handleCopyPhone }) => (
    <div className="modal-header">
        {/* Contenedor de información del lead */}
        <div className="d-inline-block">
            {/* Nombre del lead con botón de copiar */}
            <h4 onClick={handleCopy} style={{ cursor: "pointer" }}>
                {leadData?.nombre_lead || "..."}{" "}
                <i className="material-icons-two-tone" onClick={handleCopy} style={{ cursor: "pointer" }}>
                    content_copy
                </i>
            </h4>
            {/* Teléfono del lead con botón de copiar */}
            <h5 onClick={handleCopyPhone} style={{ cursor: "pointer" }}>
                Telefono: {leadData?.telefono_lead || "..."}{" "}
                <i className="material-icons-two-tone" onClick={handleCopyPhone} style={{ cursor: "pointer" }}>
                    content_copy
                </i>
            </h5>
            {/* Información adicional del lead */}
            <p className="m-b-0">Proyecto: {leadData?.proyecto_lead}</p>
            <p className="m-b-0">Campaña: {leadData?.campana_lead}</p>
            <p className="m-b-0">Asesor: {leadData?.name_admin}</p>
        </div>
        {/* Botón para cerrar el modal */}
        <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={handleClose}></button>
    </div>
);
