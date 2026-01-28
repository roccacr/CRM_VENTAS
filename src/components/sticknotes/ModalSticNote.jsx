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
import NoteIcon from "@mui/icons-material/Note";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import PersonIcon from "@mui/icons-material/Person";
import LockIcon from "@mui/icons-material/Lock";
import PaletteIcon from "@mui/icons-material/Palette";
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
    const [colorHex, setColorHex] = useState("#FFF9C4"); // Amarillo pastel por defecto (media)
    const [privado, setPrivado] = useState(false);
    const [usuariosAsignados, setUsuariosAsignados] = useState([]); // Array de usuarios asignados
    const [prioridad, setPrioridad] = useState("media");
    const [admins, setAdmins] = useState([]);
    const [adminsFiltered, setAdminsFiltered] = useState([]);
    const [loadingAdmins, setLoadingAdmins] = useState(false);

    // Colores según prioridad (tonos suaves de sticky notes reales)
    const coloresPorPrioridad = {
        baja: "#E8F5E9",   // Verde muy claro/pastel
        media: "#FFF9C4",  // Amarillo pastel (como sticky note real)
        alta: "#FFE0E6",   // Rosa suave
    };

    // Colores preestablecidos disponibles (coinciden con las prioridades)
    const colorPresets = [
        coloresPorPrioridad.baja,   // Verde (Baja)
        coloresPorPrioridad.media,  // Amarillo (Media)
        coloresPorPrioridad.alta,   // Rojo (Alta)
    ];

    // Cargar admins al montar el componente
    useEffect(() => {
        const loadAdmins = async () => {
            setLoadingAdmins(true);
            try {
                const result = await dispatch(obtenerAdminsParaSticknotesThunk(1));

                console.log("🔍 result admin:", result);


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

                console.log("📋 Ejemplo de admin (primer elemento):", adminsData[0]);

                // Filtrar solo los admins con id_rol_admin = 2, 3 o 4
                const filtered = adminsData.filter(
                    (admin) =>admin.id_rol_admin === 1 || admin.id_rol_admin === 2 || admin.id_rol_admin === 3 || admin.id_rol_admin === 4
                );

                console.log("✅ Admins filtrados:", filtered.length, "admins");

                setAdminsFiltered(filtered);
            } catch (error) {
                // Error cargando admins
            } finally {
                setLoadingAdmins(false);
            }
        };
        loadAdmins();
    }, [dispatch]);

    // Efecto para cambiar el color automáticamente cuando cambia la prioridad
    useEffect(() => {
        const colorSegunPrioridad = coloresPorPrioridad[prioridad] || coloresPorPrioridad.media;
        setColorHex(colorSegunPrioridad);
    }, [prioridad]);

    // Llenar el formulario si está editando
    useEffect(() => {
        if (note) {
            setTitulo(note.titulo || "");
            setMensaje(note.mensaje || "");
            const prioridadNota = note.prioridad || "media";
            setPrioridad(prioridadNota);
            // El color se establecerá automáticamente por el useEffect de prioridad
            setColorHex(coloresPorPrioridad[prioridadNota] || coloresPorPrioridad.media);
            setPrivado(note.privado === 1 || false);
            // Si hay usuarios asignados, convertirlos a array
            if (note.id_usuario_asignado && adminsFiltered.length > 0) {
                // Si es un string con IDs separados por coma, convertirlo a array
                const idsArray = Array.isArray(note.id_usuario_asignado) 
                    ? note.id_usuario_asignado 
                    : String(note.id_usuario_asignado).split(',').filter(id => id.trim());
                
                // Buscar los usuarios correspondientes en adminsFiltered
                const usuarios = idsArray
                    .map(id => adminsFiltered.find(a => String(a.idnetsuite_admin) === String(id.trim())))
                    .filter(u => u !== undefined);
                
                setUsuariosAsignados(usuarios);
            } else {
                setUsuariosAsignados([]);
            }
        } else {
            setTitulo("");
            setMensaje("");
            setPrioridad("media");
            // El color se establecerá automáticamente por el useEffect de prioridad
            setColorHex(coloresPorPrioridad.media);
            setPrivado(false);
            setUsuariosAsignados([]);
        }
    }, [note, adminsFiltered]);
    
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
            // Extraer IDs y emails de los usuarios asignados y convertirlos a strings separados por coma
            const idsUsuarios = usuariosAsignados.map(u => u.idnetsuite_admin).filter(id => id !== null && id !== undefined);
            const emailsUsuarios = usuariosAsignados.map(u => u.email_admin).filter(email => email);

            const dataToSend = {
                titulo: titulo.trim(),
                mensaje: mensaje.trim(),
                color_hex: colorHex,
                privado: privado ? 1 : 0,
                id_usuario_asignado: idsUsuarios.length > 0 ? idsUsuarios.join(',') : null,
                email_usuario_asignado: emailsUsuarios.length > 0 ? emailsUsuarios.join(',') : null,
                prioridad: prioridad,
                categoria: "general", // Valor por defecto
            };

            console.log("📤 Datos que se enviarán al crear/editar nota:", dataToSend);

            await onSave(dataToSend);

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
                    borderRadius: 2,
                    boxShadow: "0 4px 24px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.08)",
                    zIndex: 1301,
                    overflow: "hidden",
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    px: 2.5,
                    py: 1.5,
                    backgroundColor: "#1f2937",
                    color: "#ffffff",
                    borderBottom: "1px solid #374151",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <NoteIcon sx={{ fontSize: 20 }} />
                    <Typography variant="h6" component="span" fontWeight={600}>
                        {note ? "Editar Nota" : "Nueva Nota"}
                    </Typography>
                </Box>
                <IconButton
                    onClick={handleClose}
                    aria-label="Cerrar"
                    size="small"
                    sx={{
                        color: "#ffffff",
                        "&:hover": {
                            backgroundColor: "rgba(255, 255, 255, 0.1)",
                        },
                    }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </DialogTitle>

            <form onSubmit={handleSubmit}>
                <DialogContent sx={{ 
                    px: 2.5, 
                    py: 2, 
                    backgroundColor: "transparent",
                    position: "relative",
                }}>
                    <Stack spacing={2}>
                        {/* Sección: Contenido Principal */}
                        <Box>
                            <Stack spacing={1.5}>
                                <TextField
                                    label="Título"
                                    id="titulo"
                                    value={titulo}
                                    onChange={(e) => setTitulo(e.target.value)}
                                    placeholder="Ingrese un título opcional"
                                    inputProps={{ maxLength: 200 }}
                                    fullWidth
                                    variant="outlined"
                                    size="small"
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: 1,
                                            backgroundColor: "#fafafa",
                                            fontSize: "0.875rem",
                                            "&:hover": {
                                                backgroundColor: "#f5f5f5",
                                            },
                                            "&.Mui-focused": {
                                                backgroundColor: "white",
                                                borderColor: "#212121",
                                            },
                                        },
                                        "& .MuiInputLabel-root": {
                                            fontSize: "0.875rem",
                                        },
                                        "& .MuiInputLabel-root.Mui-focused": {
                                            color: "#212121",
                                        },
                                    }}
                                />

                                <TextField
                                    label="Descripción"
                                    id="mensaje"
                                    value={mensaje}
                                    onChange={(e) => setMensaje(e.target.value)}
                                    placeholder="Ingrese el contenido de la nota"
                                    rows={3}
                                    required
                                    fullWidth
                                    multiline
                                    variant="outlined"
                                    size="small"
                                    sx={{
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: 1,
                                            backgroundColor: "#ffffff",
                                            fontSize: "0.875rem",
                                            border: "1px solid #d1d5db",
                                            "&:hover": {
                                                borderColor: "#9ca3af",
                                            },
                                            "&.Mui-focused": {
                                                borderColor: "#1f2937",
                                                boxShadow: "0 0 0 3px rgba(31, 41, 55, 0.1)",
                                            },
                                        },
                                        "& .MuiInputLabel-root": {
                                            fontSize: "0.875rem",
                                            color: "#6b7280",
                                        },
                                        "& .MuiInputLabel-root.Mui-focused": {
                                            color: "#1f2937",
                                        },
                                    }}
                                />
                            </Stack>
                        </Box>

                        {/* Sección: Configuración */}
                        <Box>
                            <Stack spacing={2}>
                                {/* Prioridad */}
                                <Box>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
                                        <PriorityHighIcon sx={{ fontSize: 16, color: "#6b7280" }} />
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontSize: "0.8125rem",
                                                fontWeight: 600,
                                                color: "#374151",
                                            }}
                                        >
                                            Prioridad
                                        </Typography>
                                    </Box>
                                    <TextField
                                        select
                                        value={prioridad}
                                        onChange={(e) => setPrioridad(e.target.value)}
                                        fullWidth
                                        variant="outlined"
                                        size="small"
                                        sx={{
                                            "& .MuiOutlinedInput-root": {
                                                borderRadius: 1,
                                                backgroundColor: "#ffffff",
                                                fontSize: "0.875rem",
                                                border: "1px solid #d1d5db",
                                                "&:hover": {
                                                    borderColor: "#9ca3af",
                                                },
                                                "&.Mui-focused": {
                                                    borderColor: "#1f2937",
                                                    boxShadow: "0 0 0 3px rgba(31, 41, 55, 0.1)",
                                                },
                                            },
                                            "& .MuiInputLabel-root": {
                                                fontSize: "0.875rem",
                                            },
                                        }}
                                    >
                                        <MenuItem value="baja">
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <Box
                                                    sx={{
                                                        width: 10,
                                                        height: 10,
                                                        borderRadius: "50%",
                                                        backgroundColor: coloresPorPrioridad.baja,
                                                        border: "1px solid #d1d5db",
                                                    }}
                                                />
                                                <Typography sx={{ fontSize: "0.875rem" }}>Baja</Typography>
                                            </Box>
                                        </MenuItem>
                                        <MenuItem value="media">
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <Box
                                                    sx={{
                                                        width: 10,
                                                        height: 10,
                                                        borderRadius: "50%",
                                                        backgroundColor: coloresPorPrioridad.media,
                                                        border: "1px solid #d1d5db",
                                                    }}
                                                />
                                                <Typography sx={{ fontSize: "0.875rem" }}>Media</Typography>
                                            </Box>
                                        </MenuItem>
                                        <MenuItem value="alta">
                                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                                <Box
                                                    sx={{
                                                        width: 10,
                                                        height: 10,
                                                        borderRadius: "50%",
                                                        backgroundColor: coloresPorPrioridad.alta,
                                                        border: "1px solid #d1d5db",
                                                    }}
                                                />
                                                <Typography sx={{ fontSize: "0.875rem" }}>Alta</Typography>
                                            </Box>
                                        </MenuItem>
                                    </TextField>
                                </Box>

                                {/* Selector de Color */}
                                <Box>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
                                        <PaletteIcon sx={{ fontSize: 16, color: "#6b7280" }} />
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontSize: "0.8125rem",
                                                fontWeight: 600,
                                                color: "#374151",
                                            }}
                                        >
                                            Color
                                        </Typography>
                                    </Box>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            gap: 1.5,
                                            alignItems: "center",
                                        }}
                                    >
                                        {colorPresets.map((color, index) => {
                                            const isSelected = colorHex === color;
                                            const prioridadAsociada = index === 0 ? "baja" : index === 1 ? "media" : "alta";
                                            const etiquetaPrioridad = index === 0 ? "Baja" : index === 1 ? "Media" : "Alta";
                                            return (
                                                <Box
                                                    key={color}
                                                    onClick={() => {
                                                        setColorHex(color);
                                                        setPrioridad(prioridadAsociada);
                                                    }}
                                                    sx={{
                                                        position: "relative",
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        alignItems: "center",
                                                        gap: 0.5,
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            width: 40,
                                                            height: 40,
                                                            borderRadius: 1,
                                                            backgroundColor: color,
                                                            transition: "all 0.2s ease",
                                                        border: isSelected ? "2px solid" : "1px solid",
                                                        borderColor: isSelected ? "#1f2937" : "#d1d5db",
                                                            boxShadow: isSelected
                                                                ? "0 2px 8px rgba(0, 0, 0, 0.15)"
                                                                : "0 1px 3px rgba(0, 0, 0, 0.08)",
                                                            "&:hover": {
                                                                transform: "translateY(-2px)",
                                                                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15)",
                                                            },
                                                        }}
                                                    />
                                                    <Typography
                                                        variant="caption"
                                                        sx={{
                                                            fontSize: "0.6875rem",
                                                            fontWeight: isSelected ? 600 : 400,
                                                            color: isSelected ? "#1f2937" : "#6b7280",
                                                            textTransform: "uppercase",
                                                        }}
                                                    >
                                                        {etiquetaPrioridad}
                                                    </Typography>
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                </Box>

                                {/* Asignar a Usuario */}
                                <Box>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1 }}>
                                        <PersonIcon sx={{ fontSize: 16, color: "#6b7280" }} />
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                fontSize: "0.8125rem",
                                                fontWeight: 600,
                                                color: "#374151",
                                            }}
                                        >
                                            Asignar a
                                        </Typography>
                                    </Box>
                                    {loadingAdmins ? (
                                        <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
                                            <CircularProgress size={20} />
                                        </Box>
                                    ) : (
                                        <Autocomplete
                                            multiple
                                            options={adminsFiltered}
                                            getOptionLabel={(option) => option.name_admin || ""}
                                            value={usuariosAsignados}
                                            onChange={(event, newValue) => {
                                                // eslint-disable-next-line no-console
                                                console.log("👤 USUARIOS SELECCIONADOS - Array completo:", JSON.stringify(newValue, null, 2));

                                                setUsuariosAsignados(newValue || []);

                                                // eslint-disable-next-line no-console
                                                console.log("✅ ESTADO GUARDADO:", {
                                                    usuarios_asignados: newValue?.map(u => ({
                                                        id: u.idnetsuite_admin,
                                                        nombre: u.name_admin,
                                                        email: u.email_admin
                                                    }))
                                                });
                                            }}
                                            isOptionEqualToValue={(option, value) => 
                                                option.idnetsuite_admin === value.idnetsuite_admin
                                            }
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    placeholder="Seleccione uno o más usuarios"
                                                    variant="outlined"
                                                    size="small"
                                                    sx={{
                                                        "& .MuiOutlinedInput-root": {
                                                            borderRadius: 1,
                                                            backgroundColor: "#ffffff",
                                                            fontSize: "0.875rem",
                                                            border: "1px solid #d1d5db",
                                                            "&:hover": {
                                                                borderColor: "#9ca3af",
                                                            },
                                                            "&.Mui-focused": {
                                                                borderColor: "#1f2937",
                                                                boxShadow: "0 0 0 3px rgba(31, 41, 55, 0.1)",
                                                            },
                                                        },
                                                        "& .MuiInputLabel-root": {
                                                            fontSize: "0.875rem",
                                                        },
                                                    }}
                                                />
                                            )}
                                            renderTags={(value, getTagProps) =>
                                                value.map((option, index) => (
                                                    <Box
                                                        key={option.idnetsuite_admin}
                                                        component="span"
                                                        sx={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            backgroundColor: "#f3f4f6",
                                                            borderRadius: 1,
                                                            padding: "2px 8px",
                                                            margin: "2px",
                                                            fontSize: "0.75rem",
                                                            color: "#374151",
                                                        }}
                                                        {...getTagProps({ index })}
                                                    >
                                                        {option.name_admin}
                                                    </Box>
                                                ))
                                            }
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
                                        p: 1.5,
                                        borderRadius: 1,
                                        border: "1px solid",
                                        borderColor: privado ? "#1f2937" : "#e5e7eb",
                                        backgroundColor: privado ? "#f9fafb" : "#ffffff",
                                        transition: "all 0.2s ease",
                                    }}
                                >
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
                                        <LockIcon sx={{ fontSize: 16, color: privado ? "#1f2937" : "#6b7280" }} />
                                        <Box>
                                            <Typography variant="body2" fontWeight={500} sx={{ fontSize: "0.8125rem", color: "#374151" }}>
                                                Nota privada
                                            </Typography>
                                            <Typography variant="caption" sx={{ fontSize: "0.6875rem", color: "#6b7280" }}>
                                                Solo visible para ti
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Switch
                                        checked={privado}
                                        onChange={(e) => setPrivado(e.target.checked)}
                                        size="small"
                                        sx={{
                                            "& .MuiSwitch-switchBase.Mui-checked": {
                                                color: "#1f2937",
                                            },
                                            "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                                backgroundColor: "#374151",
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
                        px: 2.5,
                        py: 1.5,
                        borderTop: "1px solid #e5e7eb",
                        gap: 1.5,
                        backgroundColor: "#f9fafb",
                    }}
                >
                    <Button
                        onClick={handleClose}
                        variant="outlined"
                        sx={{
                            borderRadius: 1,
                            textTransform: "none",
                            px: 2.5,
                            py: 0.75,
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            borderColor: "#d1d5db",
                            color: "#374151",
                            "&:hover": {
                                borderColor: "#9ca3af",
                                backgroundColor: "#f3f4f6",
                            },
                        }}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        sx={{
                            borderRadius: 1,
                            textTransform: "none",
                            px: 2.5,
                            py: 0.75,
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            backgroundColor: "#1f2937",
                            color: "#ffffff",
                            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                            "&:hover": {
                                backgroundColor: "#111827",
                                boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                            },
                            transition: "all 0.2s ease",
                        }}
                    >
                        {note ? "Actualizar" : "Crear"}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default ModalSticNote;
