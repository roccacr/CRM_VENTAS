import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Typography,
    IconButton,
    Stack,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

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
    const [colorHex, setColorHex] = useState("#C8E6C9"); // Verde claro por defecto

    // Colores preestablecidos disponibles (solo 3)
    const colorPresets = [
        "#C8E6C9", // Verde claro
        "#FFE0B2", // Naranja claro
        "#F8BBD0", // Rosa claro
    ];

    // Llenar el formulario si está editando
    useEffect(() => {
        if (note) {
            setTitulo(note.titulo || "");
            setMensaje(note.mensaje || "");
            setColorHex(note.color_hex || "#C8E6C9");
        } else {
            setTitulo("");
            setMensaje("");
            setColorHex("#C8E6C9"); // Verde claro por defecto
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
        <Dialog
            open={true}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    maxHeight: "90vh",
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    pb: 1,
                }}
            >
                <Typography variant="h6" component="span">
                    {note ? "Editar Nota" : "Nueva Nota"}
                </Typography>
                <IconButton
                    onClick={onClose}
                    aria-label="Cerrar"
                    size="small"
                    sx={{
                        color: "text.secondary",
                        "&:hover": {
                            backgroundColor: "action.hover",
                        },
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <form onSubmit={handleSubmit}>
                <DialogContent dividers>
                    <Stack spacing={3}>
                        {/* Campo de Título */}
                        <TextField
                            label="Título (Opcional)"
                            id="titulo"
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            placeholder="Ingresa un título..."
                            inputProps={{ maxLength: 200 }}
                            fullWidth
                            variant="outlined"
                        />

                        {/* Campo de Mensaje */}
                        <TextField
                            label="Descripción *"
                            id="mensaje"
                            value={mensaje}
                            onChange={(e) => setMensaje(e.target.value)}
                            placeholder="Ingresa el contenido de la nota..."
                            rows={5}
                            required
                            fullWidth
                            multiline
                            variant="outlined"
                        />

                        {/* Selector de Color */}
                        <Box>
                            <Typography variant="body2" fontWeight={600} gutterBottom>
                                Color
                            </Typography>
                            <Box
                                sx={{
                                    display: "flex",
                                    gap: 2,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexWrap: "wrap",
                                    mt: 1,
                                }}
                            >
                                {colorPresets.map((color) => {
                                    const isSelected = colorHex === color;
                                    return (
                                        <Button
                                            key={color}
                                            onClick={() => setColorHex(color)}
                                            title={color}
                                            aria-label={`Seleccionar color ${color}`}
                                            sx={{
                                                width: 50,
                                                height: 50,
                                                minWidth: 50,
                                                padding: 0,
                                                backgroundColor: color,
                                                border: isSelected
                                                    ? "3px solid #333"
                                                    : "3px solid transparent",
                                                borderRadius: 2,
                                                boxShadow: isSelected
                                                    ? "0 0 0 2px white, 0 0 0 5px #333"
                                                    : "0 2px 8px rgba(0, 0, 0, 0.15)",
                                                transform: isSelected ? "scale(1.1)" : "scale(1)",
                                                transition: "all 0.2s ease",
                                                "&:hover": {
                                                    transform: "scale(1.15)",
                                                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.25)",
                                                },
                                            }}
                                        />
                                    );
                                })}
                            </Box>
                        </Box>
                    </Stack>
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button onClick={onClose} variant="outlined" color="inherit">
                        Cancelar
                    </Button>
                    <Button type="submit" variant="contained" color="primary">
                        {note ? "Actualizar" : "Crear"}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default ModalSticNote;
