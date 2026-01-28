import React from "react";
import "./SticNote.css";

/**
 * Componente individual de Sticky Note
 * Representa una nota individual con opciones de editar, fijar y cambiar estado
 *
 * @param {Object} props - Props del componente
 * @param {Object} props.note - Datos de la nota
 * @param {Function} props.onMouseDown - Callback para inicio de arrastre
 * @param {Function} props.onEdit - Callback para editar nota
 * @param {Function} props.onTogglePin - Callback para alternar PIN
 * @param {Function} props.onToggleState - Callback para cambiar estado
 * @param {Function} props.onDelete - Callback para eliminar nota
 * @param {boolean} props.showingHidden - Si estamos mostrando notas ocultas
 * @param {Object} props.adminsMap - Mapeo de idnetsuite_admin a nombre de admin
 * @param {number} props.currentUserId - ID del usuario autenticado actual
 */
const SticNote = ({
    note,
    onMouseDown,
    onEdit,
    onTogglePin,
    onToggleState,
    onDelete,
    showingHidden,
    adminsMap,
    currentUserId,
}) => {
    // No mostrar notas desactivadas a menos que estemos en modo mostrar archivadas
    if (note.estado === 0 && !showingHidden) {
        return null;
    }

    // Validar si el usuario actual es el creador de la nota
    const isOwner = currentUserId === note.id_usuario_creador;

    // Parsear usuarios asignados (puede ser string separado por coma o array)
    const parseUsuariosAsignados = () => {
        if (!note.id_usuario_asignado) return [];
        
        let idsArray = [];
        if (Array.isArray(note.id_usuario_asignado)) {
            idsArray = note.id_usuario_asignado;
        } else if (typeof note.id_usuario_asignado === 'string') {
            idsArray = note.id_usuario_asignado.split(',').map(id => id.trim()).filter(id => id);
        } else {
            idsArray = [String(note.id_usuario_asignado)];
        }

        // Parsear emails asignados
        let emailsArray = [];
        if (note.email_usuario_asignado) {
            if (Array.isArray(note.email_usuario_asignado)) {
                emailsArray = note.email_usuario_asignado;
            } else if (typeof note.email_usuario_asignado === 'string') {
                emailsArray = note.email_usuario_asignado.split(',').map(email => email.trim()).filter(email => email);
            }
        }

        // Crear array de objetos con id, nombre y email
        return idsArray.map((id, index) => ({
            id: id.trim(),
            nombre: adminsMap && adminsMap[id.trim()] ? adminsMap[id.trim()] : `Usuario ${id}`,
            email: emailsArray[index] || null,
        }));
    };

    const usuariosAsignados = parseUsuariosAsignados();

    const noteStyle = {
        backgroundColor: note.color_hex || "#FFF9C4",
        left: `${note.pos_x}px`,
        top: `${note.pos_y}px`,
        position: note.pin ? "fixed" : "absolute",
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
                    {/* Botón para editar - Solo visible si soy el dueño */}
                    {isOwner && (
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
                    )}

                    {/* Botón para eliminar - Solo visible si soy el dueño */}
                    {isOwner && (
                        <button
                            className="sticknote-btn sticknote-btn-delete"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(note.id_sticknote);
                            }}
                            title="Eliminar nota"
                        >
                            🗑️
                        </button>
                    )}

                    {/* Botón para fijar/desfijar (PIN) */}
                    <button
                        className={`sticknote-btn sticknote-btn-pin ${note.pin ? 'pinned' : ''}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            onTogglePin(note.id_sticknote, note.pin);
                        }}
                        title={note.pin ? "Desfijar nota" : "Fijar nota en la parte superior"}
                    >
                        {note.pin ? "📌" : "📍"}
                    </button>

                    {/* Botón para cambiar estado - Desactivar o Reactivar */}
                    <button
                        className="sticknote-btn sticknote-btn-state"
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleState(note.id_sticknote, note.estado);
                        }}
                        title={note.estado === 1 ? "Desactivar nota" : "Reactivar nota"}
                    >
                        {note.estado === 1 ? "✓" : "↩️"}
                    </button>
                </div>
            </div>

            {/* Contenido de la nota */}
            <div className="sticknote-content">
                <p>{note.mensaje}</p>
            </div>

            {/* Pie de página con información de creación y asignación */}
            <div className="sticknote-footer">
                <small>
                    <div className="sticknote-creator">
                        👤 {note.nombre_duenio || (adminsMap ? adminsMap[note.id_usuario_creador] : "Desconocido")}
                        {note.correo_duenio && (
                            <div className="sticknote-email">
                                ✉️ {note.correo_duenio}
                            </div>
                        )}
                    </div>
                    {usuariosAsignados.length > 0 && (
                        <div className="sticknote-assigned">
                            <div className="sticknote-assigned-label">📌 Asignado a:</div>
                            {usuariosAsignados.map((usuario, index) => (
                                <div key={index} className="sticknote-assigned-user">
                                    <span className="sticknote-assigned-name">👤 {usuario.nombre}</span>
                                    {usuario.email && (
                                        <div className="sticknote-email">
                                            ✉️ {usuario.email}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="sticknote-date">
                        {new Date(note.creado_en).toLocaleDateString()}
                    </div>
                </small>
            </div>
        </div>
    );
};

export default SticNote;
