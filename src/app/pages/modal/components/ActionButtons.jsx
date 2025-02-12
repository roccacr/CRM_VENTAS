import React from "react";

/**
 * Componente `ActionButtons`
 *
 * Este componente muestra una serie de botones de acción para interactuar con un lead, permitiendo al usuario
 * realizar diversas acciones. Los botones se renderizan de forma diferente según el tamaño de pantalla (diseño
 * responsivo). En pantallas grandes, los botones se muestran alineados; en pantallas pequeñas, los botones
 * están agrupados en un menú desplegable.
 *
 * @param {Object} props - Propiedades del componente.
 * @param {Array} props.buttonData - Datos relacionados con los botones de acción. Estos datos deben contener
 * información sobre las acciones posibles para el lead (este prop no se utiliza directamente en este componente).
 * @param {Function} props.renderButtons - Función que genera los botones o elementos interactivos. Recibe un
 * parámetro booleano para diferenciar entre las versiones de escritorio y móvil.
 *
 * @returns {JSX.Element} Componente renderizado.
 */
export const ActionButtons = ({ buttonData, renderButtons }) => (
    <div>
        {/* Título descriptivo para indicar al usuario las acciones disponibles */}
        <p style={{ textAlign: "center" }}>¿Qué deseas hacer con este lead?</p>

        {/* Versión para pantallas grandes: los botones se muestran alineados */}
        <div className="d-none d-lg-flex justify-content-center text-center flex-wrap gap-2">{renderButtons()}</div>

        {/* Versión para pantallas pequeñas: los botones se agrupan en un menú desplegable */}
        <div className="d-lg-none d-flex justify-content-center">
            <div className="btn-group" onClick={(e) => e.stopPropagation()}>
                {/* Botón para desplegar las opciones */}
                <button type="button" className="btn btn-secondary dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                    Opciones de Lead
                </button>

                {/* Menú desplegable con las opciones */}
                <ul className="dropdown-menu dropdown-menu-end" onClick={(e) => e.stopPropagation()}>
                    {renderButtons(true)}
                </ul>
            </div>
        </div>
    </div>
);
