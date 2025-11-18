import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
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
    FormControlLabel,
    Checkbox,
    MenuItem,
    CircularProgress,
    Autocomplete,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { obtenerAdminsParaSticknotesThunk } from "../../store/sticknotes/thunkSticknotes";

/**
 * Modal para crear o editar sticky notes
 *
 * @param {Object} props - Props del componente
 * @param {Object} props.note - Nota a editar (null si es crear nueva)
 * @param {Function} props.onSave - Callback para guardar la nota
 * @param {Function} props.onClose - Callback para cerrar el modal
 */
const ModalSticNote = ({ note, onSave, onClose }) => {
    const dispatch = useDispatch();

    const [titulo, setTitulo] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [colorHex, setColorHex] = useState("#C8E6C9"); // Verde claro por defecto
    const [privado, setPrivado] = useState(false);
    const [idUsuarioAsignado, setIdUsuarioAsignado] = useState(null);
    const [prioridad, setPrioridad] = useState("media");
    const [categoria, setCategoria] = useState("general");
    const [admins, setAdmins] = useState([]);
    const [adminsFiltered, setAdminsFiltered] = useState([]);
    const [loadingAdmins, setLoadingAdmins] = useState(false);

    // Colores preestablecidos disponibles (solo 3)
    const colorPresets = [
        "#C8E6C9", // Verde claro
        "#FFE0B2", // Naranja claro
        "#F8BBD0", // Rosa claro
    ];

    // Cargar admins al montar el componente
    useEffect(() => {
        const loadAdmins = async () => {
            setLoadingAdmins(true);
            try {
                const result = await dispatch(obtenerAdminsParaSticknotesThunk(1));


                // Navegar a través de la estructura de datos
                let adminsData = [];
                if (result && result.data) {
                    // La API devuelve { "0": [...], "1": {...}, ok: true, statusCode: 200 }
                    if (result.data["0"] && Array.isArray(result.data["0"])) {
                        adminsData = result.data["0"];
                    } else if (Array.isArray(result.data)) {
                        adminsData = result.data;
                    } else if (result.data.data && Array.isArray(result.data.data)) {
                        adminsData = result.data.data;
                    }
                }
                setAdmins(adminsData);

                // Filtrar solo los admins con id_rol_admin = 2, 3 o 4
                const filtered = adminsData.filter(
                    (admin) => admin.id_rol_admin === 2 || admin.id_rol_admin === 3 || admin.id_rol_admin === 4
                );

                setAdminsFiltered(filtered);
            } catch (error) {
                console.error("Error cargando admins:", error);
            } finally {
                setLoadingAdmins(false);
            }
        };
        loadAdmins();
    }, [dispatch]);

    // Llenar el formulario si está editando
    useEffect(() => {
        if (note) {
            setTitulo(note.titulo || "");
            setMensaje(note.mensaje || "");
            setColorHex(note.color_hex || "#C8E6C9");
            setPrivado(note.privado === 1 || false);
            setIdUsuarioAsignado(note.id_usuario_asignado || null);
            setPrioridad(note.prioridad || "media");
            setCategoria(note.categoria || "general");
        } else {
            setTitulo("");
            setMensaje("");
            setColorHex("#C8E6C9"); // Verde claro por defecto
            setPrivado(false);
            setIdUsuarioAsignado(null);
            setPrioridad("media");
            setCategoria("general");
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
            privado: privado ? 1 : 0,
            id_usuario_asignado: idUsuarioAsignado,
            prioridad: prioridad,
            categoria: categoria,
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

                        {/* Prioridad */}
                        <TextField
                            select
                            label="Prioridad"
                            value={prioridad}
                            onChange={(e) => setPrioridad(e.target.value)}
                            fullWidth
                            variant="outlined"
                        >
                            <MenuItem value="baja">Baja</MenuItem>
                            <MenuItem value="media">Media</MenuItem>
                            <MenuItem value="alta">Alta</MenuItem>
                        </TextField>

                        {/* Categoría */}
                        <TextField
                            label="Categoría"
                            id="categoria"
                            value={categoria}
                            onChange={(e) => setCategoria(e.target.value)}
                            placeholder="ej: general, seguimiento, importante..."
                            fullWidth
                            variant="outlined"
                        />

                        {/* Asignar a Usuario */}
                        <Box>
                            <Typography variant="body2" fontWeight={600} gutterBottom>
                                Asignar a
                            </Typography>
                            {loadingAdmins ? (
                                <Box sx={{ display: "flex", justifyContent: "center" }}>
                                    <CircularProgress size={30} />
                                </Box>
                            ) : (
                                <Autocomplete
                                    options={adminsFiltered}
                                    getOptionLabel={(option) => option.name_admin || ""}
                                    value={
                                        idUsuarioAsignado
                                            ? adminsFiltered.find((a) => a.idnetsuite_admin === idUsuarioAsignado) || null
                                            : null
                                    }
                                    onChange={(event, newValue) => {
                                        setIdUsuarioAsignado(newValue ? newValue.idnetsuite_admin : null);
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            placeholder="Escribe para buscar un usuario..."
                                            variant="outlined"
                                        />
                                    )}
                                    noOptionsText="Sin usuarios disponibles"
                                    clearText="Limpiar"
                                    openText="Abrir"
                                    closeText="Cerrar"
                                />
                            )}
                        </Box>

                        {/* Checkboxes */}
                        <Stack spacing={1}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={privado}
                                        onChange={(e) => setPrivado(e.target.checked)}
                                    />
                                }
                                label="Privado (solo visible para mí)"
                            />
                        </Stack>
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
