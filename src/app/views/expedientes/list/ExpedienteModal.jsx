import React from "react";
import { Modal, Box, Typography } from "@mui/material";
import Swal from "sweetalert2";
import { useDispatch } from "react-redux";
import { actualizarExpediente } from "../../../../store/expedientes/thunksExpedientes";
import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

// Constants
const DIALOG_MESSAGES = {
   UPDATE_CONFIRMATION: "¿Realmente deseas actualizar el expediente de unidad:",
   UPDATING: "Por favor, espera mientras se actualiza el expediente de unidad.",
   SUCCESS: "El expediente de unidad se ha actualizado correctamente.",
   ERROR: "Hubo un problema al actualizar el expediente. Por favor, inténtalo de nuevo.",
};

/**
 * Dialog utility functions for handling user interactions
 * @namespace DialogUtils
 */
const DialogUtils = {
   /**
    * Shows a confirmation dialog before updating
    * @param {string} nombre_expediente - Name of the expedition
    * @returns {Promise<boolean>} True if confirmed, false otherwise
    */
   showConfirmation: async (nombre_expediente) => {
      const result = await Swal.fire({
         title: "¿Estás seguro?",
         text: `${DIALOG_MESSAGES.UPDATE_CONFIRMATION} ${nombre_expediente}? Esto puede tardar alrededor de 1 minuto y 30 segundos.`,
         icon: "warning",
         showCancelButton: true,
         confirmButtonColor: "#3085d6",
         cancelButtonColor: "#d33",
         confirmButtonText: "Sí, actualizar",
         cancelButtonText: "Cancelar",
      });
      return result.isConfirmed;
   },

   showLoading: () => {
      Swal.fire({
         title: "Actualizando...",
         text: DIALOG_MESSAGES.UPDATING,
         icon: "info",
         allowOutsideClick: false,
         showConfirmButton: false,
         didOpen: () => {
            Swal.showLoading();
         },
      });
   },

   showSuccess: async () => {
      await Swal.fire({
         title: "¡Actualizado!",
         text: DIALOG_MESSAGES.SUCCESS,
         icon: "success",
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
   },

   showError: () => {
      Swal.fire({
         title: "Error",
         text: DIALOG_MESSAGES.ERROR,
         icon: "error",
      });
   },
};

/**
 * Renders expedition details in a grouped format
 * @component
 */
const ExpedienteDetails = ({ expediente }) => {
   const renderFieldGroups = () => {
      return (
         <>
            {expediente && (
               <>
                  {[
                     [
                        { label: "Código Expediente", value: expediente.codigo_exp },
                        { label: "Proyecto Principal", value: expediente.proyectoPrincipal_exp },
                        { label: "Tipo de Vivienda", value: expediente.tipoDeVivienda_exp },
                     ],
                     [
                        { label: "Precio Venta Único", value: expediente.precioVentaUncio_exp },
                        { label: "Estado", value: expediente.estado_exp },
                        { label: "Entrega Estimada", value: expediente.entregaEstimada },
                     ],
                     [
                        { label: "Área Total M²", value: expediente.areaTotalM2_exp },
                        { label: "M² Habitables", value: expediente.m2Habitables_exp },
                        { label: "Lote M²", value: expediente.loteM2_exp },
                     ],
                     [
                        { label: "Área de Parqueo Aprox.", value: expediente.areaDeParqueoAprox },
                        { label: "Área de Bodega M²", value: expediente.areaDeBodegaM2_exp },
                        { label: "Área de Mezzanine M²", value: expediente.areaDeMezzanieM2_exp },
                     ],
                     [
                        { label: "Área Común Libre", value: expediente.areacomunLibe_exp },
                        { label: "Precio de Venta Mínimo", value: expediente.precioDeVentaMinimo },
                        {
                           label: "Planos de Unidad",
                           value: expediente.planosDeUnidad_exp ? (
                              <a
                                 href={expediente.planosDeUnidad_exp}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 style={{ textDecoration: "none", fontWeight: "bold" }}
                              >
                                 Ver Planos
                              </a>
                           ) : (
                              "N/A"
                           ),
                        },
                     ],
                     [
                        { label: "Cuota Mantenimiento Aproximada", value: expediente.cuotaMantenimientoAprox_exp },
                        { label: "Área de Balcón M²", value: expediente.areaDeBalconM2_exp },
                        { label: "Área de Planta Baja", value: expediente.areaDePlantaBaja_exp },
                     ],
                     [
                        { label: "Área de Planta Alta", value: expediente.areaDePlantaAlta_exp },
                        { label: "Área de Ampliación", value: expediente.areaDeAmpliacion_exp },
                        { label: "Área de Terraza", value: expediente.areaDeTerraza_exp },
                     ],
                     [
                        { label: "Precio por M²", value: expediente.precioPorM2_exp },
                        { label: "Tercer Nivel Sótano", value: expediente.tercerNivelSotano_exp },
                        { label: "Área Externa Jardín", value: expediente.areaExternaJardin_exp },
                     ],
                     [
                        { label: "Jardín con Talud", value: expediente.jardinConTalud_exp },
                        { label: "Fecha de Modificación", value: expediente.fecha_mod },
                     ],
                  ].map((group, index) => (
                     <Box
                        key={index}
                        sx={{
                           display: "flex",
                           justifyContent: "space-between",
                           flexWrap: "wrap",
                           borderBottom: "1px solid #ccc",
                           pb: 2,
                           mb: 2,
                           gap: window.innerWidth < 600 ? "16px" : "0",
                        }}
                     >
                        {group.map((item, i) => (
                           <Box key={i} sx={{ flex: { xs: "1 0 45%", sm: "1 0 30%" } }}>
                              <p>{item.label}</p>
                              {typeof item.value === "string" ? <strong>{item.value || "N"}</strong> : item.value}
                           </Box>
                        ))}
                     </Box>
                  ))}
               </>
            )}
         </>
      );
   };

   return <div className="expediente-details">{renderFieldGroups()}</div>;
};

/**
 * Action buttons component for expedition operations
 * @component
 */
const ExpedienteActions = ({ expediente, onUpdate, onAssign }) => (
   <div className="expediente-actions">
      <button onClick={() => onUpdate(expediente.ID_interno_expediente, expediente.codigo_exp)} className="btn btn-dark">
         Sincronizar expediente de unidad
      </button>
      <button onClick={() => onAssign(expediente.ID_interno_expediente)} className="btn btn-primary">
         Asignar a una oportunidad
      </button>
   </div>
);

/**
 * Main modal component for expedition management
 * @component
 */
const ExpedienteModal = ({ isOpen, onClose, expediente }) => {
   const dispatch = useDispatch();
   const navigate = useNavigate();

   /**
    * Handles the expedition update process
    * @async
    * @param {string|number} id_expediente - Expedition ID
    * @param {string} nombre_expediente - Expedition name
    */
   const handleExpedienteUpdate = async (id_expediente, nombre_expediente) => {
      onClose();

      try {
         const shouldUpdate = await DialogUtils.showConfirmation(nombre_expediente);
         if (!shouldUpdate) return;

         DialogUtils.showLoading();
         await dispatch(actualizarExpediente(id_expediente));
         await DialogUtils.showSuccess();
         window.location.reload();
      } catch (error) {
         DialogUtils.showError();
      }
   };

   /**
    * Navigates to opportunity creation with expedition context
    * @param {string|number} id_expediente - Expedition ID
    */
   const handleOportunidadAssignment = (id_expediente) => {
      navigate(`/oportunidad/crear?idExpediente=${id_expediente}&idLead=0`);
   };

   return (
      <Modal open={isOpen} onClose={onClose} sx={modalStyles}>
         <Box sx={modalContentStyles}>
            <Typography variant="h6" component="h2">
               Detalles del Expediente
            </Typography>
            {expediente && (
               <>
                  <ExpedienteDetails expediente={expediente} />
                  <ExpedienteActions expediente={expediente} onUpdate={handleExpedienteUpdate} onAssign={handleOportunidadAssignment} />
               </>
            )}
         </Box>
      </Modal>
   );
};

// Styles
const modalStyles = {
   display: "flex",
   alignItems: "flex-start",
   justifyContent: "center",
};

const modalContentStyles = {
   position: "absolute",
   top: "10px",
   width: "70%",
   height: "95vh",
   bgcolor: "background.paper",
   boxShadow: 50,
   p: 2,
   overflowY: "auto",
};

// PropTypes definitions
const expedientePropType = PropTypes.shape({
   ID_interno_expediente: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
   codigo_exp: PropTypes.string.isRequired,
   // ... add other expedition properties
});

ExpedienteModal.propTypes = {
   isOpen: PropTypes.bool.isRequired,
   onClose: PropTypes.func.isRequired,
   expediente: expedientePropType,
};

ExpedienteDetails.propTypes = {
   expediente: expedientePropType.isRequired,
};

ExpedienteActions.propTypes = {
   expediente: expedientePropType.isRequired,
   onUpdate: PropTypes.func.isRequired,
   onAssign: PropTypes.func.isRequired,
};

export default ExpedienteModal;
