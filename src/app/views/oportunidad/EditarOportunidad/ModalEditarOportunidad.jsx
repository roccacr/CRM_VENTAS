import React, { useState, useEffect } from "react";
import { Modal, Box, TextField, Button, Grid, MenuItem, Switch, Typography } from "@mui/material";

export const ModalEditarOportunidad = ({ open, onClose, OportunidadDetails }) => {

    console.log(OportunidadDetails);
    const [formData, setFormData] = useState({
        probabilidad: "80.0%",
        firme: "Firme",
        detalles: "Introduzca información adicional sobre la oportunidad.",
        estado: "22",
        motivoCondicion: "",
        cierrePrevisto: false,
        ultimoDiaCierre: "2025-08-04",
        nuevoValorAsignar: "11/15/2024",
        motivoCompra: "Inversión",
        metodoPago: "Contra Entrega",
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
                cierrePrevisto: false,
                ultimoDiaCierre: OportunidadDetails.fecha_Condicion || "2025-08-04",
                nuevoValorAsignar: OportunidadDetails.expectedclosedate_oport || "2025-09-29",
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
                // Firme = 80%
                updatedFormData.probabilidad = "80.0%";
            } else if (value === "11") {
                // Condicional = 50%
                updatedFormData.probabilidad = "50.0%";
            }
        }

        setFormData(updatedFormData);
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
                            disabled
                            sx={{ marginBottom: 3 }}
                        />
                        <TextField
                            fullWidth
                            label="Tipo de Estado"
                            name="firme"
                            value={formData.firme}
                            disabled
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
                            select
                            value={formData.estado}
                            onChange={handleChange}
                            error={errors.estado}
                            helperText={errors.estado ? "Campo obligatorio" : ""}
                            sx={{ marginBottom: 3 }}
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
                            error={errors.motivoCondicion && formData.estado === "11"}
                            helperText={errors.motivoCondicion && formData.estado === "11" ? "Campo obligatorio" : ""}
                            sx={{ marginBottom: 3 }}
                        >
                            <MenuItem value="">Escoger ...</MenuItem>
                            <MenuItem value="Esperando un negocio">Esperando un negocio</MenuItem>
                            <MenuItem value="Viendo opciones">Viendo opciones</MenuItem>
                            <MenuItem value="Depende la venta de la casa">Depende la venta de la casa</MenuItem>
                            <MenuItem value="Definiendo Prima">Definiendo Prima</MenuItem>
                            <MenuItem value="Análisis de banco">Análisis de banco</MenuItem>
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
                            select
                            value={formData.motivoCompra}
                            onChange={handleChange}
                            error={errors.motivoCompra}
                            helperText={errors.motivoCompra ? "Campo obligatorio" : ""}
                            sx={{ marginBottom: 3 }}
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
                            error={errors.metodoPago}
                            helperText={errors.metodoPago ? "Campo obligatorio" : ""}
                            sx={{ marginBottom: 3 }}
                        >
                            <MenuItem value="">Seleccionar</MenuItem>
                            <MenuItem value="2">Avance De Obra</MenuItem>
                            <MenuItem value="7">Avance Diferenciado</MenuItem>
                            <MenuItem value="1">Contra Entrega</MenuItem>
                        </TextField>
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
