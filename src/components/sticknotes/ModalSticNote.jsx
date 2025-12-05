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
    Switch,
    MenuItem,
    CircularProgress,
    Autocomplete,
    Divider,
    Grid,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { obtenerAdminsParaSticknotesThunk } from "../../store/sticknotes/thunkSticknotes";
import Swal from "sweetalert2";
import "./SticNotesContainer.css";

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
    const [open, setOpen] = useState(true);

    const [titulo, setTitulo] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [colorHex, setColorHex] = useState("#C8E6C9"); // Verde claro por defecto
    const [privado, setPrivado] = useState(false);
    const [idUsuarioAsignado, setIdUsuarioAsignado] = useState(null);
    const [prioridad, setPrioridad] = useState("media");
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
                // Error cargando admins
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
        } else {
            setTitulo("");
            setMensaje("");
            setColorHex("#C8E6C9"); // Verde claro por defecto
            setPrivado(false);
            setIdUsuarioAsignado(null);
            setPrioridad("media");
        }
    }, [note]);
    
    // Resetear el estado cuando el modal se cierra completamente
    useEffect(() => {
        return () => {
            // Limpiar cualquier SweetAlert pendiente al desmontar
            Swal.close();
        };
    }, []);

    /**
     * Maneja el envío del formulario
     */
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validar campos requeridos
        if (!mensaje.trim()) {
            Swal.fire({
                icon: "warning",
                title: "Campo requerido",
                text: "El mensaje es obligatorio",
                confirmButtonText: "Entendido",
            });
            return;
        }

        // Mostrar preloader
        Swal.fire({
            title: note ? "Actualizando nota..." : "Creando nota...",
            html: "Por favor espera mientras procesamos tu solicitud",
            allowOutsideClick: false,
            allowEscapeKey: false,
            didOpen: () => {
                Swal.showLoading();
            },
        });

        try {
            await onSave({
                titulo: titulo.trim(),
                mensaje: mensaje.trim(),
                color_hex: colorHex,
                privado: privado ? 1 : 0,
                id_usuario_asignado: idUsuarioAsignado,
                prioridad: prioridad,
                categoria: "general", // Valor por defecto
            });

            // Cerrar el preloader
            Swal.close();

            // Cerrar el modal completamente
            setOpen(false);

            // Esperar 300ms para que termine la animación de cierre del modal
            setTimeout(() => {
                // Llamar a onClose para notificar al padre
                onClose();

                // Mostrar el SweetAlert de éxito después de que el modal se cerró
                Swal.fire({
                    icon: "success",
                    title: note ? "¡Nota actualizada!" : "¡Nota creada!",
                    text: note
                        ? "La nota se actualizó correctamente"
                        : "La nota se creó correctamente",
                    timer: 2000,
                    showConfirmButton: false,
                });
            }, 300);
        } catch (error) {
            // Cerrar el preloader
            Swal.close();

            // Mostrar error (el modal sigue abierto para que el usuario pueda corregir)
            Swal.fire({
                icon: "error",
                title: "Error",
                text: note
                    ? "No se pudo actualizar la nota. Por favor intenta de nuevo."
                    : "No se pudo crear la nota. Por favor intenta de nuevo.",
                confirmButtonText: "Entendido",
            });
        }
    };

    /**
     * Maneja el cierre del modal (usado por el botón cancelar y el backdrop)
     */
    const handleClose = () => {
        setOpen(false);
        setTimeout(() => {
            onClose();
        }, 300);
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                    zIndex: 1301, // Popup del Dialog
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    px: 3,
                    py: 2.5,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                }}
            >
                <Typography variant="h6" component="span" fontWeight={600}>
                    {note ? "Editar Nota" : "Nueva Nota"}
                </Typography>
                <IconButton
                    onClick={handleClose}
                    aria-label="Cerrar"
                    size="small"
                    sx={{
                        color: "text.secondary",
                        "&:hover": {
                            backgroundColor: "action.hover",
                            color: "text.primary",
                        },
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <form onSubmit={handleSubmit}>
                <DialogContent sx={{ px: 3, py: 3 }}>
                    <Stack spacing={3.5}>
                        {/* Sección: Contenido Principal */}
                        <Box>
                            <Stack spacing={2.5}>
                                <TextField
                                    label="Título"
                                    id="titulo"
                                    value={titulo}
                                    onChange={(e) => setTitulo(e.target.value)}
                                    placeholder="Ingrese un título opcional"
                                    inputProps={{ maxLength: 200 }}
                                    fullWidth
                                    variant="outlined"
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: 2,
                                        },
                                    }}
                                />

                                <TextField
                                    label="Descripción"
                                    id="mensaje"
                                    value={mensaje}
                                    onChange={(e) => setMensaje(e.target.value)}
                                    placeholder="Ingrese el contenido de la nota"
                                    rows={4}
                                    required
                                    fullWidth
                                    multiline
                                    variant="outlined"
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: 2,
                                        },
                                    }}
                                />
                            </Stack>
                        </Box>

                        <Divider sx={{ my: 1 }} />

                        {/* Sección: Configuración */}
                        <Box>
                            <Stack spacing={3}>
                                {/* Prioridad */}
                                <TextField
                                    select
                                    label="Prioridad"
                                    value={prioridad}
                                    onChange={(e) => setPrioridad(e.target.value)}
                                    fullWidth
                                    variant="outlined"
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: 2,
                                        },
                                    }}
                                >
                                    <MenuItem value="baja">Baja</MenuItem>
                                    <MenuItem value="media">Media</MenuItem>
                                    <MenuItem value="alta">Alta</MenuItem>
                                </TextField>

                                {/* Selector de Color */}
                                <Box>
                                    <Typography
                                        variant="body2"
                                        component="label"
                                        sx={{
                                            display: "block",
                                            mb: 1.5,
                                            color: "text.secondary",
                                            fontSize: "0.875rem",
                                            fontWeight: 500,
                                        }}
                                    >
                                        Color
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            gap: 1.5,
                                            alignItems: "center",
                                        }}
                                    >
                                        {colorPresets.map((color) => {
                                            const isSelected = colorHex === color;
                                            return (
                                                <Box
                                                    key={color}
                                                    onClick={() => setColorHex(color)}
                                                    sx={{
                                                        position: "relative",
                                                        width: 52,
                                                        height: 52,
                                                        borderRadius: 2,
                                                        backgroundColor: color,
                                                        cursor: "pointer",
                                                        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                                        border: "3px solid",
                                                        borderColor: isSelected ? "primary.main" : "transparent",
                                                        boxShadow: isSelected
                                                            ? "0 0 0 3px rgba(25, 118, 210, 0.12), 0 2px 8px rgba(25, 118, 210, 0.2)"
                                                            : "0 1px 3px rgba(0, 0, 0, 0.12)",
                                                        "&:hover": {
                                                            transform: "scale(1.08)",
                                                            boxShadow: isSelected
                                                                ? "0 0 0 3px rgba(25, 118, 210, 0.12), 0 4px 12px rgba(25, 118, 210, 0.25)"
                                                                : "0 3px 8px rgba(0, 0, 0, 0.15)",
                                                        },
                                                    }}
                                                />
                                            );
                                        })}
                                    </Box>
                                </Box>

                                {/* Asignar a Usuario */}
                                <Box>
                                    {loadingAdmins ? (
                                        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                                            <CircularProgress size={24} />
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
                                                    label="Asignar a"
                                                    placeholder="Seleccione un usuario"
                                                    variant="outlined"
                                                    sx={{
                                                        "& .MuiOutlinedInput-root": {
                                                            borderRadius: 2,
                                                        },
                                                    }}
                                                />
                                            )}
                                            noOptionsText="Sin usuarios disponibles"
                                            clearText="Limpiar"
                                            openText="Abrir"
                                            closeText="Cerrar"
                                        />
                                    )}
                                </Box>

                                {/* Switch Privado */}
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        p: 2.5,
                                        borderRadius: 2,
                                        border: "1px solid",
                                        borderColor: "divider",
                                        backgroundColor: privado ? "action.selected" : "background.paper",
                                        transition: "background-color 0.2s ease",
                                    }}
                                >
                                    <Box sx={{ flex: 1 }}>
                                        <Typography variant="body2" fontWeight={500} gutterBottom={0.5}>
                                            Nota privada
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            Solo será visible para ti
                                        </Typography>
                                    </Box>
                                    <Switch
                                        checked={privado}
                                        onChange={(e) => setPrivado(e.target.checked)}
                                        color="primary"
                                        sx={{
                                            "& .MuiSwitch-switchBase.Mui-checked": {
                                                color: "primary.main",
                                            },
                                            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                                backgroundColor: "primary.main",
                                            },
                                        }}
                                    />
                                </Box>
                            </Stack>
                        </Box>
                    </Stack>
                </DialogContent>

                <DialogActions
                    sx={{
                        px: 3,
                        py: 2.5,
                        borderTop: "1px solid",
                        borderColor: "divider",
                        gap: 1.5,
                    }}
                >
                    <Button
                        onClick={handleClose}
                        variant="outlined"
                        color="inherit"
                        sx={{
                            borderRadius: 2,
                            textTransform: "none",
                            px: 3,
                            fontWeight: 500,
                        }}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        sx={{
                            borderRadius: 2,
                            textTransform: "none",
                            px: 3,
                            fontWeight: 500,
                            boxShadow: "none",
                            "&:hover": {
                                boxShadow: "none",
                            },
                        }}
                    >
                        {note ? "Actualizar" : "Crear Nota"}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default ModalSticNote;
