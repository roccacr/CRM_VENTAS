import React from "react";

/**
 * Componente `RecentActions`
 *
 * Este componente muestra las últimas acciones realizadas sobre un lead. Ofrece un diseño claro y organizado que
 * incluye un estado de carga y una lista de acciones recientes, formateadas para mayor legibilidad.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {boolean} props.showPreload - Indica si debe mostrarse el estado de carga mientras se obtienen las acciones.
 * @param {Array} props.sortedBitacora - Lista ordenada de acciones realizadas sobre el lead. Cada acción debe tener
 * las propiedades `fecha_creado_bit`, `estado_bit`, `detalle_bit`, y `nombre_caida`.
 * @param {Function} props.formatDate - Función para formatear la fecha y hora de cada acción. Debe recibir una
 * fecha y devolver un objeto con `formattedDate` y `formattedTime`.
 *
 * @returns {JSX.Element} Componente renderizado.
 */
export const RecentActions = ({ showPreload, sortedBitacora, formatDate }) => (
    <div className="card latest-activity-card">
        {/* Cabecera de la tarjeta con el título */}
        <div className="card-header">
            <h5>
                <i className="fas fa-drafting-compass"></i> Últimas Acciones Realizadas a este lead
            </h5>
        </div>

        {/* Estado de carga: muestra un mensaje mientras se obtienen las acciones */}
        {showPreload ? (
            <div className="preload-content" style={{ textAlign: "center", padding: "20px" }}>
                <p>Cargando últimas acciones...</p>
            </div>
        ) : (
            <div className="card-body">
                {/* Si hay acciones recientes, se mapean y renderizan */}
                {sortedBitacora.length > 0 ? (
                    sortedBitacora.map((entry, idx) => {
                        const { formattedDate, formattedTime } = formatDate(entry.fecha_creado_bit);
                        return (
                            <div className="latest-update-box" key={idx}>
                                {/* Contenedor de cada acción con diseño responsivo */}
                                <div className="row p-t-20 p-b-30">
                                    {/* Meta-información de la acción */}
                                    <div className="col-auto text-end update-meta">
                                        <p className="text-muted m-b-0 d-inline-flex">{formattedTime}</p>
                                        <div className="border border-2 border-success text-success update-icon">
                                            <i className="ph-duotone ph-rocket"></i>
                                        </div>
                                    </div>

                                    {/* Detalles de la acción */}
                                    <div className="col">
                                        <span className="badge bg-dark m-b-0" style={{ marginBottom: "10px" }}>
                                            {entry.estado_bit}
                                        </span>
                                        <p className="text-muted m-b-0">Acción: {entry.detalle_bit}</p>
                                        <p className="text-muted m-b-0">Motivo: {entry.nombre_caida}</p>
                                        <h6 className="mb-0 me-2">{formattedDate}</h6>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    /* Mensaje mostrado cuando no hay acciones recientes */
                    <p>No hay acciones recientes para este lead.</p>
                )}
            </div>
        )}
    </div>
);
