import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import Select from "react-select";
import Swal from "sweetalert2";

import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import { getFileList } from "../../../../store/expedientes/thunksExpedientes";
import { getLeadsComplete, getSpecificLead } from "../../../../store/leads/thunksLeads";
import {
   crearOportunidad,
   crearReoporteLead,
   fetchValidardisponibilidad,
   getfetch_Clases,
   getfetch_Ubicaciones,
   updateEstadoOportunidad,
} from "../../../../store/oportuinidad/thunkOportunidad";
import { PROFILE_PANEL_STYLES, PROFILE_THEME_STYLES } from "../../leads/perfil/profileTheme";

const OPPORTUNITY_CREATE_STYLES = `
    ${PROFILE_THEME_STYLES}

    .opportunity-create-shell .lead-profile-panel {
        padding: 18px;
    }

    .opportunity-create-toolbar {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 12px;
    }

    .opportunity-create-grid {
        display: grid;
        gap: 12px;
    }

    .opportunity-create-two-columns {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
    }

    .opportunity-create-three-columns {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
    }

    .opportunity-create-field {
        display: grid;
        gap: 6px;
    }

    .opportunity-create-field label,
    .opportunity-create-inline-label {
        display: inline-block;
        margin: 0;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #6b7280;
    }

    .opportunity-create-field .form-control,
    .opportunity-create-field .form-select,
    .opportunity-create-field .input-group-text {
        min-height: 44px;
        border-radius: 12px;
        border-color: #d1d5db;
        box-shadow: none;
        font-size: 13px;
    }

    .opportunity-create-field .form-control:focus,
    .opportunity-create-field .form-select:focus {
        border-color: #111827;
        box-shadow: 0 0 0 4px rgba(17, 24, 39, 0.08);
    }

    .opportunity-create-field textarea.form-control {
        min-height: 160px;
        resize: vertical;
        padding-top: 12px;
    }

    .opportunity-create-field .form-control:disabled,
    .opportunity-create-field .form-select:disabled {
        background: #f8fafc;
        color: #4b5563;
    }

    .opportunity-create-static-note {
        margin: 0;
        padding: 12px 14px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: #fbfbfc;
        font-size: 12px;
        line-height: 1.55;
        color: #4b5563;
    }

    .opportunity-create-date-box {
        display: grid;
        gap: 8px;
        padding: 12px 14px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: #fbfbfc;
    }

    .opportunity-create-date-copy {
        margin: 0;
        font-size: 11px;
        color: #6b7280;
    }

    .opportunity-create-date-copy strong {
        color: #111827;
    }

    .opportunity-create-expediente-grid {
        display: grid;
        grid-template-columns: 1.25fr 1fr;
        gap: 12px;
    }

    .opportunity-create-box {
        padding: 14px;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
    }

    .opportunity-create-box-title {
        margin: 0 0 10px;
        font-size: 13px;
        font-weight: 700;
        color: #111827;
    }

    .opportunity-create-loading,
    .opportunity-create-empty {
        margin: 0;
        padding: 12px 14px;
        border: 1px dashed #d1d5db;
        border-radius: 12px;
        background: #fbfbfc;
        font-size: 12px;
        color: #6b7280;
        text-align: center;
    }

    .opportunity-create-summary {
        display: grid;
        gap: 10px;
    }

    .opportunity-create-summary-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 0;
        border-bottom: 1px solid #eceff3;
    }

    .opportunity-create-summary-row:last-child {
        padding-bottom: 0;
        border-bottom: none;
    }

    .opportunity-create-summary-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        font-weight: 600;
        color: #374151;
    }

    .opportunity-create-summary-label i {
        font-size: 15px;
        color: #6b7280;
    }

    .opportunity-create-summary-value {
        text-align: right;
    }

    .opportunity-create-summary-value strong {
        display: block;
        font-size: 15px;
        line-height: 1.1;
        color: #111827;
    }

    .opportunity-create-badges {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 6px;
        margin-top: 6px;
    }

    .opportunity-create-badge {
        display: inline-flex;
        align-items: center;
        min-height: 22px;
        padding: 0 8px;
        border-radius: 999px;
        background: #f3f4f6;
        font-size: 11px;
        font-weight: 600;
        color: #4b5563;
    }

    .opportunity-create-data-grid {
        display: grid;
        gap: 10px;
    }

    .opportunity-create-data-item {
        padding: 12px 14px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background: #ffffff;
    }

    .opportunity-create-data-item span {
        display: block;
        margin-bottom: 4px;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: #6b7280;
    }

    .opportunity-create-data-item strong {
        display: block;
        font-size: 14px;
        line-height: 1.35;
        color: #111827;
        word-break: break-word;
    }

    .opportunity-create-invalid {
        margin: 0;
        font-size: 11px;
        color: #b91c1c;
    }

    .opportunity-create-footer {
        display: flex;
        justify-content: flex-end;
        margin-top: 14px;
    }

    .opportunity-create-submit {
        min-width: 220px;
        min-height: 46px;
        border: none;
        border-radius: 999px;
        background: #111827;
        color: #ffffff;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.01em;
        transition: transform 0.16s ease, box-shadow 0.16s ease;
        box-shadow: 0 14px 28px rgba(17, 24, 39, 0.18);
    }

    .opportunity-create-submit:hover {
        transform: translateY(-1px);
        box-shadow: 0 18px 34px rgba(17, 24, 39, 0.2);
    }

    .opportunity-create-submit i {
        margin-right: 6px;
    }

    @media (max-width: 991px) {
        .opportunity-create-two-columns,
        .opportunity-create-three-columns,
        .opportunity-create-expediente-grid {
            grid-template-columns: 1fr;
        }
    }
`;

const selectControlStyles = (hasError, isDisabled = false) => ({
   control: (base, state) => ({
      ...base,
      minHeight: 44,
      borderRadius: 12,
      borderColor: hasError ? "#dc2626" : state.isFocused ? "#111827" : "#d1d5db",
      boxShadow: state.isFocused ? "0 0 0 4px rgba(17, 24, 39, 0.08)" : "none",
      backgroundColor: isDisabled ? "#f8fafc" : "#ffffff",
      opacity: isDisabled ? 0.7 : 1,
      "&:hover": {
         borderColor: hasError ? "#dc2626" : "#111827",
      },
   }),
   valueContainer: (base) => ({
      ...base,
      padding: "4px 12px",
   }),
   indicatorSeparator: (base) => ({
      ...base,
      backgroundColor: "#e5e7eb",
   }),
   placeholder: (base) => ({
      ...base,
      color: "#9ca3af",
      fontSize: 13,
   }),
   singleValue: (base) => ({
      ...base,
      color: "#111827",
      fontSize: 13,
   }),
   menu: (base) => ({
      ...base,
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 18px 40px rgba(15, 23, 42, 0.12)",
   }),
});

const currencyFormatter = new Intl.NumberFormat("es-CR", {
   minimumFractionDigits: 2,
   maximumFractionDigits: 2,
});

const availabilityLabelMap = {
   oportunidades: "Oportunidades",
   estimaciones: "Estimaciones",
   ordenesVenta: "Órdenes de venta",
   ordenes_venta: "Órdenes de venta",
   ov: "Órdenes de venta",
};

const availabilityIconMap = {
   oportunidades: "mdi mdi-briefcase-outline",
   estimaciones: "mdi mdi-file-document-outline",
   ordenesVenta: "mdi mdi-file-check-outline",
   ordenes_venta: "mdi mdi-file-check-outline",
   ov: "mdi mdi-file-check-outline",
};

/**
 * Devuelve una fecha formateada en el formato "dd/MM/yyyy" para la región de Costa Rica ("es-CR").
 * La fecha resultante es la fecha actual más la cantidad de días especificada como parámetro.
 *
 * @param {number} suma - Número de días sumar la fecha actual (puede ser positivo o negativo).
 * @returns {string} - Fecha formateada como "dd/MM/yyyy".
 */
const getFormattedDate = (suma) => {
   const today = new Date();
   today.setDate(today.getDate() + suma);

   return new Intl.DateTimeFormat("es-CR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
   }).format(today);
};

const formatCurrencyValue = (value) => {
   const amount = Number(value || 0) / 100;
   return currencyFormatter.format(amount);
};

const toDisplayValue = (value) => {
   if (value === null || value === undefined || value === "") {
      return "N/A";
   }

   return value;
};

const getAvailabilityEntries = (availability) => {
   if (!availability || typeof availability !== "object") {
      return [];
   }

   return Object.entries(availability).filter(([, value]) => {
      return value && typeof value === "object" && !Array.isArray(value);
   });
};

const getAvailabilityBadges = (sectionValue = {}) => {
   return Object.entries(sectionValue)
      .filter(([key, value]) => key !== "total" && Number(value) > 0)
      .map(([key, value]) => ({
         key,
         label: `${value} ${key}`,
      }));
};

export const Crear_Oportunidad = () => {
   const [leadDetails, setLeadDetails] = useState({});
   const dispatch = useDispatch();
   const [leadsOptions, setClasesOptions] = useState([]);
   const [ubicacionOptions, setUbicacionOptions] = useState([]);
   const [expedienteOptions, setExpedienteOptions] = useState([]);
   const [clientesOptions, setClientesOptions] = useState([]);
   const [formValues, setFormValues] = useState({
      clientesPoyrecto: 0,
      clientes: "",
      clienteAsignado: "",
      probabilidad: "80.0%",
      nombreValor: "Firme",
      subsidiaria: "",
      proyecto: "",
      memo: "SIN DETALLE",
      estado: "22",
      motivoCondicion: "",
      motivoCompra: "",
      metodoPago: "",
      ubicacion: "",
      clase: "",
      expediente: "",
      idInternoExpediente: "",
      estadoExpediente: "",
      nombreExpediente: "",
      precioLista: "",
      precioMinimo: "",
      salesRep: "",
      currency: "1",
      fechaCierrePrevista: getFormattedDate(7),
      fechaActual: new Date().toLocaleDateString(),
   });
   const [isMotivoCondicionEnabled, setIsMotivoCondicionEnabled] = useState(false);
   const [fechaActualComparar] = useState(getFormattedDate(0));
   const [loadingExpediente, setLoadingExpediente] = useState(false);
   const [disponibilidadExpediente, setDisponibilidadExpediente] = useState(null);
   const [loadingDisponibilidad, setLoadingDisponibilidad] = useState(false);
   const [errors, setErrors] = useState({});

   const fetchLeadDetails = async (idEvent) => {
      try {
         const leadData = await dispatch(getSpecificLead(idEvent));

         setFormValues((prevState) => ({
            ...prevState,
            clienteAsignado: `${leadData.nombre_lead} - ${leadData.proyecto_lead} `,
            subsidiaria: leadData.subsidiaria_lead,
            proyecto: leadData.proyecto_lead,
            clientes: idEvent,
            clientesPoyrecto: leadData.idproyecto_lead,
         }));

         setLeadDetails(leadData);
         const idExpediente = getQueryParam("idExpediente");
         fetchExpedientes(idExpediente, leadData.idproyecto_lead);
      } catch (error) {
         console.error("Error al obtener los detalles del lead:", error);
      }
   };

   const fetchUbicaciones = async (idUbicacion) => {
      try {
         const data = await dispatch(getfetch_Ubicaciones(idUbicacion));
         const options = data.map((item) => ({
            value: item.idNetsuite_ubicaciones,
            label: item.nombre_ubicaciones,
         }));

         setUbicacionOptions(options);
      } catch (error) {
         console.error("Error al obtener las ubicaciones:", error);
      }
   };

   const fetchClases = async (idClases) => {
      try {
         const data = await dispatch(getfetch_Clases(idClases));
         const options = data.map((item) => ({
            value: item.idNetsuite_clase,
            label: item.nombre_clase,
         }));

         setClasesOptions(options);
      } catch (error) {
         console.error("Error al obtener las ubicaciones:", error);
      }
   };

   const fetchClientes = async (idLeads) => {
      try {
         const data = await dispatch(getLeadsComplete("2024-01-01", "2060-01-01", 0));

         const options = data.map((item) => ({
            value: item.idinterno_lead,
            label: `${item.nombre_lead} -${item.proyecto_lead}`,
         }));

         setClientesOptions(options);

         if (idLeads > 0) {
            setFormValues((prevValues) => ({
               ...prevValues,
               clientes: idLeads,
            }));
         }
      } catch (error) {
         console.error("Error al obtener los clientes:", error);
      }
   };

   const fetchExpedientes = async (idExpediente, filtro, showLoading = false) => {
      try {
         if (showLoading) {
            setLoadingExpediente(true);
         }

         const data = await dispatch(getFileList());
         const arrayPendiente = [30, 4, 16, 39, 19];
         const filteredData =
            filtro > 0
               ? arrayPendiente.includes(filtro)
                  ? data.filter((item) => arrayPendiente.includes(item.idProyectoPrincipal_exp))
                  : data.filter((item) => item.idProyectoPrincipal_exp === filtro)
               : data;

         const expedientesDisponibles = filteredData.filter((item) => item.estado_exp === "1. Disponible para Venta");

         const options = expedientesDisponibles.map((item) => ({
            value: item.ID_interno_expediente,
            label: `${item.codigo_exp} - ${item.estado_exp} `,
         }));

         setExpedienteOptions(options);

         if (idExpediente > 0) {
            const expedienteEncontrado = data.find((item) => item.ID_interno_expediente === idExpediente);

            if (expedienteEncontrado) {
               setFormValues((prevValues) => ({
                  ...prevValues,
                  expediente: idExpediente,
                  idInternoExpediente: expedienteEncontrado.ID_interno_expediente,
                  estadoExpediente: expedienteEncontrado.estado_exp,
                  nombreExpediente: expedienteEncontrado.codigo_exp,
                  precioLista: parseFloat(expedienteEncontrado.precioVentaUncio_exp.replace(/[,.]/g, "")),
                  precioMinimo: parseFloat(expedienteEncontrado.precioDeVentaMinimo.replace(/[,.]/g, "")),
               }));
            }
         } else {
            setFormValues((prevValues) => ({
               ...prevValues,
               expediente: "",
               idInternoExpediente: "",
               estadoExpediente: "",
               nombreExpediente: "",
               precioLista: 0,
               precioMinimo: 0,
            }));
         }
      } catch (error) {
         console.error("Error al obtener los expedientes:", error);
      } finally {
         if (showLoading) {
            setLoadingExpediente(false);
         }
      }
   };

   const getQueryParam = (param) => {
      const value = new URLSearchParams(location.search).get(param);

      if (value && !isNaN(value) && !isNaN(parseFloat(value))) {
         return Number(value);
      }

      return value;
   };

   useEffect(() => {
      const leadId = getQueryParam("idLead");

      if (leadId && leadId > 0) {
         fetchLeadDetails(leadId);
      }

      fetchUbicaciones(1);
      fetchClases(1);
      fetchClientes(leadId);

      if (leadId === 0) {
         const idExpediente = getQueryParam("idExpediente");
         fetchExpedientes(idExpediente, formValues.clientesPoyrecto);
      }
   }, [location.search]);

   const handleInputChange = (e) => {
      const { name, value } = e.target;

      if (name === "estado") {
         const isCondicional = value === "11";
         setIsMotivoCondicionEnabled(isCondicional);

         setFormValues((prevState) => ({
            ...prevState,
            estado: value,
            probabilidad: isCondicional ? "50.0%" : "80.0%",
            nombreValor: isCondicional ? "Condicional" : "Firme",
            fechaCierrePrevista: isCondicional ? getFormattedDate(22) : getFormattedDate(7),
         }));
      } else {
         setFormValues((prevState) => ({
            ...prevState,
            [name]: value,
         }));
      }

      if (name === "clientes") {
         fetchLeadDetails(value);
      }

      if (name === "expediente") {
         if (value) {
            fetchExpedientes(value, formValues.clientesPoyrecto, true);
            fetchValidarDisponibilidad(value);
         } else {
            setFormValues((prevValues) => ({
               ...prevValues,
               expediente: "",
               idInternoExpediente: "",
               estadoExpediente: "",
               nombreExpediente: "",
               precioLista: 0,
               precioMinimo: 0,
            }));
            setDisponibilidadExpediente(null);
         }
      }

      if (errors[name]) {
         setErrors((prevErrors) => ({
            ...prevErrors,
            [name]: false,
         }));
      }
   };

   const validateForm = () => {
      const requiredFields = [
         "clienteAsignado",
         "subsidiaria",
         "proyecto",
         "motivoCompra",
         "metodoPago",
         "ubicacion",
         "clase",
         "expediente",
         "idInternoExpediente",
      ];
      const nextErrors = {};
      let isValid = true;

      requiredFields.forEach((field) => {
         if (!formValues[field]) {
            nextErrors[field] = true;
            isValid = false;
         }
      });

      if (formValues.estado === "11" && !formValues.motivoCondicion) {
         nextErrors.motivoCondicion = true;
         isValid = false;
      }

      setErrors(nextErrors);
      return isValid;
   };

   const handleGenerateOpportunity = async () => {
      if (!validateForm()) {
         Swal.fire({
            icon: "error",
            title: "Campos obligatorios",
            text: "Por favor, complete todos los campos requeridos.",
         });
         return;
      }

      Swal.fire({
         title: "¿Está seguro de crear la oportunidad?",
         text: "No se podrá revertir esta acción, por favor confirme.",
         icon: "warning",
         showCancelButton: true,
         confirmButtonColor: "#3085d6",
         cancelButtonColor: "#d33",
         confirmButtonText: "Sí, crear!",
      }).then(async (result) => {
         if (!result.isConfirmed) {
            return;
         }

         Swal.fire({
            title: "Creando oportunidad...",
            html: "Por favor espere...",
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
         });

         try {
            const response = await dispatch(crearOportunidad(formValues, leadDetails));
            const detalleOportunidad = response.data["Detalle"];

            if (detalleOportunidad.status === 200) {
               await dispatch(crearReoporteLead(leadDetails));
               await dispatch(updateEstadoOportunidad(formValues, detalleOportunidad));

               Swal.fire({
                  position: "top-end",
                  icon: "success",
                  title: "Oportunidad creada exitosamente",
                  showConfirmButton: false,
                  timer: 2500,
               }).then(() => {
                  window.location.href = `/oportunidad/ver?data=${leadDetails.idinterno_lead}&data2=${detalleOportunidad.id}`;
               });
            } else if (detalleOportunidad.status === 500) {
               const error = JSON.parse(detalleOportunidad.Error);

               Swal.fire({
                  html: `
                            <h4>Detalle de error:</h4>
                            <p>${error.details}, <br> Lo sentimos, por favor contacte a su administrador.</p>
                        `,
                  icon: "error",
                  confirmButtonText: "OK",
                  cancelButtonText: "CORREGIR",
                  showCancelButton: true,
                  showCloseButton: true,
               });
            }
         } catch (error) {
            Swal.fire({
               icon: "error",
               title: "Error inesperado",
               text: "Ocurrió un error al crear la oportunidad. Intente nuevamente.",
            });
         }
      });
   };

   const fetchValidarDisponibilidad = async (idExpediente) => {
      try {
         setLoadingDisponibilidad(true);
         const result = await dispatch(fetchValidardisponibilidad(idExpediente));
         setDisponibilidadExpediente(result);
      } catch (error) {
         console.error("Error al validar disponibilidad del expediente:", error);
         setDisponibilidadExpediente(null);
      } finally {
         setLoadingDisponibilidad(false);
      }
   };

   const availabilityEntries = getAvailabilityEntries(disponibilidadExpediente);

   return (
      <>
         <style>{OPPORTUNITY_CREATE_STYLES}</style>

         <div className="lead-profile-shell opportunity-create-shell">
            <div style={PROFILE_PANEL_STYLES}>
               <div className="lead-profile-panel">
                  <div className="lead-profile-hero">
                     <div>
                        <span className="lead-profile-eyebrow">Gestión comercial</span>
                        <h1 className="lead-profile-page-title">Crear oportunidad</h1>
                        <p className="lead-profile-page-copy">
                           Centralice la información principal del lead, complete los datos de cierre y vincule el expediente correcto antes de
                           generar la oportunidad.
                        </p>
                     </div>
                  </div>

                  {Object.keys(leadDetails).length > 0 && (
                     <div className="opportunity-create-toolbar">
                        <ButtonActions leadData={leadDetails} />
                     </div>
                  )}

                  <section className="lead-profile-section">
                     <div className="lead-profile-section-head">
                        <span className="lead-profile-kicker">Información base</span>
                        <h5 className="lead-profile-section-title">Resumen comercial</h5>
                        <p className="lead-profile-section-copy">
                           Datos generales del cliente, contexto del registro y comentario interno para la oportunidad.
                        </p>
                     </div>

                     <div className="opportunity-create-grid">
                        <div className="opportunity-create-field">
                           <label>Cliente asociado</label>
                           <Select
                              name="clientes"
                              options={clientesOptions}
                              value={clientesOptions.find((option) => option.value === formValues.clientes)}
                              onChange={(selectedOption) =>
                                 handleInputChange({
                                    target: {
                                       name: "clientes",
                                       value: selectedOption ? selectedOption.value : "",
                                    },
                                 })
                              }
                              placeholder="Seleccione un cliente"
                              isClearable
                              classNamePrefix="react-select"
                              styles={selectControlStyles(false)}
                           />
                        </div>

                        <div className="opportunity-create-two-columns">
                           <div className="opportunity-create-field">
                              <label>Cliente asignado</label>
                              <input
                                 value={formValues.clienteAsignado}
                                 onChange={handleInputChange}
                                 type="text"
                                 name="clienteAsignado"
                                 className={`form-control ${errors.clienteAsignado ? "is-invalid" : ""}`}
                                 disabled
                              />
                           </div>

                           <div className="opportunity-create-field">
                              <label>Subsidiaria</label>
                              <input
                                 value={formValues.subsidiaria}
                                 onChange={handleInputChange}
                                 name="subsidiaria"
                                 type="text"
                                 className={`form-control ${errors.subsidiaria ? "is-invalid" : ""}`}
                                 disabled
                              />
                           </div>
                        </div>

                        <div className="opportunity-create-two-columns">
                           <div className="opportunity-create-field">
                              <label>Proyecto</label>
                              <input
                                 value={formValues.proyecto}
                                 onChange={handleInputChange}
                                 name="proyecto"
                                 type="text"
                                 className={`form-control ${errors.proyecto ? "is-invalid" : ""}`}
                                 disabled
                              />
                           </div>

                           <div className="opportunity-create-field">
                              <label>Probabilidad y valor</label>
                              <div className="opportunity-create-two-columns">
                                 <input
                                    type="text"
                                    value={formValues.probabilidad}
                                    onChange={handleInputChange}
                                    name="probabilidad"
                                    className="form-control"
                                    disabled
                                 />
                                 <input
                                    type="text"
                                    value={formValues.nombreValor}
                                    onChange={handleInputChange}
                                    name="nombreValor"
                                    className="form-control"
                                    disabled
                                 />
                              </div>
                           </div>
                        </div>

                        <div className="opportunity-create-field">
                           <label>Detalles</label>
                           <textarea
                              id="memo"
                              className="form-control"
                              value={formValues.memo}
                              onChange={handleInputChange}
                              name="memo"
                              rows="8"
                           />
                        </div>
                     </div>
                  </section>

                  <section className="lead-profile-section">
                     <div className="lead-profile-section-head">
                        <span className="lead-profile-kicker">Reglas de cierre</span>
                        <h5 className="lead-profile-section-title">Información obligatoria</h5>
                        <p className="lead-profile-section-copy">
                           Complete el estado, motivo y configuración comercial requerida para enviar la oportunidad correctamente.
                        </p>
                     </div>

                     <div className="opportunity-create-grid">
                        <div className="opportunity-create-three-columns">
                           <div className="opportunity-create-field">
                              <label>Estado</label>
                              <select className="form-select" value={formValues.estado} onChange={handleInputChange} name="estado">
                                 <option value="11">Condicional</option>
                                 <option value="22">Firme</option>
                              </select>
                           </div>

                           <div className="opportunity-create-field">
                              <label>Motivo de condición</label>
                              <select
                                 className={`form-select ${errors.motivoCondicion ? "is-invalid" : ""}`}
                                 name="motivoCondicion"
                                 value={formValues.motivoCondicion}
                                 onChange={handleInputChange}
                                 required
                                 disabled={!isMotivoCondicionEnabled}
                              >
                                 <option value="">Escoger ...</option>
                                 <option value="Esperando un negocio">Esperando un negocio</option>
                                 <option value="Viendo opciones">Viendo opciones</option>
                                 <option value="Depende la venta de la casa">Depende la venta de la casa</option>
                                 <option value="Definiendo Prima">Definiendo Prima</option>
                                 <option value="Análisis de banco">Análisis de banco</option>
                              </select>
                              {errors.motivoCondicion && (
                                 <p className="opportunity-create-invalid">Este campo es obligatorio cuando el estado es condicional.</p>
                              )}
                           </div>

                           <div className="opportunity-create-field">
                              <label>Cierre previsto según estado</label>
                              <div className="opportunity-create-date-box">
                                 <p className="opportunity-create-date-copy">
                                    Fecha actual de referencia: <strong>{fechaActualComparar}</strong>
                                 </p>
                                 <input
                                    type="text"
                                    name="fechaCierrePrevista"
                                    value={formValues.fechaCierrePrevista}
                                    onChange={handleInputChange}
                                    className="form-control docs-date"
                                    disabled
                                 />
                              </div>
                           </div>
                        </div>

                        <div className="opportunity-create-three-columns">
                           <div className="opportunity-create-field">
                              <label>Motivo de compra</label>
                              <select
                                 className={`form-select ${errors.motivoCompra ? "is-invalid" : ""}`}
                                 name="motivoCompra"
                                 value={formValues.motivoCompra}
                                 onChange={handleInputChange}
                                 required
                              >
                                 <option value="">Seleccionar</option>
                                 <option value="1">Primera Casa</option>
                                 <option value="4">Inversión</option>
                              </select>
                           </div>

                           <div className="opportunity-create-field">
                              <label>Método de pago</label>
                              <select
                                 className={`form-select ${errors.metodoPago ? "is-invalid" : ""}`}
                                 name="metodoPago"
                                 value={formValues.metodoPago}
                                 onChange={handleInputChange}
                                 required
                              >
                                 <option value="">Seleccionar</option>
                                 <option value="2">Avance de obra</option>
                                 <option value="7">Avance diferenciado</option>
                                 <option value="1">Contra entrega</option>
                              </select>
                           </div>

                           <div className="opportunity-create-field">
                              <label>Guía operativa</label>
                              <p className="opportunity-create-static-note">
                                 La oportunidad se crea con los datos comerciales del lead actual y mantiene la lógica de validación del flujo
                                 original.
                              </p>
                           </div>
                        </div>

                        <div className="opportunity-create-two-columns">
                           <div className="opportunity-create-field">
                              <label>Ubicación</label>
                              <Select
                                 name="ubicacion"
                                 options={ubicacionOptions}
                                 value={ubicacionOptions.find((option) => option.value === formValues.ubicacion)}
                                 onChange={(selectedOption) =>
                                    handleInputChange({
                                       target: {
                                          name: "ubicacion",
                                          value: selectedOption ? selectedOption.value : "",
                                       },
                                    })
                                 }
                                 placeholder="Seleccione una ubicación"
                                 isClearable
                                 classNamePrefix="react-select"
                                 styles={selectControlStyles(errors.ubicacion)}
                              />
                              {errors.ubicacion && <p className="opportunity-create-invalid">Este campo es obligatorio.</p>}
                           </div>

                           <div className="opportunity-create-field">
                              <label>Clase</label>
                              <Select
                                 name="clase"
                                 options={leadsOptions}
                                 value={leadsOptions.find((option) => option.value === formValues.clase)}
                                 onChange={(selectedOption) =>
                                    handleInputChange({
                                       target: {
                                          name: "clase",
                                          value: selectedOption ? selectedOption.value : "",
                                       },
                                    })
                                 }
                                 placeholder="Seleccione una clase"
                                 isClearable
                                 classNamePrefix="react-select"
                                 styles={selectControlStyles(errors.clase)}
                              />
                              {errors.clase && <p className="opportunity-create-invalid">Este campo es obligatorio.</p>}
                           </div>
                        </div>
                     </div>
                  </section>

                  <section className="lead-profile-section">
                     <div className="lead-profile-section-head">
                        <span className="lead-profile-kicker">Expediente ligado</span>
                        <h5 className="lead-profile-section-title">Unidad expediente ligado VTA</h5>
                        <p className="lead-profile-section-copy">
                           Seleccione la unidad correcta y revise el resumen de disponibilidad antes de continuar.
                        </p>
                     </div>

                     <div className="opportunity-create-expediente-grid">
                        <div className="opportunity-create-box">
                           <h6 className="opportunity-create-box-title">Selección y validación</h6>

                           <div className="opportunity-create-field">
                              <label>Buscar expediente</label>
                              <Select
                                 name="expediente"
                                 options={expedienteOptions}
                                 value={expedienteOptions.find((option) => option.value === formValues.expediente)}
                                 onChange={(selectedOption) =>
                                    handleInputChange({
                                       target: {
                                          name: "expediente",
                                          value: selectedOption ? selectedOption.value : "",
                                       },
                                    })
                                 }
                                 placeholder="Seleccione un expediente"
                                 isClearable
                                 isDisabled={loadingExpediente}
                                 classNamePrefix="react-select"
                                 styles={selectControlStyles(errors.expediente, loadingExpediente)}
                              />
                              {errors.expediente && <p className="opportunity-create-invalid">Este campo es obligatorio.</p>}
                           </div>

                           <input type="hidden" name="idInternoExpediente" value={formValues.idInternoExpediente} />

                           <div className="opportunity-create-field">
                              <label>Estado del expediente</label>
                              <input
                                 type="text"
                                 name="estadoExpediente"
                                 className="form-control"
                                 value={loadingExpediente ? "Cargando..." : formValues.estadoExpediente}
                                 disabled
                              />
                           </div>

                           {loadingExpediente && <p className="opportunity-create-loading">Cargando información del expediente...</p>}

                           {loadingDisponibilidad && <p className="opportunity-create-loading">Cargando disponibilidad...</p>}

                           {!loadingDisponibilidad && disponibilidadExpediente && (
                              <div className="opportunity-create-summary">
                                 {availabilityEntries.map(([key, value]) => {
                                    const badges = getAvailabilityBadges(value);

                                    return (
                                       <div className="opportunity-create-summary-row" key={key}>
                                          <div className="opportunity-create-summary-label">
                                             <i className={availabilityIconMap[key] || "mdi mdi-chart-box-outline"} />
                                             <span>{availabilityLabelMap[key] || key}</span>
                                          </div>

                                          <div className="opportunity-create-summary-value">
                                             <strong>{Number(value?.total || 0)}</strong>

                                             {badges.length > 0 && (
                                                <div className="opportunity-create-badges">
                                                   {badges.map((badge) => (
                                                      <span key={badge.key} className="opportunity-create-badge">
                                                         {badge.label}
                                                      </span>
                                                   ))}
                                                </div>
                                             )}
                                          </div>
                                       </div>
                                    );
                                 })}
                              </div>
                           )}

                           {!loadingDisponibilidad && !loadingExpediente && formValues.expediente && !disponibilidadExpediente && (
                              <p className="opportunity-create-empty">
                                 No fue posible obtener el resumen de disponibilidad para este expediente.
                              </p>
                           )}
                        </div>

                        <div className="opportunity-create-box">
                           <h6 className="opportunity-create-box-title">Datos del expediente</h6>

                           <div className="opportunity-create-data-grid">
                              <div className="opportunity-create-data-item">
                                 <span>Nombre del expediente</span>
                                 <strong>{loadingExpediente ? "Cargando..." : toDisplayValue(formValues.nombreExpediente)}</strong>
                              </div>

                              <div className="opportunity-create-data-item">
                                 <span>Precio de lista</span>
                                 <strong>{loadingExpediente ? "Cargando..." : `₡ ${formatCurrencyValue(formValues.precioLista)}`}</strong>
                              </div>

                              <div className="opportunity-create-data-item">
                                 <span>Precio de venta mínimo</span>
                                 <strong>{loadingExpediente ? "Cargando..." : `₡ ${formatCurrencyValue(formValues.precioMinimo)}`}</strong>
                              </div>
                           </div>

                           <input type="hidden" name="salesRep" id="salesrep" value={formValues.salesRep} />
                           <input type="hidden" name="currency" id="currency" value={formValues.currency} />
                        </div>
                     </div>
                  </section>

                  <div className="opportunity-create-footer">
                     <button onClick={handleGenerateOpportunity} className="opportunity-create-submit">
                        <i className="mdi mdi-check-circle" />
                        Generar oportunidad
                     </button>
                  </div>
               </div>
            </div>
         </div>
      </>
   );
};
