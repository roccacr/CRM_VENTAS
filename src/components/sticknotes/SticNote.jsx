import React from "react";
import "./SticNote.css";

/**
 * Componente individual de Sticky Note
 * Representa una nota individual con opciones de editar, ocultar y cambiar estado
 *
 * @param {Object} props - Props del componente
 * @param {Object} props.note - Datos de la nota
 * @param {Function} props.onMouseDown - Callback para inicio de arrastre
 * @param {Function} props.onEdit - Callback para editar nota
 * @param {Function} props.onToggleVisibility - Callback para cambiar visibilidad
 * @param {Function} props.onToggleState - Callback para cambiar estado
 * @param {boolean} props.showingHidden - Si estamos mostrando notas ocultas
 */
const SticNote = ({
    note,
    onMouseDown,
    onEdit,
    onToggleVisibility,
    onToggleState,
    showingHidden,
}) => {
    // No mostrar notas inactivas (siempre)
    if (note.estado === 0) {
        return null;
    }

    // No mostrar notas ocultas a menos que estemos en modo mostrar ocultas
    if (note.visible === 0 && !showingHidden) {
        return null;
    }

    const noteStyle = {
        backgroundColor: note.color_hex || "#FFFF88",
        left: `${note.pos_x}px`,
        top: `${note.pos_y}px`,
    };

    return (
        <div
            className="sticknote"
            style={noteStyle}
            onMouseDown={(e) => onMouseDown(e, note.id_sticknote)}
        >
            {/* Encabezado de la nota */}
            <div className="sticknote-header">
                <h4 className="sticknote-title">
                    {note.titulo || "Sin título"}
                </h4>
                <div className="sticknote-header-actions">
                    {/* Botón para editar */}
                    <button
                        className="sticknote-btn sticknote-btn-edit"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(note);
                        }}
                        title="Editar nota"
                    >
                        ✎
                    </button>

                    {/* Botón para ocultar o reactivar según el estado */}
                    {showingHidden && note.visible === 0 ? (
                        <button
                            className="sticknote-btn sticknote-btn-reactivate"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleVisibility(
                                    note.id_sticknote,
                                    note.visible
                                );
                            }}
                            title="Reactivar nota"
                        >
                            ↩️
                        </button>
                    ) : (
                        <button
                            className="sticknote-btn sticknote-btn-hide"
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleVisibility(
                                    note.id_sticknote,
                                    note.visible
                                );
                            }}
                            title="Ocultar nota"
                        >
                            👁
                        </button>
                    )}

                    {/* Botón para cambiar estado */}
                    <button
                        className="sticknote-btn sticknote-btn-state"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleState(note.id_sticknote, note.estado);
                        }}
                        title="Desactivar nota"
                    >
                        ✓
                    </button>
                </div>
            </div>

            {/* Contenido de la nota */}
            <div className="sticknote-content">
                <p>{note.mensaje}</p>
            </div>

            {/* Pie de página con información de creación */}
            <div className="sticknote-footer">
                <small>
                    {new Date(note.creado_en).toLocaleDateString()}
                </small>
            </div>
        </div>
    );
};

export default SticNote;
