import React, { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import {
   editarInformacionLead,
   getDataInformationsLead,
   getDataSelectCampaing,
   getDataSelectCorredor,
   getDataSelectProyect,
   getDataSelectSubsidiaria,
} from "../../../../store/leads/thunksLeads";
import { ButtonActions } from "../../../components/buttonAccions/buttonAccions";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";

const animatedComponents = makeAnimated();

/**
 * Estilos constantes
 * @constant {Object} CARD_STYLES - Estilos para el contenedor de la tarjeta
 * @property {string} borderRadius - Radio de la esquina de la tarjeta
 * @property {string} background - Color de fondo de la tarjeta
 * @property {string} boxShadow - Sombra de la tarjeta
 */
const CARD_STYLES = {
   borderRadius: "27px",
   background: "#ffffff",
   boxShadow: "-26px -26px 79px #bababa, 26px 26px 79px #ffffff",
};

/**
 * Estado inicial del formulario
 * @constant {Object} INITIAL_FORM_STATE - Estado inicial del formulario
 * @property {string} firstnames - Nombre del cliente
 * @property {string} entitynumber - Número de entidad del cliente
 * @property {string} emails - Correo electrónico del cliente
 * @property {string} phones - Teléfono del cliente
 * @property {string} comentario_clientes - Comentario del cliente
 */
const INITIAL_FORM_STATE = {
   firstnames: "",
   entitynumber: "",
   emails: "",
   phones: "",
   comentario_clientes: "--",
   campana_new_edit: "",
   proyecto_new_edit: "",
   subsidiary_new_edit: "1",
   id_estadointeresado_cliente: "CLIENTE POTENCIAL-Exploratorio",
   empresa_cliente: "ROCCA DEV. GRU.",
   referencia_cliente: "Instagram",
   rango_edad: "",
   ingresos: "",
   motivo_compra: "",
   cantidad_hijos: "",
   momento_compra: "",
   lugar_trabajo: "",
   origen_fondos: "",
   zona_residencia: "",
   vatregnumber: "",
   custentity1: "",
   custentityestado_civil: "",
   custentity11: "",
   custentityhijos_cliente: "",
   corredor_lead_edit: "",
   defaultaddress: "",
   altphone: "00000000",
   custentity_ix_customer_profession: "",
   custentity77: "",
   custentity81: "",
   custentityestado_civil_extra: "",
   custentity82: "00000000",
   custentity78: "",
   custentity84: "",
   custentity79: "",
   infromacion_extra_dos: 1,
   corredor_extra: 1,
   informacion_Extra: 1,
   id: 0,
   employee: 0,
};

// Agregar esta constante con los campos adicionales
const additionalRequiredFields = [
   "rango_edad",
   "ingresos",
   "motivo_compra",
   "cantidad_hijos",
   "momento_compra",
   "origen_fondos",
   "vatregnumber",
   "custentity1",
   "custentity_ix_customer_profession",
   "custentityestado_civil",
   "lugar_trabajo",
   "zona_residencia",
   "defaultaddress"
];

/**
 * Componente principal para la edición de leads
 * @returns {React.ReactElement} - Elemento React para la edición de leads
 * @description Componente principal para la edición de leads
 * @param {Object} props - Propiedades del componente
 * @param {Object} props.leadData - Datos del lead
 * @param {Object} props.className - Clase CSS opcional
 * @param {Object} props.leadData - Datos del lead
 */
export const View_edit_lead = () => {
   const navigate = useNavigate();
   const dispatch = useDispatch();

   /**
    * Estados para las opciones de proyectos, campañas, subsidiarias y corredores
    * @constant {Array} projectOptions - Opciones de proyectos
    * @constant {Array} campaignOptions - Opciones de campañas
    * @constant {Array} subsidiaryOptions - Opciones de subsidiarias
    * @constant {Array} corredor_lead_options - Opciones de corredores
    * @constant {Object} leadDetails - Detalles del lead
    * @constant {Object} formData - Datos del formulario
    */
   const [projectOptions, setProjectOptions] = useState([]);
   const [campaignOptions, setCampaignOptions] = useState([]);
   const [subsidiaryOptions, setSubsidiaryOptions] = useState([]);
   const [corredor_lead_options, setcorredor_lead] = useState([]);
   const [leadDetails, setLeadDetails] = useState({});
   const [formData, setFormData] = useState(INITIAL_FORM_STATE);

   /**
    * Extrae parámetros de la URL
    * @param {string} param - Nombre del parámetro
    * @returns {string|number} Valor del parámetro
    * @description Extrae parámetros de la URL
    * @returns {string|number} Valor del parámetro
    */
   const getQueryParam = (param) => {
      const value = new URLSearchParams(location.search).get(param);
      return !isNaN(value) && !isNaN(parseFloat(value)) ? Number(value) : value;
   };

   /**
    * Actualiza el formData con la información básica del lead
    * @param {Object} leadInfo - Información del lead
    * @returns {void} - No devuelve ningún valor
    * @description Actualiza el formData con la información básica del lead
    */
   const updateBasicLeadInfo = (leadInfo) => {
      setFormData((prev) => ({
         ...prev,
         firstnames: leadInfo.nombre_lead,
         phones: leadInfo.telefono_lead,
         emails: leadInfo.email_lead,
         entitynumber: leadInfo.idinterno_lead,
      }));
   };

   /**
    * Carga y configura las opciones de proyectos
    * @param {Object} leadInfo - Información del lead
    * @returns {void} - No devuelve ningún valor
    * @description Carga y configura las opciones de proyectos
    */
   const loadProjectOptions = async (leadInfo) => {
      const resultProyect = await dispatch(getDataSelectProyect(1));
      const projects = resultProyect.map((p) => ({
         value: p.id_ProNetsuite,
         label: p.Nombre_proyecto,
      }));
      setProjectOptions(projects);

      const defaultProject = projects.find((p) => p.value === leadInfo.idproyecto_lead);
      if (defaultProject) {
         setFormData((prev) => ({ ...prev, proyecto_new_edit: defaultProject }));
      }
   };

   /**
    * Carga y configura las opciones de campañas
    * @param {Object} leadInfo - Información del lead
    * @returns {void} - No devuelve ningún valor
    * @description Carga y configura las opciones de campañas
    */
   const loadCampaignOptions = async (leadInfo) => {
      const resultCampaing = await dispatch(getDataSelectCampaing(1));
      const campaigns = resultCampaing.map((c) => ({
         value: c.id_NetsauiteCampana,
         label: c.Nombre_Campana,
      }));
      setCampaignOptions(campaigns);

      const defaultCampaign = campaigns.find((c) => c.value === Number(leadInfo.idcampana_lead));
      if (defaultCampaign) {
         setFormData((prev) => ({ ...prev, campana_new_edit: defaultCampaign }));
      }
   };

   /**
    * Carga y configura las opciones de subsidiarias
    * @param {Object} leadInfo - Información del lead
    * @returns {void} - No devuelve ningún valor
    * @description Carga y configura las opciones de subsidiarias
    */
   const loadSubsidiaryOptions = async (leadInfo) => {
      const resultSubsidiaria = await dispatch(getDataSelectSubsidiaria(1));
      const subsidiaries = resultSubsidiaria.map((s) => ({
         value: s.id_NetsuiteSub,
         label: s.Nombre_Subsidiaria,
      }));
      setSubsidiaryOptions(subsidiaries);

      const defaultSubsidiary = subsidiaries.find((s) => s.value === leadInfo.idsubsidaria_lead);
      if (defaultSubsidiary) {
         setFormData((prev) => ({ ...prev, subsidiary_new_edit: defaultSubsidiary }));
      }
   };

   /**
    * Carga y configura las opciones de corredores
    * @param {Object} leadInfo - Información del lead
    * @returns {void} - No devuelve ningún valor
    * @description Carga y configura las opciones de corredores
    */
   const loadCorredorOptions = async (leadInfo) => {
      const resultCorredor = await dispatch(getDataSelectCorredor(1));
      const corredor = resultCorredor.map((v) => ({
         value: v.id_netsuiteCorredor,
         label: v.nombre_corredor,
      }));
      setcorredor_lead(corredor);

      const corredorLeadInt = parseInt(leadInfo.Corredor_lead, 10) || 0;
      const defaultCorredor = corredor.find((v) => v.value === corredorLeadInt);
      if (defaultCorredor) {
         setFormData((prev) => ({ ...prev, corredor_lead_edit: defaultCorredor }));
      }
   };

   /**
    * Carga inicial de datos
    * @returns {void} - No devuelve ningún valor
    * @description Carga inicial de datos
    */
   const loadInitialData = async () => {
      try {
         // Obtener el ID del lead desde la URL
         const leadId = getQueryParam("id");
         // Obtener los detalles del lead desde el servidor
         const leadInfo = await dispatch(getDataInformationsLead(leadId));


         setFormData((prev) => ({
            ...prev,
            id: leadInfo.idinterno_lead,
            employee: leadInfo.id_empleado_lead,
            rango_edad: leadInfo.Edad_lead,
            ingresos: leadInfo.info_extra_ingresos,
            motivo_compra: leadInfo.info_extra_MotivoCompra,
            cantidad_hijos: leadInfo.Hijos_lead,
            momento_compra: leadInfo.info_extra_MomentodeCompra,
            lugar_trabajo: leadInfo.info_extra_Trabajo,
            origen_fondos: leadInfo.info_extra_OrigenFondo,
            zona_residencia: leadInfo.info_extra_ZonaRecidencia,
            vatregnumber: leadInfo.cedula_lead,
            custentity1: leadInfo.Nacionalidad_lead,
            custentityestado_civil: leadInfo.Estado_ciLead,
            custentity11: typeof leadInfo.Edad_lead === 'string' && /[+-]/.test(leadInfo.Edad_lead) 
                ? leadInfo.Edad_lead.replace(/[+-]/g, '') 
                : leadInfo.Edad_lead,
            custentity_ix_customer_profession: leadInfo.Profesion_lead,
            defaultaddress: leadInfo.Direccion,
            custentity77: leadInfo.nombre_extra_lead,
            custentity81: leadInfo.nacionalidad_extra_lead,
            custentityestado_civil_extra: leadInfo.estado_civil_extra_lead,
            custentity82: leadInfo.telefono_extra_lead,
            custentity78: leadInfo.cedula_extra_lead,
            custentity84: leadInfo.email_extra_lead,
            custentity79: leadInfo.profesion_extra_lead,


         }));

         // Actualizar los detalles del lead
         setLeadDetails(leadInfo);
         // Actualizar los datos básicos del formulario
         updateBasicLeadInfo(leadInfo);

         // Cargar las opciones de proyectos, campañas, subsidiarias y corredores
         await Promise.all([
            loadProjectOptions(leadInfo),
            loadCampaignOptions(leadInfo),
            loadSubsidiaryOptions(leadInfo),
            loadCorredorOptions(leadInfo),
         ]);
      } catch (error) {
         console.error("Error al cargar los datos:", error);
      }
   };

   /**
    * Efecto para cargar los datos iniciales
    * @description Efecto para cargar los datos iniciales
    */
   useEffect(() => {
      loadInitialData();
   }, [dispatch]);

   /**
    * Maneja cambios en inputs regulares
    * @param {Object} e - Evento del input
    * @returns {void} - No devuelve ningún valor
    * @description Maneja cambios en inputs regulares
    */
   const handleInputChange = (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      
      // Reset border color when user starts typing
      e.target.style.border = "1px solid #ced4da";
      
      // Validación para campos del segundo cliente
      const secondClientFields = [
         "custentity77", "custentity81", "custentityestado_civil_extra",
         "custentity82", "custentity78", "custentity84", "custentity79"
      ];
      
      // Validación para campos adicionales
      if (additionalRequiredFields.includes(name) && value.trim() !== "") {
         additionalRequiredFields.forEach(field => {
            if (field !== name && (!formData[field] || formData[field].trim() === "")) {
               const element = document.getElementById(field);
               if (element) {
                  element.style.border = "1px solid red";
               }
            }
         });
      }
      
      // Validación existente para campos del segundo cliente
      if (secondClientFields.includes(name) && value.trim() !== "") {
         secondClientFields.forEach(field => {
            if (field !== name && (!formData[field] || formData[field].trim() === "")) {
               const element = document.getElementById(field);
               if (element) {
                  element.style.border = "1px solid red";
               }
            }
         });
      }
   };

   /**
    * Maneja cambios en componentes Select
    * @param {Object} selectedOption - Opción seleccionada
    * @param {Object} action - Acción del componente Select
    * @returns {void} - No devuelve ningún valor
    * @description Maneja cambios en componentes Select
    */
   const handleSelectChange = (selectedOption, action) => {
      setFormData((prev) => ({ ...prev, [action.name]: selectedOption }));
      document.getElementById(action.name).style.border = "1px solid #ced4da";
   };

   /**
    * Valida el formulario antes de enviar
    * @returns {boolean} - True si el formulario es válido, false en caso contrario
    * @description Valida el formulario antes de enviar
    */
   const validateForm = () => {
      return formData.firstnames !== "" && formData.emails !== "" && formData.phones !== "" && formData.comentario_clientes !== "";
   };

   // Nueva función para validar campos adicionales
   const validateAdditionalFields = () => {
      // Verifica si algún campo tiene valor
      const hasAnyAdditionalInfo = additionalRequiredFields.some(field => 
         formData[field] && formData[field].toString().trim() !== ""
      );

      // Si hay información en algún campo, verifica todos
      if (hasAnyAdditionalInfo) {
         const emptyFields = additionalRequiredFields.filter(field => 
            !formData[field] || formData[field].toString().trim() === ""
         );

         // Marca los campos vacíos en rojo
         emptyFields.forEach(field => {
            const element = document.getElementById(field);
            if (element) {
               element.style.border = "1px solid red";
            }
         });

         if (emptyFields.length > 0) {
            Swal.fire({
               title: "Atención",
               text: "Si completa información adicional, todos los campos de esta sección son obligatorios",
               icon: "error"
            });
            return false;
         }
      }
      return true;
   };

   /**
    * Maneja el envío del formulario
    * @returns {void} - No devuelve ningún valor
    * @description Maneja el envío del formulario
    */
   const handleSubmit = async () => {
      // Validación de campos adicionales
      if (!validateAdditionalFields()) {
         return;
      }

      // Validación existente para campos del segundo cliente
      const secondClientFields = [
         "custentity77", "custentity81", "custentityestado_civil_extra",
         "custentity82", "custentity78", "custentity84", "custentity79"
      ];

      const hasAnySecondClientInfo = secondClientFields.some(field => 
         formData[field] && formData[field].toString().trim() !== ""
      );

      if (hasAnySecondClientInfo) {
         const emptySecondClientFields = secondClientFields.filter(field => 
            !formData[field] || formData[field].toString().trim() === ""
         );

         emptySecondClientFields.forEach(field => {
            const element = document.getElementById(field);
            if (element) {
               element.style.border = "1px solid red";
            }
         });

         if (emptySecondClientFields.length > 0) {
            Swal.fire({
               title: "Atención",
               text: "Si ingresa información del segundo cliente, todos los campos son obligatorios",
               icon: "error"
            });
            return;
         }
      }

      // Define required fields including Select components
      const requiredFields = [
         "firstnames",
         "emails",
         "phones",
         "comentario_clientes",
         "subsidiary_new_edit",
         "proyecto_new_edit",
         "campana_new_edit",
      ];

      // Check if any required fields are empty
      const hasEmptyFields = requiredFields.some((field) => {
         const value = formData[field];
         // Handle both regular inputs and Select components
         const isEmpty = !value || (typeof value === "object" && !value.value);

         // Add red border to empty fields
         const element = document.getElementById(field);
         if (element && isEmpty) {
            element.style.border = "1px solid red";
         }

         return isEmpty;
      });

      if (hasEmptyFields) {
         Swal.fire({
            title: "Error",
            text: "Por favor, complete todos los campos requeridos",
            icon: "error",
         });
      } else {
         const result = await Swal.fire({
            title: "¿Estás seguro?",
            text: "Confirmar para editar la informacion del lead",
            icon: "warning",
            showCancelButton: true,
         });

         if (result.isConfirmed) {
            //mostrar un mensaje de espera pero sin el preload de espera pero que no se pueda cerrar
            Swal.fire({
               title: "Editando lead",
               text: "Por favor, espere un momento...",
               icon: "info",
               showConfirmButton: false,
               allowOutsideClick: false,
            });
            console.clear();

            const response = await dispatch(editarInformacionLead(formData));

            console.log("response", response);
            var ExTraerResultado = response.data["Detalle"];
            if (ExTraerResultado.status == 200) {
               Swal.fire({
                  title: "Lead editado",
                  text: "Lead editado correctamente",
                  icon: "success",
                  showConfirmButton: false,
                  allowOutsideClick: false,
                  timer: 3000,
               }).then(() => {
                  navigate(`/leads/perfil?data=${leadDetails?.idinterno_lead}`);
               });
            }

            if (ExTraerResultado.status == 500) {
               console.log("ExTraerResultado", response.data["Detalle"]);
               let error;
               try {
                  error = response.data["Detalle"]["Data"]["message"];
               } catch (e) {
                  error = "Error desconocido";
               }
               return Swal.fire({
                  title: "Detalle de error : " + error + ",  \nLo sentimos, favor revisar este error con su administrador.",
                  icon: "error", // Changed to error icon for better UX
                  width: "40em",
                  padding: "0 0 1.25em",
                  confirmButtonText: "OK",
                  cancelButtonText: "CORREGIR",
                  showCancelButton: true,
                  showCloseButton: true,
               });
            }
         }
      }
   };

   /**
    * Renderiza el formulario de información personal
    * @returns {React.ReactElement} - Elemento React para el formulario de información personal
    * @description Renderiza el formulario de información personal
    */
   const renderPersonalInfoForm = () => (
      <div className="row ticket">
         <div className="col-sm-6">
            <div className="mb-3">
               <label htmlFor="firstnames">Nombre Completo</label>
               <input
                  type="text"
                  name="firstnames"
                  id="firstnames"
                  value={formData.firstnames}
                  onChange={handleInputChange}
                  className="form-control mb-2"
               />
            </div>
            <div className="mb-3" hidden>
               <label className="required form-label">ID Lead</label>
               <input type="text" name="entitynumber" id="entitynumber" value={formData.entitynumber} readOnly className="form-control mb-2" />
            </div>
            <div className="mb-3">
               <label className="required form-label">Correo</label>
               <input type="text" name="emails" id="emails" value={formData.emails} onChange={handleInputChange} className="form-control mb-2" />
            </div>
            <div className="mb-3">
               <label className="required form-label">Número de teléfono</label>
               <input type="text" name="phones" id="phones" value={formData.phones} onChange={handleInputChange} className="form-control mb-2" />
            </div>
            <div className="mb-3">
               <label className="required form-label">Comentarios</label>
               <input
                  type="text"
                  name="comentario_clientes"
                  id="comentario_clientes"
                  value={formData.comentario_clientes}
                  onChange={handleInputChange}
                  className="form-control mb-2"
               />
            </div>
            <div className="mb-3">
               <label className="form-label">Dirección cliente</label>
               <textarea
                  id="defaultaddress"
                  name="defaultaddress"
                  value={formData.defaultaddress}
                  onChange={handleInputChange}
                  className="form-control"
                  maxLength="225"
                  rows="3"
                  placeholder="Introduzca una dirección"
               ></textarea>
            </div>
         </div>
         <div className="col-sm-6">
            <div className="mb-3">
               <label className="required form-label">Subsidiaria</label>
               <br />
               <Select
                  id="subsidiary_new_edit"
                  name="subsidiary_new_edit"
                  components={animatedComponents}
                  options={subsidiaryOptions}
                  value={formData.subsidiary_new_edit}
                  onChange={handleSelectChange}
                  isSearchable
                  required
               />
            </div>
            <div className="mb-3">
               <label className="required form-label">Proyectos</label>
               <br />
               <Select
                  id="proyecto_new_edit"
                  name="proyecto_new_edit"
                  components={animatedComponents}
                  options={projectOptions}
                  value={formData.proyecto_new_edit}
                  onChange={handleSelectChange}
                  isSearchable
                  required
               />
            </div>
            <div className="mb-3">
               <label className="required form-label">Campaña Marketing</label>
               <br />
               <Select
                  id="campana_new_edit"
                  name="campana_new_edit"
                  components={animatedComponents}
                  options={campaignOptions}
                  value={formData.campana_new_edit}
                  onChange={handleSelectChange}
                  isSearchable
                  required
               />
            </div>

            <div className="mb-3" hidden>
               <label className="required form-label">Estado del LEAD Interesado</label>
               <input
                  type="text"
                  name="id_estadointeresado_cliente"
                  id="id_estadointeresado_cliente"
                  value={formData.id_estadointeresado_cliente}
                  readOnly
                  className="form-control mb-2"
               />
            </div>
            <div className="mb-3" hidden>
               <label className="required form-label">Nombre de la empresa</label>
               <input
                  type="text"
                  name="empresa_cliente"
                  id="empresa_cliente"
                  value={formData.empresa_cliente}
                  readOnly
                  className="form-control mb-2"
               />
            </div>
            <div className="mb-3" hidden>
               <label className="required form-label">¿Dónde escuchó de nosotros?</label>
               <input
                  type="text"
                  name="referencia_cliente"
                  id="referencia_cliente"
                  value={formData.referencia_cliente}
                  readOnly
                  className="form-control mb-2"
               />
            </div>
            <div className="mb-3">
               <label className="required form-label">Corredor Cliente</label>
               <br />
               <Select
                  id="corredor_lead_edit"
                  name="corredor_lead_edit"
                  components={animatedComponents}
                  options={corredor_lead_options}
                  value={formData.corredor_lead_edit}
                  onChange={handleSelectChange}
                  isSearchable
               />
            </div>
         </div>
      </div>
   );

   /**
    * Renderiza el formulario de información adicional
    * @returns {React.ReactElement} - Elemento React para el formulario de información adicional
    * @description Renderiza el formulario de información adicional
    */
   const renderAdditionalInfoForm = () => (
      <>
         <hr style={{ border: "2px solid #000" }} />
         <h4 className="card-title">Datos Adicionales</h4>
         <div className="row">
            <div className="col-sm-6">
               <div className="mb-3">
                  <label className="required form-label">Rango de Edad</label>
                  <select
                     id="rango_edad"
                     name="rango_edad"
                     value={formData.rango_edad}
                     onChange={handleInputChange}
                     className="form-control select2"
                     required
                  >
                     <option value="">Seleccionar un rango</option>
                     <option value="25-34">25 a 34 años</option>
                     <option value="35-44">35 a 44 años</option>
                     <option value="45-54">45 a 54 años</option>
                     <option value="55+">55 o más años</option>
                  </select>
               </div>
               <div className="mb-3">
                  <label className="required form-label">Ingresos</label>
                  <select
                     id="ingresos"
                     name="ingresos"
                     value={formData.ingresos}
                     onChange={handleInputChange}
                     className="form-control select2"
                     required
                  >
                     <option value="">Seleccionar rango de ingresos</option>
                     <option value="0-2000">0 a 2,000 dólares</option>
                     <option value="2000-3000">2,000 a 3,000 dólares</option>
                     <option value="3000-5000">3,000 a 5,000 dólares</option>
                     <option value="5000-10000">5,000 a 10,000 dólares</option>
                     <option value="10000+">Más de 10,000 dólares</option>
                  </select>
               </div>
               <div className="mb-3">
                  <label className="required form-label">Motivo de Compra</label>
                  <select
                     id="motivo_compra"
                     name="motivo_compra"
                     value={formData.motivo_compra}
                     onChange={handleInputChange}
                     className="form-control select2"
                     required
                  >
                     <option value="">Seleccionar un motivo</option>
                     <option value="invertir">Invertir</option>
                     <option value="vivir">Vivir</option>
                  </select>
               </div>
               <div className="mb-3">
                  <label className="required form-label">Cantidad de Hijos</label>
                  <select
                     id="cantidad_hijos"
                     name="cantidad_hijos"
                     value={formData.cantidad_hijos}
                     onChange={handleInputChange}
                     className="form-control select2"
                     required
                  >
                     <option value="">Seleccionar cantidad</option>
                     <option value="0">0</option>
                     <option value="1">1</option>
                     <option value="2">2</option>
                     <option value="3+">3 o más</option>
                  </select>
               </div>
               <div className="mb-3">
                  <label className="required form-label">Momento de compra</label>
                  <select
                     id="momento_compra"
                     name="momento_compra"
                     value={formData.momento_compra}
                     onChange={handleInputChange}
                     className="form-control select2"
                     required
                  >
                     <option value="">Seleccionar momento compra</option>
                     <option value="Pre-venta">Pre-venta</option>
                     <option value="Proyecto iniciado">Proyecto iniciado</option>
                     <option value="En obra gris">En obra gris</option>
                     <option value="Entrega inmediata">Entrega inmediata</option>
                  </select>
               </div>
               <div className="mb-3">
                  <label className="form-label">Origen de los dondos</label>
                  <input
                     type="text"
                     name="origen_fondos"
                     id="origen_fondos"
                     value={formData.origen_fondos}
                     onChange={handleInputChange}
                     className="form-control mb-2"
                     placeholder="origen_fondos"
                     required
                  />
               </div>
            </div>
            <div className="col-sm-6">
               <div className="mb-3">
                  <label className="form-label">Cedula cliente</label>
                  <input
                     type="text"
                     name="vatregnumber"
                     id="vatregnumber"
                     value={formData.vatregnumber}
                     onChange={handleInputChange}
                     className="form-control mb-2"
                     placeholder="Cedula Cliente"
                  />
               </div>
               <div className="mb-3">
                  <label className="form-label">Nacionalidad cliente</label>
                  <input
                     type="text"
                     name="custentity1"
                     id="custentity1"
                     value={formData.custentity1}
                     onChange={handleInputChange}
                     className="form-control mb-2"
                     placeholder="Nacionalidad del Cliente"
                     required
                  />
               </div>
               <div className="mb-3">
                  <label className="form-label">Profesión Cliente</label>
                  <input
                     type="text"
                     name="custentity_ix_customer_profession"
                     id="custentity_ix_customer_profession"
                     value={formData.custentity_ix_customer_profession}
                     onChange={handleInputChange}
                     className="form-control mb-2"
                     placeholder="Profesión del cliente"
                     required
                  />
               </div>
               <div className="mb-3">
                  <label className="form-label">Estado Civil</label>
                  <select
                     required
                     name="custentityestado_civil"
                     id="custentityestado_civil"
                     value={formData.custentityestado_civil}
                     onChange={handleInputChange}
                     className="form-control"
                  >
                     <option value="">Seleccionar</option>
                     <option value="1">Casado/a</option>
                     <option value="2">Soltero/a</option>
                     <option value="3">Unión Libre</option>
                     <option value="4">Viudo</option>
                     <option value="5">Divorciado/a</option>
                  </select>
               </div>
               <div className="mb-3">
                  <label className="form-label">Lugar de trabajo</label>
                  <input
                     type="text"
                     name="lugar_trabajo"
                     id="lugar_trabajo"
                     value={formData.lugar_trabajo}
                     onChange={handleInputChange}
                     className="form-control mb-2"
                     placeholder="Lugar de trabajo"
                     required
                  />
               </div>
               <div className="mb-3">
                  <label className="required form-label">Zona de recidencia</label>
                  <select
                     id="zona_residencia"
                     name="zona_residencia"
                     value={formData.zona_residencia}
                     onChange={handleInputChange}
                     className="form-control select2"
                     required
                  >
                     <option value="">Seleccionar Zona de Residencia</option>
                     <option value="Guanacaste">Guanacaste</option>
                     <option value="Limón">Limón</option>
                     <option value="Puntarenas">Puntarenas</option>
                     <option value="Cartago">Cartago</option>
                     <option value="Zona Sur">Zona Sur</option>
                     <option value="Zona Norte">Zona Norte</option>
                     <option value="GAM Este">GAM Este</option>
                     <option value="GAM Oeste">GAM Oeste</option>
                     <option value="GAM Norte">GAM Norte</option>
                     <option value="GAM Sur">GAM Sur</option>
                  </select>
               </div>
            </div>
         </div>
      </>
   );

   /**
    * Renderiza el formulario del segundo cliente
    * @returns {React.ReactElement} - Elemento React para el formulario del segundo cliente
    * @description Renderiza el formulario del segundo cliente
    */
   const renderSecondClientForm = () => (
      <>
         <hr style={{ border: "2px solid #000" }} />
         <h4 className="card-title">Información Extra Segundo Cliente</h4>
         <div className="row">
            <div className="col-sm-6">
               <div className="mb-3">
                  <label className="form-label">NOMBRE CLIENTE 2</label>
                  <input
                     type="text"
                     name="custentity77"
                     id="custentity77"
                     value={formData.custentity77}
                     onChange={handleInputChange}
                     className="form-control mb-2"
                     placeholder="NOMBRE CLIENTE 2"
                  />
               </div>
               <div className="mb-3">
                  <label className="form-label">NACIONALIDAD 2</label>
                  <input
                     type="text"
                     name="custentity81"
                     id="custentity81"
                     value={formData.custentity81}
                     onChange={handleInputChange}
                     className="form-control mb-2"
                     placeholder="NACIONALIDAD 2"
                     required
                  />
               </div>
               <div className="mb-3">
                  <label className="form-label">ESTADO CIVIL 2</label>
                  <select
                     required
                     name="custentityestado_civil_extra"
                     id="custentityestado_civil_extra"
                     value={formData.custentityestado_civil_extra}
                     onChange={handleInputChange}
                     className="form-control"
                  >
                     <option value="">Seleccionar</option>
                     <option value="1">Casado/a</option>
                     <option value="2">Soltero/a</option>
                     <option value="3">Unión Libre</option>
                     <option value="4">Viudo</option>
                     <option value="5">Divorciado/a</option>
                  </select>
               </div>
               <div className="mb-3">
                  <label className="form-label">TELEFONO 2</label>
                  <input
                     type="text"
                     name="custentity82"
                     id="custentity82"
                     value={formData.custentity82}
                     onChange={handleInputChange}
                     className="form-control mb-2"
                     placeholder="TELEFONO 2"
                     required
                  />
               </div>
            </div>
            <div className="col-sm-6">
               <div className="mb-3">
                  <label className="form-label">N° CEDULA 2</label>
                  <input
                     type="text"
                     name="custentity78"
                     id="custentity78"
                     value={formData.custentity78}
                     onChange={handleInputChange}
                     className="form-control mb-2"
                     placeholder="N° CEDULA 2"
                     required
                  />
               </div>
               <div className="mb-3">
                  <label className="form-label">E-MAIL 2</label>
                  <input
                     type="text"
                     name="custentity84"
                     id="custentity84"
                     value={formData.custentity84}
                     onChange={handleInputChange}
                     className="form-control mb-2"
                     placeholder="E-MAIL 2"
                     required
                  />
               </div>
               <div className="mb-3">
                  <label className="form-label">PROFESIÓN 2</label>
                  <input
                     type="text"
                     name="custentity79"
                     id="custentity79"
                     value={formData.custentity79}
                     onChange={handleInputChange}
                     className="form-control mb-2"
                     placeholder="PROFESIÓN 2"
                     required
                  />
               </div>
            </div>
         </div>
      </>
   );

   const buttonEditLead = () => (
      <button type="button" onClick={handleSubmit} className="btn btn-dark waves-effect waves-light">
         Editar en el sistema
      </button>
   );

   return (
      <div className="container-fluid">
         <div className="row">
            <div className="col-12">
               <div className="card">
                  <div className="card-body" style={CARD_STYLES}>
                     <h4 className="card-title">Información recolectada de NetSuite (LEAD)</h4>
                     <div style={{ marginBottom: "25px" }}>
                        <ButtonActions leadData={leadDetails} className="mb-4" />
                     </div>
                     {renderPersonalInfoForm()}
                     {buttonEditLead()}
                     {renderAdditionalInfoForm()}
                     {renderSecondClientForm()}
                     {buttonEditLead()}
                  </div>
               </div>
            </div>
         </div>
      </div>
   );
};
