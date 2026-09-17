import { useCallback, useEffect, useMemo, useState } from "react";
import Select from "react-select";
import Swal from "sweetalert2";
import {
   createAdminKapsoIntegration,
   createKapsoCronjobConfig,
   createKapsoCronjobProjectConfig,
   deleteAdminKapsoIntegration,
   deleteKapsoCronjobProjectConfig,
   getAdminKapsoIntegrations,
   getKapsoAdministratorOptions,
   getKapsoCronjobConfigs,
   getKapsoProjectOptions,
   syncKapsoPhoneNumber,
   updateAdminKapsoIntegration,
   updateKapsoCronjobConfig,
   updateKapsoCronjobProjectConfig,
} from "../../../store/kapso/Api_provider_kapso";
import { CronjobFlowDiagram } from "./components/CronjobFlowDiagram";
import "./View_Kapso.css";

const emptyAdminForm = { assignmentId: "", idnetsuiteAdmin: "", integrationId: "" };
const emptyCronjobForm = { configId: "", cronjobId: "", isActive: true };
const emptyProjectForm = {
   cronjobConfigId: "",
   id: "",
   idproyectoLead: "",
   integrationId: "",
   isActive: true,
};

const unwrapApiData = (response) => {
   const unwrapped = !response?.ok
      ? []
      : Array.isArray(response.data)
        ? response.data
        : Array.isArray(response.data?.data)
          ? response.data.data
          : [];
   return unwrapped;
};

const getIntegrationLabel = (integration) =>
   integration.businessName ||
   integration.displayPhoneNumber ||
   integration.phoneNumber ||
   integration.kapsoPhoneNumberId ||
   "Integracion Kapso";

const getAdminOptionLabel = (admin) => `${admin.nameAdmin || "Admin sin nombre"} - ${admin.idnetsuiteAdmin}`;
const getProjectOptionLabel = (project) => `${project.proyectoLead || "Proyecto sin nombre"} - ${project.idproyectoLead}`;

const selectStyles = {
   control: (base, state) => ({
      ...base,
      borderColor: state.isFocused ? "#0f172a" : "#dbe3ee",
      borderRadius: 8,
      boxShadow: state.isFocused ? "0 0 0 3px rgba(15, 23, 42, 0.08)" : "none",
      minHeight: 44,
      "&:hover": { borderColor: "#0f172a" },
   }),
   menu: (base) => ({ ...base, borderRadius: 8, overflow: "hidden", zIndex: 1100 }),
   menuPortal: (base) => ({ ...base, zIndex: 1200 }),
};

export const View_Kapso = () => {
   const [activeView, setActiveView] = useState("integrations");
   const [adminForm, setAdminForm] = useState(emptyAdminForm);
   const [adminModalOpen, setAdminModalOpen] = useState(false);
   const [admins, setAdmins] = useState([]);
   const [cronjobForm, setCronjobForm] = useState(emptyCronjobForm);
   const [cronjobModalOpen, setCronjobModalOpen] = useState(false);
   const [cronjobs, setCronjobs] = useState([]);
   const [flowCronjob, setFlowCronjob] = useState(null);
   const [integrations, setIntegrations] = useState([]);
   const [isLoading, setIsLoading] = useState(true);
   const [isSaving, setIsSaving] = useState(false);
   const [projectForm, setProjectForm] = useState(emptyProjectForm);
   const [projectModalOpen, setProjectModalOpen] = useState(false);
   const [projects, setProjects] = useState([]);
   const [search, setSearch] = useState("");
   const [syncingIntegrationId, setSyncingIntegrationId] = useState("");

   const getIntegrationName = useCallback(
      (id) => {
         const integration = integrations.find((item) => item.id === String(id));
         return integration ? getIntegrationLabel(integration) : `Integracion ${id}`;
      },
      [integrations],
   );

   const getProjectName = useCallback(
      (idproyectoLead) => {
         const project = projects.find((item) => String(item.idproyectoLead) === String(idproyectoLead));
         return project ? getProjectOptionLabel(project) : `Proyecto ${idproyectoLead}`;
      },
      [projects],
   );

   const adminOptions = useMemo(
      () =>
         admins.map((admin) => ({
            label: getAdminOptionLabel(admin),
            searchText: [admin.nameAdmin, admin.emailAdmin, admin.idnetsuiteAdmin].filter(Boolean).join(" "),
            value: String(admin.idnetsuiteAdmin),
         })),
      [admins],
   );

   const integrationOptions = useMemo(
      () => integrations.map((integration) => ({ label: getIntegrationLabel(integration), value: integration.id })),
      [integrations],
   );

   const projectOptions = useMemo(
      () =>
         projects.map((project) => ({
            label: getProjectOptionLabel(project),
            searchText: [project.proyectoLead, project.idproyectoLead].filter(Boolean).join(" "),
            value: String(project.idproyectoLead),
         })),
      [projects],
   );

   const selectedProjectCronjob = useMemo(
      () => cronjobs.find((cronjob) => String(cronjob.id) === String(projectForm.cronjobConfigId)),
      [cronjobs, projectForm.cronjobConfigId],
   );

   const assignedProjectIdsForCurrentCronjob = useMemo(() => {
      if (!selectedProjectCronjob || !projectForm.integrationId) return new Set();

      return new Set(
         (selectedProjectCronjob.projectConfigs || [])
            .filter(
               (config) =>
                  String(config.kapsoIntegracionNumeroWhatsappId) === String(projectForm.integrationId) &&
                  String(config.id) !== String(projectForm.id),
            )
            .map((config) => String(config.idproyectoLead)),
      );
   }, [projectForm.id, projectForm.integrationId, selectedProjectCronjob]);

   const availableProjectOptions = useMemo(
      () => projectOptions.filter((option) => !assignedProjectIdsForCurrentCronjob.has(option.value)),
      [assignedProjectIdsForCurrentCronjob, projectOptions],
   );

   const selectedAdminIntegration = integrations.find((integration) => integration.id === adminForm.integrationId);
   const selectedAdminOption = adminOptions.find((option) => option.value === adminForm.idnetsuiteAdmin) || null;
   const selectedFlowProjectConfigs = flowCronjob?.projectConfigs || [];
   const selectedProjectOption = projectOptions.find((option) => option.value === projectForm.idproyectoLead) || null;
   const selectedProjectIntegrationOption = integrationOptions.find((option) => option.value === projectForm.integrationId) || null;

   const visibleIntegrations = useMemo(() => {
      const normalizedSearch = search.trim().toLowerCase();
      if (!normalizedSearch || activeView !== "integrations") return integrations;

      return integrations.filter((integration) =>
         [
            integration.businessName,
            integration.displayPhoneNumber,
            integration.phoneNumber,
            integration.kapsoPhoneNumberId,
            ...(integration.assignedAdmins || []).map((admin) => admin.nameAdmin),
            ...(integration.assignedAdmins || []).map((admin) => String(admin.idnetsuiteAdmin)),
         ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
      );
   }, [activeView, integrations, search]);

   const visibleCronjobs = useMemo(() => {
      const normalizedSearch = search.trim().toLowerCase();
      if (!normalizedSearch || activeView !== "cronjobs") return cronjobs;

      return cronjobs.filter((cronjob) =>
         [
            cronjob.cronjobId,
            ...(cronjob.projectConfigs || []).map((config) => getProjectName(config.idproyectoLead)),
            ...(cronjob.projectConfigs || []).map((config) => String(config.idproyectoLead)),
         ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
      );
   }, [activeView, cronjobs, getProjectName, search]);

   const loadProjects = async (searchText = "") => {
      const response = await getKapsoProjectOptions(searchText);
      if (!response.ok) throw new Error(response.errorMessage || "No se pudieron cargar proyectos.");
      setProjects(unwrapApiData(response));
   };

   const loadData = async () => {
      setIsLoading(true);
      try {
         const [integrationsResponse, adminsResponse, cronjobsResponse, projectsResponse] = await Promise.all([
            getAdminKapsoIntegrations({ includeInactive: 1 }),
            getKapsoAdministratorOptions("", 0),
            getKapsoCronjobConfigs(),
            getKapsoProjectOptions(),
         ]);

         if (!integrationsResponse.ok) throw new Error(integrationsResponse.errorMessage || "No se pudieron cargar integraciones.");
         if (!adminsResponse.ok) throw new Error(adminsResponse.errorMessage || "No se pudieron cargar administradores.");
         if (!cronjobsResponse.ok) throw new Error(cronjobsResponse.errorMessage || "No se pudieron cargar cronjobs.");
         if (!projectsResponse.ok) throw new Error(projectsResponse.errorMessage || "No se pudieron cargar proyectos.");

         const nextIntegrations = unwrapApiData(integrationsResponse);
         const nextAdmins = unwrapApiData(adminsResponse);
         const nextCronjobs = unwrapApiData(cronjobsResponse);
         const nextProjects = unwrapApiData(projectsResponse);
         setIntegrations(nextIntegrations);
         setAdmins(nextAdmins);
         setCronjobs(nextCronjobs);
         setProjects(nextProjects);
      } catch (error) {
         Swal.fire({ icon: "error", text: error.message, title: "Kapso" });
      } finally {
         setIsLoading(false);
      }
   };

   useEffect(() => {
      loadData();
   }, []);

   const closeModals = () => {
      if (isSaving) return;
      setAdminForm(emptyAdminForm);
      setCronjobForm(emptyCronjobForm);
      setFlowCronjob(null);
      setProjectForm(emptyProjectForm);
      setAdminModalOpen(false);
      setCronjobModalOpen(false);
      setProjectModalOpen(false);
   };

   const openAdminModal = (integration, assignment = null) => {
      setAdminForm({
         assignmentId: assignment?.assignmentId || "",
         idnetsuiteAdmin: assignment ? String(assignment.idnetsuiteAdmin) : "",
         integrationId: integration.id,
      });
      setAdminModalOpen(true);
   };

   const openCronjobModal = (cronjob = null) => {
      setCronjobForm({
         configId: cronjob?.id || "",
         cronjobId: cronjob?.cronjobId || "",
         isActive: cronjob ? Boolean(cronjob.isActive) : true,
      });
      setCronjobModalOpen(true);
   };

   const openProjectModal = async (cronjob, config = null) => {
      const nextForm = {
         cronjobConfigId: cronjob.id,
         id: config?.id || "",
         idproyectoLead: config?.idproyectoLead ? String(config.idproyectoLead) : "",
         integrationId: config?.kapsoIntegracionNumeroWhatsappId || integrations[0]?.id || "",
         isActive: config ? Boolean(config.isActive) : true,
      };

      setProjectForm(nextForm);
      await loadProjects();
      setProjectModalOpen(true);
   };

   const saveAdminAssignment = async (event) => {
      event.preventDefault();
      if (!adminForm.integrationId || !adminForm.idnetsuiteAdmin) {
         Swal.fire({ icon: "warning", text: "Seleccione integracion y administrador.", title: "Datos incompletos" });
         return;
      }

      setIsSaving(true);
      try {
         const payload = {
            idnetsuiteAdmin: Number(adminForm.idnetsuiteAdmin),
            kapsoIntegracionNumeroWhatsappId: adminForm.integrationId,
         };
         const response = adminForm.assignmentId
            ? await updateAdminKapsoIntegration(adminForm.assignmentId, { idnetsuiteAdmin: payload.idnetsuiteAdmin })
            : await createAdminKapsoIntegration(payload);

         if (!response.ok) throw new Error(response.errorMessage || "No se pudo guardar la asignacion.");
         closeModals();
         await loadData();
         Swal.fire({ icon: "success", showConfirmButton: false, timer: 1400, title: "Asignacion guardada" });
      } catch (error) {
         Swal.fire({ icon: "error", text: error.message, title: "Kapso" });
      } finally {
         setIsSaving(false);
      }
   };

   const saveCronjob = async (event) => {
      event.preventDefault();
      if (!cronjobForm.cronjobId.trim()) {
         Swal.fire({ icon: "warning", text: "Digite el Cronjob ID.", title: "Datos incompletos" });
         return;
      }

      setIsSaving(true);
      try {
         const payload = { config: {}, cronjobId: cronjobForm.cronjobId.trim(), isActive: cronjobForm.isActive };
         const response = cronjobForm.configId
            ? await updateKapsoCronjobConfig(cronjobForm.configId, payload)
            : await createKapsoCronjobConfig(payload);

         if (!response.ok) throw new Error(response.errorMessage || "No se pudo guardar el cronjob.");
         closeModals();
         await loadData();
         Swal.fire({ icon: "success", showConfirmButton: false, timer: 1400, title: "Cronjob guardado" });
      } catch (error) {
         Swal.fire({ icon: "error", text: error.message, title: "Kapso" });
      } finally {
         setIsSaving(false);
      }
   };

   const saveProjectConfig = async (event) => {
      event.preventDefault();
      if (!projectForm.cronjobConfigId || !projectForm.integrationId || !projectForm.idproyectoLead) {
         Swal.fire({ icon: "warning", text: "Seleccione integracion y proyecto.", title: "Datos incompletos" });
         return;
      }

      setIsSaving(true);
      try {
         const payload = {
            config: {},
            idnetsuiteAdmin: null,
            idproyectoLead: Number(projectForm.idproyectoLead),
            isActive: projectForm.isActive,
            kapsoIntegracionNumeroWhatsappId: projectForm.integrationId,
         };
         const response = projectForm.id
            ? await updateKapsoCronjobProjectConfig(projectForm.id, payload)
            : await createKapsoCronjobProjectConfig(projectForm.cronjobConfigId, payload);

         if (!response.ok) throw new Error(response.errorMessage || "No se pudo guardar el proyecto del cronjob.");
         closeModals();
         await loadData();
         Swal.fire({ icon: "success", showConfirmButton: false, timer: 1400, title: "Proyecto guardado" });
      } catch (error) {
         Swal.fire({ icon: "error", text: error.message, title: "Kapso" });
      } finally {
         setIsSaving(false);
      }
   };

   const toggleCronjobStatus = async (cronjob) => {
      setIsSaving(true);
      try {
         const nextIsActive = !cronjob.isActive;
         const response = await updateKapsoCronjobConfig(cronjob.id, {
            config: cronjob.config || {},
            cronjobId: cronjob.cronjobId,
            isActive: nextIsActive,
         });

         if (!response.ok) throw new Error(response.errorMessage || "No se pudo actualizar el cronjob.");
         await loadData();
         Swal.fire({
            icon: "success",
            showConfirmButton: false,
            timer: 1400,
            title: nextIsActive ? "Cronjob activado" : "Cronjob inactivado",
         });
      } catch (error) {
         Swal.fire({ icon: "error", text: error.message, title: "Kapso" });
      } finally {
         setIsSaving(false);
      }
   };

   const confirmDelete = async ({ action, text, title }) => {
      const confirmation = await Swal.fire({
         cancelButtonText: "Cancelar",
         confirmButtonColor: "#b91c1c",
         confirmButtonText: "Eliminar",
         icon: "warning",
         showCancelButton: true,
         text,
         title,
      });

      if (!confirmation.isConfirmed) return;

      const response = await action();
      if (!response.ok) {
         Swal.fire({ icon: "error", text: response.errorMessage || "No se pudo eliminar.", title: "Kapso" });
         return;
      }

      await loadData();
      Swal.fire({ icon: "success", showConfirmButton: false, timer: 1400, title: "Eliminado" });
   };

   const syncIntegration = async (integration) => {
      setSyncingIntegrationId(integration.id);
      try {
         const response = await syncKapsoPhoneNumber(integration.id);
         if (!response.ok) throw new Error(response.errorMessage || "No se pudo sincronizar la integracion.");
         await loadData();
         Swal.fire({ icon: "success", showConfirmButton: false, timer: 1400, title: "Integracion sincronizada" });
      } catch (error) {
         Swal.fire({ icon: "error", text: error.message, title: "Kapso" });
      } finally {
         setSyncingIntegrationId("");
      }
   };

   const renderIntegrations = () => (
      <div className="kapso-admin-table-wrap">
         <table className="kapso-admin-table">
            <thead>
               <tr>
                  <th>Integracion</th>
                  <th>Numero</th>
                  <th>Estado</th>
                  <th>Admins asignados</th>
                  <th>Acciones</th>
               </tr>
            </thead>
            <tbody>
               {isLoading ? (
                  <tr>
                     <td colSpan="5">
                        <div className="kapso-admin-empty">Cargando integraciones...</div>
                     </td>
                  </tr>
               ) : visibleIntegrations.length === 0 ? (
                  <tr>
                     <td colSpan="5">
                        <div className="kapso-admin-empty">No hay integraciones Kapso para mostrar.</div>
                     </td>
                  </tr>
               ) : (
                  visibleIntegrations.map((integration) => (
                     <tr key={integration.id}>
                        <td>
                           <strong>{getIntegrationLabel(integration)}</strong>
                           <small>ID Kapso: {integration.kapsoPhoneNumberId}</small>
                        </td>
                        <td>{integration.displayPhoneNumber || integration.phoneNumber || "Pendiente sync"}</td>
                        <td>
                           <span className={integration.isActive ? "kapso-status active" : "kapso-status inactive"}>
                              {integration.isActive ? "Activa" : "Inactiva"}
                           </span>
                        </td>
                        <td>
                           <div className="kapso-admin-chip-list">
                              {(integration.assignedAdmins || []).length === 0 ? (
                                 <span className="kapso-admin-muted">Sin admins asignados</span>
                              ) : (
                                 integration.assignedAdmins.map((assignment) => (
                                    <span className="kapso-admin-chip" key={assignment.assignmentId}>
                                       <span>
                                          {assignment.nameAdmin || `Admin ${assignment.idnetsuiteAdmin}`}
                                          <small>{assignment.idnetsuiteAdmin}</small>
                                       </span>
                                       <button
                                          aria-label="Editar asignacion"
                                          onClick={() => openAdminModal(integration, assignment)}
                                          type="button"
                                       >
                                          <i className="ti ti-pencil" />
                                       </button>
                                       <button
                                          aria-label="Eliminar asignacion"
                                          onClick={() =>
                                             confirmDelete({
                                                action: () => deleteAdminKapsoIntegration(assignment.assignmentId),
                                                text: "Se quitara este admin de la integracion Kapso.",
                                                title: "Eliminar asignacion",
                                             })
                                          }
                                          type="button"
                                       >
                                          <i className="ti ti-trash" />
                                       </button>
                                    </span>
                                 ))
                              )}
                           </div>
                        </td>
                        <td>
                           <div className="kapso-admin-actions">
                              <button
                                 className="kapso-admin-button is-secondary"
                                 disabled={syncingIntegrationId === integration.id}
                                 onClick={() => syncIntegration(integration)}
                                 type="button"
                              >
                                 <i className="ti ti-refresh" />
                                 {syncingIntegrationId === integration.id ? "Sync..." : "Sync"}
                              </button>
                              <button className="kapso-admin-button" onClick={() => openAdminModal(integration)} type="button">
                                 <i className="ti ti-user-plus" />
                                 Asignar
                              </button>
                           </div>
                        </td>
                     </tr>
                  ))
               )}
            </tbody>
         </table>
      </div>
   );

   const renderCronjobs = () => (
      <div className="kapso-cronjob-layout">
         <div className="kapso-admin-actions is-end">
            <button className="kapso-admin-button" onClick={() => openCronjobModal()} type="button">
               <i className="ti ti-clock-plus" />
               Crear cronjob
            </button>
         </div>
         <div className="kapso-admin-table-wrap">
            <table className="kapso-admin-table">
               <thead>
                  <tr>
                     <th>Cronjob</th>
                     <th>Estado</th>
                     <th>Proyectos configurados</th>
                     <th>Acciones</th>
                  </tr>
               </thead>
               <tbody>
                  {isLoading ? (
                     <tr>
                        <td colSpan="4">
                           <div className="kapso-admin-empty">Cargando cronjobs...</div>
                        </td>
                     </tr>
                  ) : visibleCronjobs.length === 0 ? (
                     <tr>
                        <td colSpan="4">
                           <div className="kapso-admin-empty">No hay cronjobs configurados.</div>
                        </td>
                     </tr>
                  ) : (
                     visibleCronjobs.map((cronjob) => (
                        <tr key={cronjob.id}>
                           <td>
                              <strong>{cronjob.cronjobId}</strong>
                              <small>ID interno: {cronjob.id}</small>
                           </td>
                           <td>
                              <span className={cronjob.isActive ? "kapso-status active" : "kapso-status inactive"}>
                                 {cronjob.isActive ? "Activo" : "Inactivo"}
                              </span>
                           </td>
                           <td>
                              <div className="kapso-admin-chip-list">
                                 {(cronjob.projectConfigs || []).length === 0 ? (
                                    <span className="kapso-admin-muted">Sin proyectos asignados</span>
                                 ) : (
                                    cronjob.projectConfigs.map((config) => (
                                       <span className="kapso-admin-chip is-wide" key={config.id}>
                                          <span>
                                             {getProjectName(config.idproyectoLead)}
                                             <small>{getIntegrationName(config.kapsoIntegracionNumeroWhatsappId)}</small>
                                             <small>{config.isActive ? "Flujo activo" : "Flujo inactivo"}</small>
                                          </span>
                                          <button
                                             aria-label="Editar proyecto cronjob"
                                             onClick={() => openProjectModal(cronjob, config)}
                                             type="button"
                                          >
                                             <i className="ti ti-pencil" />
                                          </button>
                                          <button
                                             aria-label="Eliminar proyecto cronjob"
                                             onClick={() =>
                                                confirmDelete({
                                                   action: () => deleteKapsoCronjobProjectConfig(config.id),
                                                   text: "Se quitara este proyecto del cronjob.",
                                                   title: "Eliminar proyecto",
                                                })
                                             }
                                             type="button"
                                          >
                                             <i className="ti ti-trash" />
                                          </button>
                                       </span>
                                    ))
                                 )}
                              </div>
                           </td>
                           <td>
                              <div className="kapso-admin-actions">
                                 <button className="kapso-admin-button is-secondary" onClick={() => openCronjobModal(cronjob)} type="button">
                                    <i className="ti ti-pencil" />
                                    Editar
                                 </button>
                                 <button className="kapso-admin-button" onClick={() => openProjectModal(cronjob)} type="button">
                                    <i className="ti ti-building-plus" />
                                    Proyecto
                                 </button>
                                 <button
                                    className={cronjob.isActive ? "kapso-admin-button is-warning" : "kapso-admin-button is-success"}
                                    disabled={isSaving}
                                    onClick={() => toggleCronjobStatus(cronjob)}
                                    type="button"
                                 >
                                    <i className={cronjob.isActive ? "ti ti-player-pause" : "ti ti-player-play"} />
                                    {cronjob.isActive ? "Inactivar" : "Activar"}
                                 </button>
                                 <button className="kapso-admin-button is-flow" onClick={() => setFlowCronjob(cronjob)} type="button">
                                    <i className="ti ti-git-branch" />
                                    Ver flujo
                                 </button>
                              </div>
                           </td>
                        </tr>
                     ))
                  )}
               </tbody>
            </table>
         </div>
      </div>
   );

   return (
      <div className="col-12">
         <section className="kapso-admin-page">
            <div className="kapso-admin-header">
               <div>
                  <span className="kapso-admin-kicker">Kapso</span>
                  <h1>{activeView === "integrations" ? "Asignacion de integraciones" : "Cronjobs configurados"}</h1>
                  <p>
                     {activeView === "integrations"
                        ? "Configura que administradores CRM pueden trabajar cada numero WhatsApp integrado."
                        : "Configura cronjobs generales y los proyectos CRM que puede ejecutar cada flujo."}
                  </p>
               </div>
               <button className="kapso-admin-button is-secondary" onClick={loadData} type="button">
                  <i className="ti ti-refresh" />
                  Refrescar
               </button>
            </div>

            <div className="kapso-admin-switch">
               <button className={activeView === "integrations" ? "is-active" : ""} onClick={() => setActiveView("integrations")} type="button">
                  Integraciones
               </button>
               <button className={activeView === "cronjobs" ? "is-active" : ""} onClick={() => setActiveView("cronjobs")} type="button">
                  Cronjobs
               </button>
            </div>

            <div className="kapso-admin-toolbar">
               <div className="kapso-admin-search">
                  <i className="ti ti-search" />
                  <input
                     onChange={(event) => setSearch(event.target.value)}
                     placeholder={activeView === "integrations" ? "Buscar numero, negocio o admin..." : "Buscar cronjob o proyecto..."}
                     type="search"
                     value={search}
                  />
               </div>
               <span className="kapso-admin-count">
                  {activeView === "integrations" ? `${visibleIntegrations.length} integraciones` : `${visibleCronjobs.length} cronjobs`}
               </span>
            </div>

            {activeView === "integrations" ? renderIntegrations() : renderCronjobs()}
         </section>

         {adminModalOpen && (
            <div className="kapso-admin-modal-backdrop" role="presentation">
               <div aria-modal="true" className="kapso-admin-modal" role="dialog">
                  <div className="kapso-admin-modal-header">
                     <div>
                        <h2>{adminForm.assignmentId ? "Editar asignacion" : "Asignar admin"}</h2>
                        <p>{selectedAdminIntegration ? getIntegrationLabel(selectedAdminIntegration) : "Integracion Kapso"}</p>
                     </div>
                     <button aria-label="Cerrar modal" onClick={closeModals} type="button">
                        <i className="ti ti-x" />
                     </button>
                  </div>
                  <form onSubmit={saveAdminAssignment}>
                     <label className="kapso-admin-field">
                        <span>Administrador CRM</span>
                        <Select
                           classNamePrefix="kapso-admin-select"
                           filterOption={(option, inputValue) => option.data.searchText.toLowerCase().includes(inputValue.toLowerCase())}
                           isClearable
                           isDisabled={isSaving}
                           menuPortalTarget={document.body}
                           noOptionsMessage={() => "No hay admins disponibles"}
                           onChange={(option) => setAdminForm((current) => ({ ...current, idnetsuiteAdmin: option?.value || "" }))}
                           options={adminOptions}
                           placeholder="Buscar por nombre o ID..."
                           styles={selectStyles}
                           value={selectedAdminOption}
                        />
                     </label>
                     <div className="kapso-admin-modal-actions">
                        <button className="kapso-admin-button is-secondary" disabled={isSaving} onClick={closeModals} type="button">
                           Cancelar
                        </button>
                        <button className="kapso-admin-button" disabled={isSaving} type="submit">
                           <i className="ti ti-device-floppy" />
                           {isSaving ? "Guardando..." : "Guardar"}
                        </button>
                     </div>
                  </form>
               </div>
            </div>
         )}

         {cronjobModalOpen && (
            <div className="kapso-admin-modal-backdrop" role="presentation">
               <div aria-modal="true" className="kapso-admin-modal" role="dialog">
                  <div className="kapso-admin-modal-header">
                     <div>
                        <h2>{cronjobForm.configId ? "Editar cronjob" : "Crear cronjob"}</h2>
                        <p>Configuracion general del flujo</p>
                     </div>
                     <button aria-label="Cerrar modal" onClick={closeModals} type="button">
                        <i className="ti ti-x" />
                     </button>
                  </div>
                  <form onSubmit={saveCronjob}>
                     <label className="kapso-admin-field">
                        <span>Cronjob ID</span>
                        <input
                           disabled={isSaving}
                           maxLength={80}
                           onChange={(event) => setCronjobForm((current) => ({ ...current, cronjobId: event.target.value }))}
                           placeholder="kapso-sync-chats-rdg"
                           type="text"
                           value={cronjobForm.cronjobId}
                        />
                     </label>
                     <label className="kapso-admin-toggle">
                        <input
                           checked={cronjobForm.isActive}
                           disabled={isSaving}
                           onChange={(event) => setCronjobForm((current) => ({ ...current, isActive: event.target.checked }))}
                           type="checkbox"
                        />
                        <span>Cronjob activo</span>
                     </label>
                     <div className="kapso-admin-modal-actions">
                        <button className="kapso-admin-button is-secondary" disabled={isSaving} onClick={closeModals} type="button">
                           Cancelar
                        </button>
                        <button className="kapso-admin-button" disabled={isSaving} type="submit">
                           <i className="ti ti-device-floppy" />
                           {isSaving ? "Guardando..." : "Guardar"}
                        </button>
                     </div>
                  </form>
               </div>
            </div>
         )}

         {projectModalOpen && (
            <div className="kapso-admin-modal-backdrop" role="presentation">
               <div aria-modal="true" className="kapso-admin-modal" role="dialog">
                  <div className="kapso-admin-modal-header">
                     <div>
                        <h2>{projectForm.id ? "Editar proyecto" : "Asignar proyecto"}</h2>
                        <p>Proyecto que puede ejecutar este cronjob</p>
                     </div>
                     <button aria-label="Cerrar modal" onClick={closeModals} type="button">
                        <i className="ti ti-x" />
                     </button>
                  </div>
                  <form onSubmit={saveProjectConfig}>
                     <label className="kapso-admin-field">
                        <span>Integracion Kapso</span>
                        <Select
                           classNamePrefix="kapso-admin-select"
                           isDisabled={isSaving}
                           menuPortalTarget={document.body}
                           onChange={async (option) => {
                              await loadProjects();
                              setProjectForm((current) => ({
                                 ...current,
                                 idproyectoLead: "",
                                 integrationId: option?.value || "",
                              }));
                           }}
                           options={integrationOptions}
                           placeholder="Seleccione integracion..."
                           styles={selectStyles}
                           value={selectedProjectIntegrationOption}
                        />
                     </label>
                     <label className="kapso-admin-field">
                        <span>Proyecto CRM</span>
                        <Select
                           classNamePrefix="kapso-admin-select"
                           filterOption={(option, inputValue) => option.data.searchText.toLowerCase().includes(inputValue.toLowerCase())}
                           isClearable
                           isDisabled={isSaving}
                           menuPortalTarget={document.body}
                           noOptionsMessage={() => "No hay proyectos disponibles para esta configuracion"}
                           onChange={(option) => setProjectForm((current) => ({ ...current, idproyectoLead: option?.value || "" }))}
                           onInputChange={(value, meta) => {
                              if (meta.action === "input-change") loadProjects(value);
                              return value;
                           }}
                           options={availableProjectOptions}
                           placeholder="Buscar por proyecto o ID..."
                           styles={selectStyles}
                           value={selectedProjectOption}
                        />
                     </label>
                     <label className="kapso-admin-toggle">
                        <input
                           checked={projectForm.isActive}
                           disabled={isSaving}
                           onChange={(event) => setProjectForm((current) => ({ ...current, isActive: event.target.checked }))}
                           type="checkbox"
                        />
                        <span>Flujo activo para ejecucion del cronjob</span>
                     </label>
                     <div className="kapso-admin-modal-actions">
                        <button className="kapso-admin-button is-secondary" disabled={isSaving} onClick={closeModals} type="button">
                           Cancelar
                        </button>
                        <button className="kapso-admin-button" disabled={isSaving} type="submit">
                           <i className="ti ti-device-floppy" />
                           {isSaving ? "Guardando..." : "Guardar"}
                        </button>
                     </div>
                  </form>
               </div>
            </div>
         )}

         {flowCronjob && (
            <div className="kapso-admin-modal-backdrop" role="presentation">
               <div aria-modal="true" className="kapso-admin-modal kapso-admin-flow-modal" role="dialog">
                  <div className="kapso-admin-modal-header">
                     <div>
                        <h2>Flujo del cronjob</h2>
                        <p>
                           {flowCronjob.cronjobId} · ID interno: {flowCronjob.id}
                        </p>
                     </div>
                     <button aria-label="Cerrar modal" onClick={closeModals} type="button">
                        <i className="ti ti-x" />
                     </button>
                  </div>

                  <div className="kapso-flow-body">
                     <div className="kapso-flow-summary">
                        <span className={flowCronjob.isActive ? "kapso-status active" : "kapso-status inactive"}>
                           {flowCronjob.isActive ? "Activo" : "Inactivo"}
                        </span>
                        <span>
                           {selectedFlowProjectConfigs.length === 1
                              ? "1 proyecto configurado"
                              : `${selectedFlowProjectConfigs.length} proyectos configurados`}
                        </span>
                     </div>

                     <div className="kapso-flow-projects">
                        <h3>Proyectos que puede procesar</h3>
                        {selectedFlowProjectConfigs.length === 0 ? (
                           <p>Sin proyectos asignados. El cronjob no encontrara leads para enviar el template.</p>
                        ) : (
                           <div className="kapso-flow-project-grid">
                              {selectedFlowProjectConfigs.map((config) => (
                                 <span
                                    className={config.isActive ? "kapso-flow-project is-active" : "kapso-flow-project is-inactive"}
                                    key={config.id}
                                 >
                                    <strong>{getProjectName(config.idproyectoLead)}</strong>
                                    <small>{getIntegrationName(config.kapsoIntegracionNumeroWhatsappId)}</small>
                                    <small>{config.isActive ? "Flujo activo" : "Flujo inactivo"}</small>
                                 </span>
                              ))}
                           </div>
                        )}
                     </div>

                     <CronjobFlowDiagram cronjob={flowCronjob} getProjectName={getProjectName} />
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};
