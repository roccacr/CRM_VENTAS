import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    obtenerSticNotesPorTransaccion,
    crearSticNotePorTransaccion,
    editarSticNotePorId,
    actualizarPosicionSticNotePorId,
    cambiarVisibilidadSticNotePorId,
    cambiarEstadoSticNotePorId,
} from "../../store/sticknotes/thunkSticknotes";
import SticNote from "./SticNote";
import ModalSticNote from "./ModalSticNote";
import "./SticNotesContainer.css";

/**
 * Componente contenedor para la gestión de Sticky Notes
 * Es reutilizable para cualquier vista que necesite sticky notes
 *
 * @param {Object} props - Props del componente
 * @param {number} props.idinternoLead - ID interno del lead (idinterno_lead)
 * @param {string} props.transactionType - Tipo de transacción (ej: ordersale)
 * @param {number} props.transactionId - ID de la transacción
 */
const SticNotesContainer = ({ idinternoLead, transactionType, transactionId }) => {
    const dispatch = useDispatch();
    const [sticNotes, setSticNotes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingNote, setEditingNote] = useState(null);
    const [draggedNote, setDraggedNote] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [showHiddenNotes, setShowHiddenNotes] = useState(false); // Estado para mostrar notas ocultas ADICIONALES
    const [hideAllNotes, setHideAllNotes] = useState(false); // Estado para ocultar todas visualmente
    const containerRef = useRef(null);

    // Obtener notas al montar el componente o cuando cambien los IDs
    useEffect(() => {
        fetchSticNotes();
    }, [transactionType, transactionId]);

    /**
     * Obtiene todos los sticky notes para la transacción actual
     */
    const fetchSticNotes = async () => {
        try {
            console.log("🔄 Obteniendo sticky notes para:", { transactionType, transactionId });

            // Pequeño delay para asegurar que la BD ha procesado
            await new Promise(resolve => setTimeout(resolve, 300));

            const result = await dispatch(
                obtenerSticNotesPorTransaccion(transactionType, transactionId)
            );

            console.log("📝 Resultado fetch sticky notes:", result);

            // Navegar a través de la estructura anidada
            // result.data contiene { statusCode, message, data: { ok, statusCode, data: [...] } }
            // O simplemente result.data.data si es la estructura correcta
            let notesData = [];

            if (result && result.data) {
                // Si result.data tiene una propiedad 'data' con las notas
                if (result.data.data && Array.isArray(result.data.data)) {
                    notesData = result.data.data;
                }
                // Si result.data es directamente el array
                else if (Array.isArray(result.data)) {
                    notesData = result.data;
                }
                // Si result.data tiene otra estructura con 'data' adentro
                else if (result.data.data && result.data.data.data) {
                    notesData = result.data.data.data;
                }
            }

            console.log("✅ Notas cargadas:", notesData.length, notesData);
            setSticNotes(notesData);
        } catch (error) {
            console.error("❌ Error obteniendo sticky notes:", error);
            setSticNotes([]);
        }
    };

    /**
     * Abre el modal para crear una nueva nota
     */
    const handleOpenCreateModal = () => {
        setEditingNote(null);
        setShowModal(true);
    };

    /**
     * Abre el modal para editar una nota existente
     */
    const handleEditNote = (note) => {
        setEditingNote(note);
        setShowModal(true);
    };

    /**
     * Cierra el modal
     */
    const handleCloseModal = () => {
        setShowModal(false);
        setEditingNote(null);
    };

    /**
     * Guarda una nueva nota o edita una existente
     */
    const handleSaveNote = async (noteData) => {
        try {
            if (editingNote) {
                // Editar nota existente
                await dispatch(
                    editarSticNotePorId({
                        id_sticknote: editingNote.id_sticknote,
                        titulo: noteData.titulo,
                        mensaje: noteData.mensaje,
                        color_hex: noteData.color_hex,
                    })
                );
            } else {
                // Crear nueva nota
                // Calcular posición basada en el ancho de la pantalla
                // La nota tiene ~300px de ancho
                const posX = 1205;
                const posY = 256;

                console.log("📍 Posición inicial de nota:", { posX, posY });

                await dispatch(
                    crearSticNotePorTransaccion({
                        idinterno_lead: idinternoLead,
                        transaction_type: transactionType,
                        transaction_id: transactionId,
                        titulo: noteData.titulo,
                        mensaje: noteData.mensaje,
                        color_hex: noteData.color_hex,
                        pos_x: posX,
                        pos_y: posY,
                    })
                );
            }
            handleCloseModal();
            fetchSticNotes();
        } catch (error) {
            // Error guardando nota
        }
    };

    /**
     * Maneja el inicio del arrastre de una nota
     */
    const handleMouseDown = (e, noteId) => {
        if (e.target.closest(".sticknote-header-actions")) {
            return; // No arrastrar si hace clic en los botones
        }

        const note = sticNotes.find((n) => n.id_sticknote === noteId);
        if (!note) return;

        setDraggedNote(noteId);
        const rect = e.currentTarget.getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    /**
     * Maneja el movimiento durante el arrastre
     */
    const handleMouseMove = (e) => {
        if (!draggedNote || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - containerRect.left - dragOffset.x;
        const y = e.clientY - containerRect.top - dragOffset.y;

        // Actualizar posición local inmediatamente para una experiencia fluida
        setSticNotes((prevNotes) =>
            prevNotes.map((note) =>
                note.id_sticknote === draggedNote
                    ? { ...note, pos_x: Math.max(0, x), pos_y: Math.max(0, y) }
                    : note
            )
        );
    };

    /**
     * Maneja el final del arrastre - envía la actualización al servidor
     */
    const handleMouseUp = async (e) => {
        if (!draggedNote) return;

        const note = sticNotes.find((n) => n.id_sticknote === draggedNote);
        if (note) {
            try {
                await dispatch(
                    actualizarPosicionSticNotePorId({
                        id_sticknote: draggedNote,
                        pos_x: note.pos_x,
                        pos_y: note.pos_y,
                    })
                );
            } catch (error) {
                // Error actualizando posición
            }
        }

        setDraggedNote(null);
    };

    /**
     * Alterna la visibilidad de una nota
     */
    const handleToggleVisibility = async (noteId, currentVisible) => {
        try {
            // Actualizar localmente primero para feedback inmediato
            const newVisibility = currentVisible === 1 ? 0 : 1;
            setSticNotes((prevNotes) =>
                prevNotes.map((note) =>
                    note.id_sticknote === noteId
                        ? { ...note, visible: newVisibility }
                        : note
                )
            );

            // Luego hacer la petición al servidor
            await dispatch(
                cambiarVisibilidadSticNotePorId({
                    id_sticknote: noteId,
                    visible: newVisibility,
                })
            );
        } catch (error) {
            // Error cambiando visibilidad - recargar para restaurar estado
            console.error("Error cambiando visibilidad:", error);
            fetchSticNotes();
        }
    };

    /**
     * Cambia el estado de una nota (activo/inactivo)
     */
    const handleToggleState = async (noteId, currentState) => {
        try {
            await dispatch(
                cambiarEstadoSticNotePorId({
                    id_sticknote: noteId,
                    estado: currentState === 1 ? 0 : 1,
                })
            );
            fetchSticNotes();
        } catch (error) {
            // Error cambiando estado
        }
    };

    /**
     * Oculta todas las notas visualmente (sin cambiar BD)
     */
    const handleHideAllNotes = () => {
        setHideAllNotes(true);
        setShowHiddenNotes(false);
    };

    /**
     * Muestra todas las notas nuevamente
     */
    const handleShowAllNotes = () => {
        setHideAllNotes(false);
    };

    /**
     * Muestra las notas que están ocultas en BD
     */
    const handleShowHiddenNotes = () => {
        setShowHiddenNotes(!showHiddenNotes);
    };

    /**
     * Filtra las notas a mostrar según el estado
     * Lógica:
     * - hideAllNotes: Oculta visualmente TODAS las notas (no modifica BD)
     * - showHiddenNotes: MUESTRA ADEMÁS las notas archivadas (visible=0)
     * - normal: Muestra SOLO las notas visibles (visible=1) y activas (estado=1)
     */
    const notasAMostrar = sticNotes.filter((note) => {
        // Si ocultamos todas visualmente, no mostrar nada
        if (hideAllNotes) {
            return false;
        }

        // Por defecto: mostrar las notas visibles y activas
        if (note.estado !== 1) {
            return false; // No mostrar notas inactivas nunca
        }

        // Si mostramos notas archivadas, mostrar TAMBIÉN las archivadas
        if (showHiddenNotes) {
            // Mostrar tanto visibles como archivadas
            return note.visible === 1 || note.visible === 0;
        }

        // Modo normal: mostrar SOLO las notas visibles
        return note.visible === 1;
    });

    return (
        <div
            ref={containerRef}
            className="sticknotes-container"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Botón para crear nueva nota */}
            <button
                className="btn-create-sticknote"
                onClick={handleOpenCreateModal}
                title="Crear nueva nota"
            >
                + Stick Notes
            </button>

            {/* Botón para ocultar todas las notas */}
            {!hideAllNotes && (
                <button
                    className="btn-hide-all-sticknotes"
                    onClick={handleHideAllNotes}
                    title="Oculta todas las notas de la vista actual (no las elimina)"
                >
                    Ocultar Todas
                </button>
            )}

            {/* Botón para mostrar todas las notas */}
            {hideAllNotes && (
                <button
                    className="btn-show-all-sticknotes"
                    onClick={handleShowAllNotes}
                    title="Muestra todas las notas nuevamente"
                >
                    Mostrar Todas
                </button>
            )}

            {/* Botón para mostrar notas archivadas */}
            <button
                className={`btn-show-hidden-sticknotes ${showHiddenNotes ? 'active' : ''}`}
                onClick={handleShowHiddenNotes}
                title="Muestra las notas que han sido archivadas"
            >
                Archivadas ({sticNotes.filter(n => n.visible === 0).length})
            </button>

            {/* Mostrar las notas filtradas */}
            {notasAMostrar.map((note) => (
                <SticNote
                    key={note.id_sticknote}
                    note={note}
                    onMouseDown={handleMouseDown}
                    onEdit={handleEditNote}
                    onToggleVisibility={handleToggleVisibility}
                    onToggleState={handleToggleState}
                    showingHidden={showHiddenNotes}
                />
            ))}

            {/* Modal para crear/editar notas */}
            {showModal && (
                <ModalSticNote
                    note={editingNote}
                    onSave={handleSaveNote}
                    onClose={handleCloseModal}
                />
            )}
        </div>
    );
};

export default SticNotesContainer;
