import React, { useState, useEffect } from "react";
import "./ModalSticNote.css";

/**
 * Modal para crear o editar sticky notes
 *
 * @param {Object} props - Props del componente
 * @param {Object} props.note - Nota a editar (null si es crear nueva)
 * @param {Function} props.onSave - Callback para guardar la nota
 * @param {Function} props.onClose - Callback para cerrar el modal
 */
const ModalSticNote = ({ note, onSave, onClose }) => {
    const [titulo, setTitulo] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [colorHex, setColorHex] = useState("#FFFF88");

    // Colores preestablecidos disponibles
    const colorPresets = [
        "#FFFF88", // Amarillo (default)
        "#FFB3B3", // Rojo claro
        "#B3E5FC", // Azul claro
        "#C8E6C9", // Verde claro
        "#FFE0B2", // Naranja claro
        "#F8BBD0", // Rosa claro
        "#D1C4E9", // Púrpura claro
    ];

    // Llenar el formulario si está editando
    useEffect(() => {
        if (note) {
            setTitulo(note.titulo || "");
            setMensaje(note.mensaje || "");
            setColorHex(note.color_hex || "#FFFF88");
        } else {
            setTitulo("");
            setMensaje("");
            setColorHex("#FFFF88");
        }
    }, [note]);

    /**
     * Maneja el envío del formulario
     */
    const handleSubmit = (e) => {
        e.preventDefault();

        // Validar campos requeridos
        if (!mensaje.trim()) {
            alert("El mensaje es obligatorio");
            return;
        }

        onSave({
            titulo: titulo.trim(),
            mensaje: mensaje.trim(),
            color_hex: colorHex,
        });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-sticknote" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>
                        {note ? "Editar Nota" : "Nueva Nota"}
                    </h2>
                    <button
                        className="modal-close-btn"
                        onClick={onClose}
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-form">
                    {/* Campo de Título */}
                    <div className="form-group">
                        <label htmlFor="titulo">Título (Opcional)</label>
                        <input
                            type="text"
                            id="titulo"
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            placeholder="Ingresa un título..."
                            maxLength={200}
                        />
                    </div>

                    {/* Campo de Mensaje */}
                    <div className="form-group">
                        <label htmlFor="mensaje">Descripción *</label>
                        <textarea
                            id="mensaje"
                            value={mensaje}
                            onChange={(e) => setMensaje(e.target.value)}
                            placeholder="Ingresa el contenido de la nota..."
                            rows={5}
                            required
                        />
                    </div>

                    {/* Selector de Color */}
                    <div className="form-group">
                        <label>Color</label>
                        <div className="color-picker">
                            {colorPresets.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    className={`color-option ${
                                        colorHex === color ? "selected" : ""
                                    }`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => setColorHex(color)}
                                    title={color}
                                />
                            ))}
                            <input
                                type="color"
                                value={colorHex}
                                onChange={(e) => setColorHex(e.target.value)}
                                className="color-input"
                                title="Color personalizado"
                            />
                        </div>
                    </div>

                    {/* Botones de Acción */}
                    <div className="modal-actions">
                        <button
                            type="button"
                            className="btn-cancel"
                            onClick={onClose}
                        >
                            Cancelar
                        </button>
                        <button type="submit" className="btn-save">
                            {note ? "Actualizar" : "Crear"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ModalSticNote;
