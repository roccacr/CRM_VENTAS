import React, { useState } from "react";
import { Modal, Box, TextField, Button, Grid, MenuItem, Switch, Typography } from "@mui/material";

export const ModalEditarOportunidad = ({ open, onClose, OportunidadDetails }) => {
    const [formData, setFormData] = useState({
        probabilidad: "80.0%",
        firme: "Firme",
        detalles: "Introduzca información adicional sobre la oportunidad.",
        estado: "B- Firme",
        motivoCondicion: "",
        cierrePrevisto: false,
        ultimoDiaCierre: "2025-08-04",
        nuevoValorAsignar: "11/15/2024",
        motivoCompra: "Inversión",
        metodoPago: "Contra Entrega",
    });

    const [errors, setErrors] = useState({});

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevState) => ({
            ...prevState,
            [name]: value,
        }));
    };

    const handleSwitchChange = (e) => {
        setFormData((prevState) => ({
            ...prevState,
            cierrePrevisto: e.target.checked,
        }));
    };

    const validateForm = () => {
        const newErrors = {};
        Object.keys(formData).forEach((key) => {
            if (formData[key].toString().trim() === "") {
                newErrors[key] = true;
            }
        });
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
                    gap: 2,
                    width: 800,
                    margin: "50px auto",
                    padding: 4,
                    backgroundColor: "#fff",
                    borderRadius: 2,
                    boxShadow: 24,
                }}
            >
                <h3>Editar Oportunidad</h3>
                <Grid container spacing={3}>
                    {/* Información Principal */}
                    <Grid item xs={6}>
                        <Typography variant="h6">Información Principal</Typography>
                        <TextField
                            fullWidth
                            label="Probabilidad"
                            name="probabilidad"
                            value={formData.probabilidad}
                            onChange={handleChange}
                            error={errors.probabilidad}
                            helperText={errors.probabilidad ? "Campo obligatorio" : ""}
                            sx={{ marginBottom: 3 }}
                        />
                        <TextField
                            fullWidth
                            label="Firme"
                            name="firme"
                            value={formData.firme}
                            onChange={handleChange}
                            error={errors.firme}
                            helperText={errors.firme ? "Campo obligatorio" : ""}
                            sx={{ marginBottom: 3 }}
                        />
                        <TextField
                            fullWidth
                            multiline
                            rows={4}
                            label="Detalles"
                            name="detalles"
                            value={formData.detalles}
                            onChange={handleChange}
                            error={errors.detalles}
                            helperText={errors.detalles ? "Campo obligatorio" : ""}
                            sx={{ marginBottom: 3 }}
                        />
                    </Grid>

                    {/* Información Obligatoria */}
                    <Grid item xs={6}>
                        <Typography variant="h6">Información Obligatoria</Typography>
                        <TextField
                            fullWidth
                            label="Estado"
                            name="estado"
                            value={formData.estado}
                            onChange={handleChange}
                            error={errors.estado}
                            helperText={errors.estado ? "Campo obligatorio" : ""}
                            sx={{ marginBottom: 3 }}
                        />
                        <TextField
                            fullWidth
                            label="Motivo de Condición"
                            name="motivoCondicion"
                            select
                            value={formData.motivoCondicion}
                            onChange={handleChange}
                            error={errors.motivoCondicion}
                            helperText={errors.motivoCondicion ? "Campo obligatorio" : ""}
                            sx={{ marginBottom: 3 }}
                        >
                            <MenuItem value="">Escoger...</MenuItem>
                            <MenuItem value="Condición A">Condición A</MenuItem>
                            <MenuItem value="Condición B">Condición B</MenuItem>
                        </TextField>
                        <Box display="flex" alignItems="center" gap={2} sx={{ marginBottom: 3 }}>
                            <Typography>Cierre Previsto Según el Estado</Typography>
                            <Switch checked={formData.cierrePrevisto} onChange={handleSwitchChange} name="cierrePrevisto" />
                        </Box>
                        {formData.cierrePrevisto && (
                            <TextField
                                fullWidth
                                label="Último Día de Cierre Asignado"
                                value={formData.ultimoDiaCierre}
                                disabled
                                sx={{ marginBottom: 3 }}
                            />
                        )}
                        <TextField
                            fullWidth
                            label="Nuevo Valor a Asignar"
                            name="nuevoValorAsignar"
                            type="date"
                            value={formData.nuevoValorAsignar}
                            onChange={handleChange}
                            error={errors.nuevoValorAsignar}
                            helperText={errors.nuevoValorAsignar ? "Campo obligatorio" : ""}
                            sx={{ marginBottom: 3 }}
                        />
                        <TextField
                            fullWidth
                            label="Motivo de Compra"
                            name="motivoCompra"
                            value={formData.motivoCompra}
                            onChange={handleChange}
                            error={errors.motivoCompra}
                            helperText={errors.motivoCompra ? "Campo obligatorio" : ""}
                            sx={{ marginBottom: 3 }}
                        />
                        <TextField
                            fullWidth
                            label="Método de Pago"
                            name="metodoPago"
                            value={formData.metodoPago}
                            onChange={handleChange}
                            error={errors.metodoPago}
                            helperText={errors.metodoPago ? "Campo obligatorio" : ""}
                            sx={{ marginBottom: 3 }}
                        />
                    </Grid>
                </Grid>

                <Grid container justifyContent="flex-end" spacing={2}>
                    <Grid item>
                        <Button variant="contained" color="secondary" onClick={onClose}>
                            Cancelar
                        </Button>
                    </Grid>
                    <Grid item>
                        <Button variant="contained" color="primary" onClick={handleSubmit}>
                            Guardar Cambios
                        </Button>
                    </Grid>
                </Grid>
            </Box>
        </Modal>
    );
};
