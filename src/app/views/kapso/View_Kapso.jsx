import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";

import { getDataSelectProyect } from "../../../store/leads/thunksLeads";
import {
   getKapsoIntegrations,
   getKapsoTemplatesByIntegration,
} from "../../../store/kapso/Api_provider_kapso";

const normalizeProjects = (projects) => {
   if (!Array.isArray(projects)) {
      return [];
   }

   return projects
      .map((project) => ({
         value: String(project.ID_Proyecto ?? project.id_proyecto ?? ""),
         label:
            project.Nombre_proyecto ??
            project.nombre_proyecto ??
            `Proyecto ${project.ID_Proyecto ?? ""}`,
      }))
      .filter((project) => project.value && project.label);
};

const normalizeIntegrations = (integrations) => {
   if (!Array.isArray(integrations)) {
      return [];
   }

   return integrations.map((integration) => ({
      value: integration.codigoIntegration,
      label: integration.nombreIntegration,
      phoneNumberDisplay: integration.phoneNumberDisplay ?? "--",
      phoneNumberId: integration.phoneNumberId ?? "--",
   }));
};

const getTemplateOptionLabel = (template) => {
   return template.status
      ? `${template.name} - ${template.status}`
      : template.name;
};

export const View_Kapso = () => {
   const dispatch = useDispatch();
   const [projectOptions, setProjectOptions] = useState([]);
   const [integrationOptions, setIntegrationOptions] = useState([]);
   const [templateOptions, setTemplateOptions] = useState([]);
   const [selectedProject, setSelectedProject] = useState("");
   const [selectedIntegration, setSelectedIntegration] = useState("");
   const [selectedTemplate, setSelectedTemplate] = useState("");
   const [isLoadingProjects, setIsLoadingProjects] = useState(true);
   const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(true);
   const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
   const [errorMessage, setErrorMessage] = useState("");

   useEffect(() => {
      const loadProjects = async () => {
         setIsLoadingProjects(true);

         try {
            const projects = await dispatch(getDataSelectProyect(1));
            setProjectOptions(normalizeProjects(projects));
         } catch (error) {
            console.error("No se pudieron cargar los proyectos", error);
            setErrorMessage(
               "No se pudieron cargar los proyectos del CRM en este momento.",
            );
         } finally {
            setIsLoadingProjects(false);
         }
      };

      loadProjects();
   }, [dispatch]);

   useEffect(() => {
      const loadIntegrations = async () => {
         setIsLoadingIntegrations(true);

         const response = await getKapsoIntegrations();

         if (!response.ok) {
            setIntegrationOptions([]);
            setErrorMessage(
               "No se pudieron cargar las integraciones de Kapso en este momento.",
            );
            setIsLoadingIntegrations(false);
            return;
         }

         setIntegrationOptions(normalizeIntegrations(response.data));
         setIsLoadingIntegrations(false);
      };

      loadIntegrations();
   }, []);

   useEffect(() => {
      if (!selectedIntegration) {
         setTemplateOptions([]);
         setSelectedTemplate("");
         return;
      }

      const loadTemplates = async () => {
         setIsLoadingTemplates(true);
         setErrorMessage("");

         const response = await getKapsoTemplatesByIntegration(selectedIntegration);

         if (!response.ok) {
            setTemplateOptions([]);
            setSelectedTemplate("");
            setErrorMessage(
               "No se pudieron cargar los templates disponibles para la integración seleccionada.",
            );
            setIsLoadingTemplates(false);
            return;
         }

         const templates = Array.isArray(response.data) ? response.data : [];
         setTemplateOptions(templates);
         setSelectedTemplate((currentTemplate) =>
            templates.some((template) => template.id === currentTemplate)
               ? currentTemplate
               : "",
         );
         setIsLoadingTemplates(false);
      };

      loadTemplates();
   }, [selectedIntegration]);

   const selectedIntegrationData = useMemo(
      () =>
         integrationOptions.find(
            (integration) => integration.value === selectedIntegration,
         ) ?? null,
      [integrationOptions, selectedIntegration],
   );

   return (
      <div className="col-12">
         <div className="card">
            <div className="card-body">
               <div className="mb-4">
                  <h1 className="h3 mb-1">Configuración de envío de template para leads nuevos</h1>
                  <p className="text-muted mb-0">
                     Selecciona proyecto CRM, número Kapso y template disponible.
                  </p>
               </div>

               {errorMessage && (
                  <div className="alert alert-warning" role="alert">
                     {errorMessage}
                  </div>
               )}

               <div className="row g-3 mb-4">
                  <div className="col-12 col-lg-4">
                     <label className="form-label fw-semibold">Proyecto</label>
                     <select
                        className="form-select"
                        value={selectedProject}
                        onChange={(event) => setSelectedProject(event.target.value)}
                        disabled={isLoadingProjects}
                     >
                        <option value="">
                           {isLoadingProjects
                              ? "Cargando proyectos..."
                              : "Seleccionar proyecto"}
                        </option>
                        {projectOptions.map((project) => (
                           <option key={project.value} value={project.value}>
                              {project.label}
                           </option>
                        ))}
                     </select>
                  </div>

                  <div className="col-12 col-lg-4">
                     <label className="form-label fw-semibold">Número Kapso</label>
                     <select
                        className="form-select"
                        value={selectedIntegration}
                        onChange={(event) => setSelectedIntegration(event.target.value)}
                        disabled={isLoadingIntegrations}
                     >
                        <option value="">
                           {isLoadingIntegrations
                              ? "Cargando integraciones..."
                              : "Seleccionar número Kapso"}
                        </option>
                        {integrationOptions.map((integration) => (
                           <option key={integration.value} value={integration.value}>
                              {integration.label}
                           </option>
                        ))}
                     </select>
                     {selectedIntegrationData && (
                        <small className="text-muted d-block mt-2">
                           {selectedIntegrationData.phoneNumberDisplay} | ID{" "}
                           {selectedIntegrationData.phoneNumberId}
                        </small>
                     )}
                  </div>

                  <div className="col-12 col-lg-4">
                     <label className="form-label fw-semibold">Template</label>
                     <select
                        className="form-select"
                        value={selectedTemplate}
                        onChange={(event) => setSelectedTemplate(event.target.value)}
                        disabled={!selectedIntegration || isLoadingTemplates}
                     >
                        <option value="">
                           {!selectedIntegration
                              ? "Primero selecciona un número Kapso"
                              : isLoadingTemplates
                                 ? "Cargando templates..."
                                 : "Seleccionar template"}
                        </option>
                        {templateOptions.map((template) => (
                           <option key={template.id} value={template.id}>
                              {getTemplateOptionLabel(template)}
                           </option>
                        ))}
                     </select>
                  </div>
               </div>

               <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                     <thead>
                        <tr>
                           <th>Template</th>
                           <th>Estado</th>
                           <th>Categoría</th>
                           <th>Idioma</th>
                           <th>Parámetros</th>
                           <th>Preview</th>
                        </tr>
                     </thead>
                     <tbody>
                        {!selectedIntegration && (
                           <tr>
                              <td colSpan="6" className="text-muted text-center py-4">
                                 Selecciona un número Kapso para consultar los templates disponibles.
                              </td>
                           </tr>
                        )}

                        {selectedIntegration &&
                           !isLoadingTemplates &&
                           templateOptions.length === 0 && (
                              <tr>
                                 <td
                                    colSpan="6"
                                    className="text-muted text-center py-4"
                                 >
                                    No hay templates disponibles para esta integración.
                                 </td>
                              </tr>
                           )}

                        {templateOptions.map((template) => (
                           <tr
                              key={template.id}
                              className={
                                 selectedTemplate === template.id ? "table-active" : ""
                              }
                           >
                              <td>
                                 <div className="fw-semibold">{template.name}</div>
                                 <small className="text-muted">{template.id}</small>
                              </td>
                              <td>{template.status ?? "--"}</td>
                              <td>{template.category ?? "--"}</td>
                              <td>{template.language ?? "--"}</td>
                              <td>{template.parameterCount}</td>
                              <td>{template.preview ?? "--"}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
         </div>
      </div>
   );
};
