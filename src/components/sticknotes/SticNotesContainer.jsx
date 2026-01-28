import React, { useEffect, useState, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
    obtenerSticNotesPorTransaccion,
    crearSticNotePorTransaccion,
    editarSticNotePorId,
    actualizarPosicionSticNotePorId,
    cambiarVisibilidadSticNotePorId,
    cambiarEstadoSticNotePorId,
    actualizarPinSticNotePorId,
    obtenerAdminsParaSticknotesThunk,
    eliminarSticNotePorId,
} from "../../store/sticknotes/thunkSticknotes";
import Swal from "sweetalert2";
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
    const { idnetsuite_admin } = useSelector((state) => state.auth);
    const [sticNotes, setSticNotes] = useState([]);
    const [adminsMap, setAdminsMap] = useState({}); // Mapeo de idnetsuite_admin -> nombre
    const [showModal, setShowModal] = useState(false);
    const [editingNote, setEditingNote] = useState(null);
    const [draggedNote, setDraggedNote] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [showHiddenNotes, setShowHiddenNotes] = useState(false); // Estado para mostrar notas ocultas ADICIONALES
    const [hideAllNotes, setHideAllNotes] = useState(false); // Estado para ocultar todas visualmente
    const containerRef = useRef(null);
    const savePositionTimeoutRef = useRef(null); // Referencia para el timeout de guardado

    // Cargar admins para mapeo de nombres al montar el componente
    useEffect(() => {
        const loadAdminsMap = async () => {
            try {
                const result = await dispatch(obtenerAdminsParaSticknotesThunk(1));
                let adminsData = [];
                if (result && result.data) {
                    if (result.data["0"] && Array.isArray(result.data["0"])) {
                        adminsData = result.data["0"];
                    } else if (Array.isArray(result.data)) {
                        adminsData = result.data;
                    } else if (result.data.data && Array.isArray(result.data.data)) {
                        adminsData = result.data.data;
                    }
                }
                // Crear mapeo de idnetsuite_admin -> name_admin
                const map = {};
                adminsData.forEach((admin) => {
                    map[admin.idnetsuite_admin] = admin.name_admin;
                });
                setAdminsMap(map);
            } catch (error) {
                // Error cargando admins map
            }
        };
        loadAdminsMap();
    }, [dispatch]);

    // Obtener notas al montar el componente o cuando cambien los IDs
    useEffect(() => {
        if (transactionType && transactionId) {
            fetchSticNotes();
        }
    }, [transactionType, transactionId]);

    // Cleanup del timeout cuando el componente se desmonte
    useEffect(() => {
        return () => {
            if (savePositionTimeoutRef.current) {
                clearTimeout(savePositionTimeoutRef.current);
            }
        };
    }, []);

    /**
     * Obtiene todos los sticky notes para la transacción actual
     */
    const fetchSticNotes = async () => {
        try {
            // Pequeño delay para asegurar que la BD ha procesado
            await new Promise(resolve => setTimeout(resolve, 300));

            const result = await dispatch(
                obtenerSticNotesPorTransaccion(transactionType, transactionId)
            );

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

            // Asegurar que pos_x y pos_y sean números
            notesData = notesData.map(note => ({
                ...note,
                pos_x: note.pos_x ? Number(note.pos_x) : 0,
                pos_y: note.pos_y ? Number(note.pos_y) : 0,
            }));

            setSticNotes(notesData);
        } catch (error) {
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
                        privado: noteData.privado || 0,
                        id_usuario_asignado: noteData.id_usuario_asignado || null,
                        email_usuario_asignado: noteData.email_usuario_asignado || null,
                        prioridad: noteData.prioridad || "media",
                    })
                );
                handleCloseModal();
                fetchSticNotes();
            } else {
                // Crear nueva nota
                const posX = 1205;
                const posY = 256;

                const result = await dispatch(
                    crearSticNotePorTransaccion({
                        idinterno_lead: idinternoLead,
                        transaction_type: transactionType,
                        transaction_id: transactionId,
                        titulo: noteData.titulo,
                        mensaje: noteData.mensaje,
                        color_hex: noteData.color_hex,
                        pos_x: posX,
                        pos_y: posY,
                        privado: noteData.privado || 0,
                        id_usuario_asignado: noteData.id_usuario_asignado || null,
                        email_usuario_asignado: noteData.email_usuario_asignado || null,
                        prioridad: noteData.prioridad || "media",
                        categoria: noteData.categoria || "general",
                    })
                );

                handleCloseModal();

                // Crear una nota temporal para mostrar inmediatamente
                if (result && result.data && result.data.id_sticknote) {
                    const newNote = {
                        id_sticknote: result.data.id_sticknote,
                        idinterno_lead: idinternoLead,
                        transaction_type: transactionType,
                        transaction_id: transactionId,
                        titulo: noteData.titulo,
                        mensaje: noteData.mensaje,
                        color_hex: noteData.color_hex,
                        pos_x: posX,
                        pos_y: posY,
                        visible: 1,
                        estado: 1,
                        pinned: 0,
                        id_usuario_creador: idnetsuite_admin,
                        privado: noteData.privado || 0,
                        id_usuario_asignado: noteData.id_usuario_asignado || null,
                        prioridad: noteData.prioridad || "media",
                        categoria: noteData.categoria || "general",
                        creado_en: new Date().toISOString(),
                        actualizado_en: new Date().toISOString(),
                    };

                    // Agregar la nota al estado local inmediatamente
                    setSticNotes((prevNotes) => [newNote, ...prevNotes]);
                }

                // Luego recargar desde el servidor después de un delay
                setTimeout(() => {
                    fetchSticNotes();
                }, 500);
            }
        } catch (error) {
            handleCloseModal();
            fetchSticNotes();
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

        // Limitar las posiciones dentro de los límites de la ventana
        const maxX = window.innerWidth - 300; // Ancho aproximado de la nota
        const maxY = window.innerHeight - 150; // Alto aproximado de la nota

        const clampedX = Math.max(0, Math.min(x, maxX));
        const clampedY = Math.max(0, Math.min(y, maxY));

        // Actualizar posición local inmediatamente para una experiencia fluida
        setSticNotes((prevNotes) =>
            prevNotes.map((note) =>
                note.id_sticknote === draggedNote
                    ? { ...note, pos_x: clampedX, pos_y: clampedY }
                    : note
            )
        );
    };

    /**
     * Maneja el final del arrastre - envía la actualización al servidor después de 2 segundos
     */
    const handleMouseUp = async (e) => {
        if (!draggedNote) return;

        const noteId = draggedNote;
        const note = sticNotes.find((n) => n.id_sticknote === noteId);
        
        // Limpiar timeout anterior si existe
        if (savePositionTimeoutRef.current) {
            clearTimeout(savePositionTimeoutRef.current);
        }

        // Esperar 2 segundos antes de enviar la actualización al servidor
        savePositionTimeoutRef.current = setTimeout(async () => {
            const currentNote = sticNotes.find((n) => n.id_sticknote === noteId);
            if (currentNote) {
                try {
                    await dispatch(
                        actualizarPosicionSticNotePorId({
                            id_sticknote: noteId,
                            pos_x: currentNote.pos_x,
                            pos_y: currentNote.pos_y,
                        })
                    );
                    console.log(`✅ Posición guardada para nota ${noteId}:`, {
                        pos_x: currentNote.pos_x,
                        pos_y: currentNote.pos_y,
                    });
                } catch (error) {
                    console.error("Error actualizando posición:", error);
                }
            }
            savePositionTimeoutRef.current = null;
        }, 2000); // 2 segundos de delay

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
            fetchSticNotes();
        }
    };

    /**
     * Cambia el estado de una nota (activo/inactivo)
     * Cuando desactivas (estado=0), también establece visible=0
     * Cuando reactivas (estado=1), también establece visible=1
     */
    const handleToggleState = async (noteId, currentState) => {
        try {
            const newState = currentState === 1 ? 0 : 1;

            // Actualizar localmente primero para feedback inmediato
            setSticNotes((prevNotes) =>
                prevNotes.map((note) =>
                    note.id_sticknote === noteId
                        ? { ...note, estado: newState, visible: newState }
                        : note
                )
            );

            // Luego hacer la petición al servidor
            await dispatch(
                cambiarEstadoSticNotePorId({
                    id_sticknote: noteId,
                    estado: newState,
                    visible: newState,
                })
            );

            fetchSticNotes();
        } catch (error) {
            fetchSticNotes();
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
     * Alterna el estado PIN de una nota (fijar en la parte superior)
     */
    const handleTogglePin = async (noteId, currentPin) => {
        try {
            // Actualizar localmente primero para feedback inmediato
            const newPin = currentPin ? 0 : 1;
            setSticNotes((prevNotes) =>
                prevNotes.map((note) =>
                    note.id_sticknote === noteId
                        ? { ...note, pin: newPin }
                        : note
                )
            );

            // Luego hacer la petición al servidor
            await dispatch(
                actualizarPinSticNotePorId({
                    id_sticknote: noteId,
                    pin: newPin,
                })
            );
        } catch (error) {
            // Error cambiando pin - recargar para restaurar estado
            fetchSticNotes();
        }
    };

    /**
     * Elimina una nota sticky
     */
    const handleDeleteNote = async (noteId) => {
        try {
            // Mostrar confirmación
            const result = await Swal.fire({
                icon: "warning",
                title: "¿Eliminar nota?",
                text: "Esta acción no se puede deshacer. ¿Estás seguro?",
                showCancelButton: true,
                confirmButtonText: "Sí, eliminar",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#d33",
                cancelButtonColor: "#3085d6",
            });

            if (!result.isConfirmed) {
                return;
            }

            // Mostrar preloader
            Swal.fire({
                title: "Eliminando nota...",
                html: "Por favor espera",
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => {
                    Swal.showLoading();
                },
            });

            // Eliminar del servidor
            await dispatch(eliminarSticNotePorId(noteId));

            // Cerrar preloader
            Swal.close();

            // Eliminar localmente
            setSticNotes((prevNotes) =>
                prevNotes.filter((note) => note.id_sticknote !== noteId)
            );

            // Mostrar éxito
            Swal.fire({
                icon: "success",
                title: "¡Nota eliminada!",
                text: "La nota se eliminó correctamente",
                timer: 2000,
                showConfirmButton: false,
            });
        } catch (error) {
            // Cerrar preloader
            Swal.close();

            // Mostrar error
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "No se pudo eliminar la nota. Por favor intenta de nuevo.",
                confirmButtonText: "Entendido",
            });
        }
    };

    /**
     * Verifica si el usuario puede ver una nota basado en permisos de privacidad y asignaciones
     * Reglas:
     * 1. Si la creo yo (id_usuario_creador === idnetsuite_admin) → siempre puedo verla
     * 2. Si es privada (privado === 1) → solo puedo verla si la creo yo
     * 3. Si no es privada:
     *    - Si soy el creador → puedo verla
     *    - Si estoy asignado (en id_usuario_asignado) → puedo verla
     *    - Si no estoy asignado → no puedo verla
     */
    const canViewNote = (note) => {
        // Si soy el creador, siempre puedo verla
        if (note.id_usuario_creador === idnetsuite_admin) {
            return true;
        }

        // Si es privada y no soy el creador, no puedo verla
        if (note.privado === 1) {
            return false;
        }

        // Si no es privada, verificar si estoy asignado
        if (note.id_usuario_asignado) {
            // Convertir el string de IDs a array (puede ser string separado por coma o ya un array)
            let idsAsignados = [];
            if (Array.isArray(note.id_usuario_asignado)) {
                idsAsignados = note.id_usuario_asignado;
            } else if (typeof note.id_usuario_asignado === 'string') {
                idsAsignados = note.id_usuario_asignado.split(',').map(id => String(id.trim())).filter(id => id);
            } else {
                idsAsignados = [String(note.id_usuario_asignado)];
            }

            // Verificar si mi ID está en la lista de asignados
            const miIdString = String(idnetsuite_admin);
            const estoyAsignado = idsAsignados.some(id => String(id) === miIdString);

            return estoyAsignado;
        }

        // Si no hay usuarios asignados y no soy el creador, no puedo verla
        return false;
    };

    /**
     * Filtra las notas a mostrar según el estado y permisos
     * Lógica:
     * - hideAllNotes: Oculta visualmente TODAS las notas (no modifica BD)
     * - showHiddenNotes: MUESTRA ADEMÁS las notas desactivadas (estado=0)
     * - Validar permisos de privacidad (privado)
     */
    const notasAMostrar = sticNotes.filter((note) => {
        // Si ocultamos todas visualmente, no mostrar nada
        if (hideAllNotes) {
            return false;
        }

        // Validar permisos de privacidad
        if (!canViewNote(note)) {
            return false;
        }

        // Si mostramos notas archivadas, mostrar TAMBIÉN las desactivadas
        if (showHiddenNotes) {
            // Mostrar tanto activas (estado=1) como desactivadas (estado=0)
            return true;
        }

        // Modo normal: mostrar SOLO las notas activas (estado=1)
        return note.estado === 1;
    });

    return (
        <>
            {/* Contenedor de botones fuera del contenedor principal */}
            <div className="sticknotes-buttons-container">
                {/* Botón para mostrar notas archivadas/desactivadas */}
                <button
                    className={`btn-show-hidden-sticknotes ${showHiddenNotes ? 'active' : ''}`}
                    onClick={handleShowHiddenNotes}
                    title="Muestra las notas que han sido desactivadas"
                >
                    Archivadas ({sticNotes.filter(n => n.estado === 0).length})
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

                {/* Botón para crear nueva nota */}
                <button
                    className="btn-create-sticknote"
                    onClick={handleOpenCreateModal}
                    title="Crear nueva nota"
                >
                    + Stick Notes
                </button>
            </div>

            {/* Contenedor principal de las notas */}
            <div
                ref={containerRef}
                className="sticknotes-container"
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                {/* Mostrar las notas filtradas */}
                {notasAMostrar.map((note) => (
                    <SticNote
                        key={note.id_sticknote}
                        note={note}
                        onMouseDown={handleMouseDown}
                        onEdit={handleEditNote}
                        onToggleVisibility={handleToggleVisibility}
                        onToggleState={handleToggleState}
                        onTogglePin={handleTogglePin}
                        onDelete={handleDeleteNote}
                        showingHidden={showHiddenNotes}
                        adminsMap={adminsMap}
                        currentUserId={idnetsuite_admin}
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
        </>
    );
};

export default SticNotesContainer;
