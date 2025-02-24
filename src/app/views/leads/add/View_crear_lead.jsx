import React, { useState, useEffect } from "react";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import Swal from "sweetalert2";
import { useDispatch } from "react-redux";
import {
   createdNewLeadNetsuite,
   getDataSelectAdmins,
   getDataSelectCampaing,
   getDataSelectCorredor,
   getDataSelectProyect,
   getDataSelectSubsidiaria,
} from "../../../../store/leads/thunksLeads";

import { useNavigate } from "react-router-dom";

/**
 * Initial form state for the lead creation form
 * @type {Object}
 * @property {string} firstname_new - First name of the lead
 * @property {string} email_new - Email of the lead
 * @property {string} phone_new - Phone number of the lead
 * @property {string} comentario_cliente_new - Comments for the lead
 * @property {Object} campana_new - Campaign for the lead
 * @property {Object} proyecto_new - Project for the lead
 */
const initialFormState = {
   firstname_new: "",
   email_new: "",
   phone_new: "",
   comentario_cliente_new: "",
   campana_new: null,
   proyecto_new: null,
   subsidiary_new: null,
   vendedor_new: null,
   corredor_lead_new: null,
};

/**
 * Required fields for lead creation
 * @type {string[]}
 * @property {string} firstname_new - First name of the lead
 * @property {string} email_new - Email of the lead
 * @property {string} phone_new - Phone number of the lead
 * @property {string} comentario_cliente_new - Comments for the lead
 * @property {Object} campana_new - Campaign for the lead
 * @property {Object} proyecto_new - Project for the lead
 * @property {Object} subsidiary_new - Subsidiary for the lead
 */
const requiredFields = ["firstname_new", "email_new", "phone_new", "comentario_cliente_new", "campana_new", "proyecto_new", "subsidiary_new"];

/**
 * Component for creating a new lead
 * @returns {JSX.Element} Lead creation form
 * @param {Object} formData - Form data for lead creation
 * @param {Object} selectOptions - Select options for the form
 * @param {Function} handleChange - Function to handle input changes
 * @param {Function} handleSelectChange - Function to handle select changes
 * @param {Function} validateForm - Function to validate the form
 * @param {Function} handleCreateLead - Function to handle lead creation
 * @param {Function} handleSuccessfulCreation - Function to handle successful lead creation
 */
export const View_crear_lead = () => {
   //navigate para redireccionar
   const navigate = useNavigate();

   //dispatch para ejecutar las funciones de los thunks
   const dispatch = useDispatch();
   //estado para guardar los datos del formulario
   const [formData, setFormData] = useState(initialFormState);
   //estado para guardar las opciones de los select
   const [selectOptions, setSelectOptions] = useState({
      campaigns: [],
      projects: [],
      corredores: [],
      subsidiaries: [],
      vendors: [],
   });

   /**
    * Fetches data for all select inputs
    * @returns {Promise<void>} Fetches data for all select inputs
    * @throws {Error} If there is an error fetching the data
    * @description Fetches data for all select inputs
    * @param {number} id - Id of the data to fetch
    * @param {string} name - Name of the data to fetch
    * @param {string} label - Label of the data to fetch
    * @param {string} placeholder - Placeholder of the data to fetch
    * @param {string} type - Type of the data to fetch
    * @param {string} value - Value of the data to fetch
    * @param {string} onChange - On change of the data to fetch
    * @param {string} required - Required of the data to fetch
    */
   const fetchSelectData = async () => {
      try {
         //espera a que se ejecuten todas las promesas
         const [resultCampaing, resultProyect, resultSubsidiaria, resultAdmins, resultCorredor] = await Promise.all([
            dispatch(getDataSelectCampaing(1)),
            dispatch(getDataSelectProyect(1)),
            dispatch(getDataSelectSubsidiaria(1)),
            dispatch(getDataSelectAdmins(1)),
            dispatch(getDataSelectCorredor(1)),
         ]);
         //setea las opciones de los select.

         setSelectOptions({
            campaigns: resultCampaing.map((c) => ({
               value: c.id_NetsauiteCampana,
               label: c.Nombre_Campana,
            })),
            projects: resultProyect.map((p) => ({
               value: p.id_ProNetsuite,
               label: p.Nombre_proyecto,
            })),
            subsidiaries: resultSubsidiaria.map((s) => ({
               value: s.id_NetsuiteSub,
               label: s.Nombre_Subsidiaria,
            })),
            vendors: resultAdmins
               .filter((v) => v.viewAdmin !== 1)
               .map((v) => ({
                  value: v.idnetsuite_admin,
                  label: v.name_admin,
               })),
            corredores: resultCorredor.map((v) => ({
               value: v.id_netsuiteCorredor,
               label: v.nombre_corredor,
            })),
         });
      } catch (error) {
         console.error("Error fetching select data:", error);
         showErrorAlert("Error al cargar los datos. Por favor, intente nuevamente.");
      }
   };

   /**
    * Fetches select data when the component mounts
    * @returns {Promise<void>} Fetches select data when the component mounts
    * @throws {Error} If there is an error fetching the select data
    * @description Fetches select data when the component mounts
    * @param {number} dispatch - Dispatch of the component
    */
   useEffect(() => {
      fetchSelectData();
   }, [dispatch]);

   /**
    * Handles input change for text fields
    * @param {Object} e - Event object
    * @param {Object} e.target - Target object of the event
    * @param {string} e.target.name - Name of the input field
    * @param {string} e.target.value - Value of the input field
    * @returns {void} Handles input change for text fields
    */
   const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData((prev) => ({ ...prev, [name]: value }));
      updateFieldBorder(name, value !== "");
   };

   /**
    * Handles change for select inputs
    * @param {Object} selectedOption - Selected option
    * @param {Object} action - Action object
    * @param {string} action.name - Name of the input field
    * @returns {void} Handles change for select inputs
    */
   const handleSelectChange = (selectedOption, action) => {
      setFormData((prev) => ({ ...prev, [action.name]: selectedOption }));
      updateFieldBorder(action.name, true);
   };

   /**
    * Updates field border based on validation
    * @param {string} fieldId - Id of the field to update
    * @param {boolean} isValid - Whether the field is valid
    * @returns {void} Updates field border based on validation
    */
   const updateFieldBorder = (fieldId, isValid) => {
      const element = document.getElementById(fieldId);
      if (element) {
         element.style.border = isValid ? "1px solid #ced4da" : "2px solid red";
      }
   };

   /**
    * Validates form fields
    * @returns {boolean} Whether the form is valid
    */
   const validateForm = () => {
      const missingFields = requiredFields.filter((field) => !formData[field]);
      if (missingFields.length > 0) {
         missingFields.forEach((field) => updateFieldBorder(field, false));
         showErrorAlert("Por favor, completa todos los campos obligatorios.");
         return false;
      }
      return true;
   };

   /**
    * Shows error alert
    * @param {string} message - Message to display in the alert
    * @returns {void} Shows error alert
    */
   const showErrorAlert = (message) => {
      Swal.fire({
         icon: "error",
         title: "Campos obligatorios",
         text: message,
      });
   };

   /**
    * Handles lead creation
    * @returns {Promise<void>} Handles lead creation
    */
   const handleCreateLead = async () => {
      if (!validateForm()) return;

      const confirmResult = await Swal.fire({
         title: "¿Estás seguro?",
         text: "Estás a punto de crear un nuevo cliente.",
         icon: "warning",
         showCancelButton: true,
         confirmButtonColor: "#3085d6",
         cancelButtonColor: "#d33",
         confirmButtonText: "Sí, crear",
         cancelButtonText: "No, cancelar",
      });

      if (confirmResult.isConfirmed) {
         await createLead();
      }
   };

   /**
    * Creates new lead in Netsuite
    * @returns {Promise<void>} Creates new lead in Netsuite
    */
   const createLead = async () => {
      Swal.fire({
         title: "Creando cliente...",
         allowOutsideClick: false,
         didOpen: () => Swal.showLoading(),
      });

      try {
         const result = await dispatch(createdNewLeadNetsuite(formData));
         const response = result.data.Detalle;

         if (response.status === 200) {
            await handleSuccessfulCreation(response.id);
         } else if (response.status === 500) {
            handleCreationError(response.Error);
         }
      } catch (error) {
         console.error("Error creating lead:", error);
         showErrorAlert("Error al crear el lead. Por favor, intente nuevamente.");
      }
   };

   /**
    * Handles successful lead creation
    * @param {number} id - Id of the lead
    * @returns {Promise<void>} Handles successful lead creation
    */
   const handleSuccessfulCreation = async (id) => {
      await Swal.fire({
         position: "top-end",
         icon: "success",
         title: "Se creó un nuevo lead con éxito",
         showConfirmButton: false,
         timer: 3500,
         willClose: () => {
            navigate(`/leads/perfil?data=${id}`);
         }
      });
   };

   /**
    * Handles lead creation error
    * @param {string} errorData - Error data
    * @returns {void} Handles lead creation error
    */
   const handleCreationError = (errorData) => {
      const error = JSON.parse(errorData);
      Swal.fire({
         html: `
            <h4>Detalle de error:</h4>
            <p>${error.details}, <br> Lo sentimos, favor revisar este error con su administrador.</p>
         `,
         icon: "question",
         width: "40em",
         padding: "0 0 1.25em",
         iconHtml: "؟",
         confirmButtonText: "OK",
         cancelButtonText: "CORREGIR",
         showCancelButton: true,
         showCloseButton: true,
      });
   };

   /**
    * Renders form input field
    * @param {Object} name - Name of the input field
    * @param {string} label - Label of the input field
    * @param {string} type - Type of the input field
    * @param {string} placeholder - Placeholder of the input field
    * @returns {JSX.Element} Renders form input field
    */
   const renderInputField = ({ name, label, type = "text", placeholder }) => (
      <div className="mb-3">
         <label className="required form-label">{label}</label>
         <br />
         <input
            type={type}
            name={name}
            id={name}
            className="form-control mb-2"
            placeholder={placeholder}
            value={formData[name]}
            onChange={handleChange}
            required
         />
      </div>
   );

   /**
    * Renders select field
    * @param {Object} name - Name of the select field
    * @param {string} label - Label of the select field
    * @param {Object[]} options - Options for the select field
    * @returns {JSX.Element} Renders select field
    */
   const renderSelectField = ({ name, label, options }) => (
      <div className="mb-3">
         <label className="required form-label">{label}</label>
         <br />
         <Select
            id={name}
            name={name}
            components={makeAnimated()}
            options={options}
            value={formData[name]}
            onChange={handleSelectChange}
            isSearchable
            required
         />
      </div>
   );

   /**
    * Renders the main component
    * @returns {JSX.Element} Main component
    */
   return (
      <div className="card">
         <div
            className="card-body"
            style={{
               borderRadius: "13px",
               background: "#fcfcfc",
               boxShadow: "5px 5px 100px #656565, -5px -5px 100px #ffffff",
            }}
         >
            <h4 className="card-title">
               <strong>Crear un nuevo lead</strong>
            </h4>
            <p className="mb-0">
               <i className="mdi mdi-circle-medium align-middle text-primary me-1"></i>
               Brinda la mayor información para crear el lead.
            </p>
            <br />
            <div className="row">
               <div className="col-sm-6">
                  {renderInputField({
                     name: "firstname_new",
                     label: "Nombre Completo del cliente",
                     placeholder: "Nombre del lead",
                  })}
                  {renderInputField({
                     name: "email_new",
                     label: "Correo lead",
                     type: "email",
                     placeholder: "Correo electrónico",
                  })}
                  {renderInputField({
                     name: "phone_new",
                     label: "Número de teléfono",
                     placeholder: "Número de teléfono",
                  })}
                  {renderInputField({
                     name: "comentario_cliente_new",
                     label: "Comentarios",
                     placeholder: "Ingrese un comentario obligatorio",
                  })}
               </div>
               <div className="col-sm-6">
                  {renderSelectField({
                     name: "proyecto_new",
                     label: "Proyectos",
                     options: selectOptions.projects,
                  })}
                  {renderSelectField({
                     name: "campana_new",
                     label: "Campaña Marketing",
                     options: selectOptions.campaigns,
                  })}
                  {renderSelectField({
                     name: "subsidiary_new",
                     label: "Subsidiaria",
                     options: selectOptions.subsidiaries,
                  })}
                  {renderSelectField({
                     name: "corredor_lead_new",
                     label: "Corredor Cliente",
                     options: selectOptions.corredores,
                  })}
                  {renderSelectField({
                     name: "vendedor_new",
                     label: "Asignar Lead A un Vendedor",
                     options: selectOptions.vendors,
                  })}
               </div>
            </div>
            <button type="button" className="btn btn-dark" onClick={handleCreateLead}>
               Crear Nueva Lead
            </button>
         </div>
      </div>
   );
};
