import React, { useState, useEffect } from "react";
import { Modal, Box, TextField, Button, Grid, MenuItem, Typography, Divider, Paper } from "@mui/material";

export const ModalEditarOportunidad = ({ open, onClose, OportunidadDetails }) => {

    console.log(OportunidadDetails);
    const [formData, setFormData] = useState({
        probabilidad: "80.0%",
        firme: "Firme",
        detalles: "Introduzca información adicional sobre la oportunidad.",
        estado: "22",
        motivoCondicion: "",
        motivoCompra: "",
        metodoPago: "",
    });

    // Cargar datos cuando OportunidadDetails cambia
    useEffect(() => {
        if (OportunidadDetails && open) {
            setFormData({
                probabilidad: OportunidadDetails.probability_oport || "80.0%",
                firme: "",
                detalles: OportunidadDetails.memo_oport || "SIN DETALLE",
                estado: String(OportunidadDetails.entitystatus_oport) || "22",
                motivoCondicion: OportunidadDetails.Motico_Condicion || "",
                motivoCompra: String(OportunidadDetails.custbody76_oport) || "",
                metodoPago: String(OportunidadDetails.custbody75_oport) || "",
            });
        }
    }, [OportunidadDetails, open]);

    // Actualizar el campo "Firme" según el estado
    useEffect(() => {
        if (formData.estado === "22") {
            setFormData((prev) => ({ ...prev, firme: "Firme" }));
        } else if (formData.estado === "11") {
            setFormData((prev) => ({ ...prev, firme: "Condicional" }));
        }
    }, [formData.estado]);

    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        const updatedFormData = {
            ...formData,
            [name]: value,
        };

        // Si el campo que cambia es "estado", actualizar la probabilidad automáticamente
        if (name === "estado") {
            if (value === "22") {
                updatedFormData.probabilidad = "80.0%";
                updatedFormData.motivoCondicion = "";
                setErrors((prev) => ({ ...prev, motivoCondicion: false }));
            } else if (value === "11") {
                updatedFormData.probabilidad = "50.0%";
            }
        }

        setFormData(updatedFormData);
        setErrors((prev) => ({ ...prev, [name]: false }));
    };

    const validateForm = () => {
        const newErrors = {};
        const requiredFields = ["detalles", "estado", "motivoCompra", "metodoPago"];

        requiredFields.forEach((field) => {
            if (!formData[field] || formData[field].toString().trim() === "") {
                newErrors[field] = true;
            }
        });

        if (formData.estado === "11" && (!formData.motivoCondicion || formData.motivoCondicion.trim() === "")) {
            newErrors.motivoCondicion = true;
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = () => {
        if (validateForm()) {
            alert("Se registró la oportunidad exitosamente");
            onClose();
        } else {
            alert("Por favor complete todos los campos obligatorios");
        }
    };

    return (
        <Modal open={open} onClose={onClose}>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    width: 820,
                    maxHeight: "90vh",
                    overflowY: "auto",
                    margin: "40px auto",
                    padding: 4,
                    backgroundColor: "#f7f9fc",
                    borderRadius: 3,
                    boxShadow: 24,
                }}
            >
                <Box>
                    <Typography variant="h5" fontWeight={600} gutterBottom>
                        Editar Oportunidad
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Ajusta la información antes de guardar los cambios.
                    </Typography>
                </Box>
                <Divider />
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: 3,
                                borderRadius: 2,
                                backgroundColor: "#ffffff",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                            }}
                        >
                            <Typography variant="subtitle1" color="primary" fontWeight={600}>
                                Información Principal
                            </Typography>
                            <TextField fullWidth label="Probabilidad" name="probabilidad" value={formData.probabilidad} disabled />
                            <TextField fullWidth label="Tipo de Estado" name="firme" value={formData.firme} disabled />
                            <TextField
                                fullWidth
                                multiline
                                minRows={5}
                                label="Detalles"
                                name="detalles"
                                value={formData.detalles}
                                onChange={handleChange}
                                error={Boolean(errors.detalles)}
                                helperText={errors.detalles ? "Campo obligatorio" : ""}
                            />
                        </Paper>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: 3,
                                borderRadius: 2,
                                backgroundColor: "#ffffff",
                                height: "100%",
                                display: "flex",
                                flexDirection: "column",
                                gap: 2,
                            }}
                        >
                            <Typography variant="subtitle1" color="primary" fontWeight={600}>
                                Información Complementaria
                            </Typography>
                            <TextField
                                fullWidth
                                label="Estado"
                                name="estado"
                                select
                                value={formData.estado}
                                onChange={handleChange}
                                error={Boolean(errors.estado)}
                                helperText={errors.estado ? "Campo obligatorio" : ""}
                            >
                                <MenuItem value="22">Firme</MenuItem>
                                <MenuItem value="11">Condicional</MenuItem>
                            </TextField>
                            <TextField
                                fullWidth
                                label="Motivo de Condición"
                                name="motivoCondicion"
                                select
                                value={formData.motivoCondicion}
                                onChange={handleChange}
                                disabled={formData.estado === "22"}
                                error={Boolean(errors.motivoCondicion) && formData.estado === "11"}
                                helperText={errors.motivoCondicion && formData.estado === "11" ? "Campo obligatorio" : ""}
                            >
                                <MenuItem value="">Escoger ...</MenuItem>
                                <MenuItem value="Esperando un negocio">Esperando un negocio</MenuItem>
                                <MenuItem value="Viendo opciones">Viendo opciones</MenuItem>
                                <MenuItem value="Depende la venta de la casa">Depende la venta de la casa</MenuItem>
                                <MenuItem value="Definiendo Prima">Definiendo Prima</MenuItem>
                                <MenuItem value="Análisis de banco">Análisis de banco</MenuItem>
                            </TextField>
                            <TextField
                                fullWidth
                                label="Motivo de Compra"
                                name="motivoCompra"
                                select
                                value={formData.motivoCompra}
                                onChange={handleChange}
                                error={Boolean(errors.motivoCompra)}
                                helperText={errors.motivoCompra ? "Campo obligatorio" : ""}
                            >
                                <MenuItem value="">Seleccionar...</MenuItem>
                                <MenuItem value="1">Primera Casa</MenuItem>
                                <MenuItem value="4">Inversión</MenuItem>
                            </TextField>
                            <TextField
                                fullWidth
                                label="Método de Pago"
                                name="metodoPago"
                                select
                                value={formData.metodoPago}
                                onChange={handleChange}
                                error={Boolean(errors.metodoPago)}
                                helperText={errors.metodoPago ? "Campo obligatorio" : ""}
                            >
                                <MenuItem value="">Seleccionar</MenuItem>
                                <MenuItem value="2">Avance De Obra</MenuItem>
                                <MenuItem value="7">Avance Diferenciado</MenuItem>
                                <MenuItem value="1">Contra Entrega</MenuItem>
                            </TextField>
                        </Paper>
                    </Grid>
                </Grid>
                <Divider />
                <Box display="flex" justifyContent="flex-end" gap={2}>
                    <Button variant="outlined" color="inherit" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button variant="contained" color="primary" onClick={handleSubmit}>
                        Guardar Cambios
                    </Button>
                </Box>
            </Box>
        </Modal>
    );
};
