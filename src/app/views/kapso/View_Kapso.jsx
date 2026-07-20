import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Select from "react-select";
import Swal from "sweetalert2";

import {
   createAdminKapsoIntegration,
   deleteAdminKapsoIntegration,
   deleteKapsoFlowProjectMedia,
   getAdminKapsoIntegrationById,
   getAdminKapsoIntegrations,
   getKapsoFlowProjectMedia,
   getKapsoBusinessFlows,
   getKapsoAdministratorOptions,
   getKapsoPhoneNumberOptions,
   getKapsoProjectOptions,
   enableKapsoBusinessFlowProject,
   disableKapsoBusinessFlowProject,
   updateAdminKapsoIntegration,
   updateAdminKapsoIntegrationStatus,
   uploadKapsoFlowProjectMedia,
} from "../../../store/kapso/Api_provider_kapso";

// ============================================================================
// CONSTANTES DE UI
// ============================================================================

const STATUS_OPTIONS = [
   { value: 1, label: "Activa" },
   { value: 0, label: "Inactiva" },
];

const EMPTY_FORM = {
   administrator: null,
   phoneNumber: null,
   status: STATUS_OPTIONS[0],
};

const INITIAL_FILTERS = {
   search: "",
   idnetsuiteAdmin: "",
   kapsoPhoneNumberId: "",
   status: "",
   page: 1,
   pageSize: 10,
};

const selectStyles = {
   control: (base, state) => ({
      ...base,
      minHeight: 46,
      borderRadius: 12,
      borderColor: state.isFocused ? "#198754" : "#dbe3ef",
      boxShadow: state.isFocused ? "0 0 0 0.2rem rgba(25, 135, 84, 0.12)" : "none",
      "&:hover": {
         borderColor: "#198754",
      },
   }),
   menu: (base) => ({
      ...base,
      zIndex: 9999,
      borderRadius: 12,
      overflow: "hidden",
   }),
   menuPortal: (base) => ({
      ...base,
      zIndex: 1300,
   }),
};

// ============================================================================
// HELPERS
// ============================================================================

const getRelationStatusBadgeClass = (status) => {
   return status === 1 ? "bg-success-subtle text-success" : "bg-secondary-subtle text-secondary";
};

const getAdministratorLabel = (administrator) => {
   if (!administrator) {
      return "";
   }

   return `${administrator.name || "Administrador sin nombre"} — NetSuite ID: ${administrator.idnetsuiteAdmin}`;
};

const getPhoneNumberLabel = (integration) => {
   if (!integration) {
      return "";
   }

   const mainLabel =
      integration.displayPhoneNumber || integration.phoneNumberName || integration.phoneNumberId || `Integración ${integration.id}`;
   const secondaryLabel =
      integration.phoneNumberName && integration.phoneNumberName !== integration.displayPhoneNumber ? ` — ${integration.phoneNumberName}` : "";

   return `${mainLabel}${secondaryLabel}`;
};

const mapAdministratorOption = (administrator) => ({
   value: administrator.idnetsuiteAdmin,
   label: getAdministratorLabel(administrator),
   raw: administrator,
});

const mapPhoneNumberOption = (integration) => ({
   value: integration.id,
   label: getPhoneNumberLabel(integration),
   raw: integration,
});

const mapProjectOption = (project) => ({
   value: project.idProyecto,
   label: project.nombreProyecto,
   raw: project,
});

const getFlowProjectMediaKey = (flowUuid, project) => {
   return `${flowUuid}:${project.idProyectoNetsuite ?? project.idProyecto}`;
};

const getFlowProjectMediaId = (project) => {
   return project.idProyectoNetsuite ?? project.idProyecto;
};

const formatFileSize = (fileSize = 0) => {
   if (!fileSize) {
      return "";
   }

   if (fileSize < 1024 * 1024) {
      return `${Math.round(fileSize / 1024)} KB`;
   }

   return `${(fileSize / 1024 / 1024).toFixed(1)} MB`;
};

const getMediaTypeLabel = (mediaType) => {
   const labels = {
      document: "Documento",
      image: "Imagen",
      video: "Video",
   };

   return labels[mediaType] || "Archivo";
};

const getMediaDisplayName = (media) => {
   const extension = (media?.mimeType?.split("/")[1] || media?.storedFilename?.split(".").pop() || "").toUpperCase();
   const normalizedExtension = extension === "JPEG" ? "JPG" : extension;

   return [getMediaTypeLabel(media?.mediaType), normalizedExtension].filter(Boolean).join(" ");
};

const getMediaTypeIcon = (mediaType) => {
   const icons = {
      document: "ti-file-text",
      image: "ti-photo",
      video: "ti-video",
   };

   return icons[mediaType] || "ti-paperclip";
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export const View_Kapso = () => {
   const [filters, setFilters] = useState(INITIAL_FILTERS);
   const [tableState, setTableState] = useState({
      loading: true,
      error: "",
      items: [],
      meta: {
         total: 0,
         page: 1,
         pageSize: 10,
         totalPages: 1,
      },
   });
   const [administratorOptions, setAdministratorOptions] = useState([]);
   const [phoneNumberOptions, setPhoneNumberOptions] = useState([]);
   const [projectOptions, setProjectOptions] = useState([]);
   const [businessFlowsState, setBusinessFlowsState] = useState({
      loading: true,
      error: "",
      items: [],
   });
   const [flowProjectDrafts, setFlowProjectDrafts] = useState({});
   const [flowProjectMediaState, setFlowProjectMediaState] = useState({});
   const [optionsLoading, setOptionsLoading] = useState(true);
   const [optionsError, setOptionsError] = useState("");
   const [modalOpen, setModalOpen] = useState(false);
   const [modalLoading, setModalLoading] = useState(false);
   const [modalMode, setModalMode] = useState("create");
   const [editingRelationId, setEditingRelationId] = useState(null);
   const [expandedRowId, setExpandedRowId] = useState(null);
   const [previewMedia, setPreviewMedia] = useState(null);
   const [hoveredMedia, setHoveredMedia] = useState(null);
   const [activeConfigurationSection, setActiveConfigurationSection] = useState("admins");
   const [form, setForm] = useState(EMPTY_FORM);
   const [formError, setFormError] = useState("");

   const activeRelations = useMemo(() => tableState.items.filter((relation) => relation.status === 1).length, [tableState.items]);

   const loadRelations = async (nextFilters = filters) => {
      setTableState((previous) => ({
         ...previous,
         loading: true,
         error: "",
      }));

      const response = await getAdminKapsoIntegrations(nextFilters);

      if (!response.ok) {
         setTableState((previous) => ({
            ...previous,
            loading: false,
            error: response.errorMessage || "No se pudo cargar la configuración Admin–Kapso.",
         }));
         return;
      }

      setTableState({
         loading: false,
         error: "",
         items: response.data.items || [],
         meta: response.data.meta || {
            total: 0,
            page: 1,
            pageSize: nextFilters.pageSize,
            totalPages: 1,
         },
      });
   };

   const loadFlowProjectMedia = useCallback(async (flow, project) => {
      const projectMediaId = getFlowProjectMediaId(project);
      const mediaKey = getFlowProjectMediaKey(flow.flowUuid, project);

      setFlowProjectMediaState((previous) => ({
         ...previous,
         [mediaKey]: {
            ...(previous[mediaKey] || {}),
            loading: true,
            error: "",
         },
      }));

      const response = await getKapsoFlowProjectMedia(flow.flowUuid, projectMediaId);

      setFlowProjectMediaState((previous) => ({
         ...previous,
         [mediaKey]: {
            ...(previous[mediaKey] || {}),
            loading: false,
            uploading: false,
            error: response.ok ? "" : response.errorMessage || "No se pudieron cargar los adjuntos.",
            items: response.ok ? response.data || [] : previous[mediaKey]?.items || [],
         },
      }));
   }, []);

   const loadFlowMediaCollections = useCallback(async (flows) => {
      const mediaLoaders = [];

      flows.forEach((flow) => {
         (flow.projects || []).forEach((project) => {
            mediaLoaders.push(loadFlowProjectMedia(flow, project));
         });
      });

      await Promise.all(mediaLoaders);
   }, [loadFlowProjectMedia]);

   const loadBusinessFlows = useCallback(async () => {
      setBusinessFlowsState((previous) => ({
         ...previous,
         loading: true,
         error: "",
      }));

      const response = await getKapsoBusinessFlows();

      if (!response.ok) {
         setBusinessFlowsState((previous) => ({
            ...previous,
            loading: false,
            error: response.errorMessage || "No se pudieron cargar los flujos Kapso.",
         }));
         return;
      }

      setBusinessFlowsState({
         loading: false,
         error: "",
         items: response.data || [],
      });

      await loadFlowMediaCollections(response.data || []);
   }, [loadFlowMediaCollections]);

   useEffect(() => {
      void (async () => {
         setOptionsLoading(true);
         setOptionsError("");
         setTableState((previous) => ({
            ...previous,
            loading: true,
            error: "",
         }));

         const [administratorsResponse, phoneNumbersResponse, relationsResponse, projectsResponse, businessFlowsResponse] = await Promise.all([
            getKapsoAdministratorOptions("", 1),
            getKapsoPhoneNumberOptions("", 1),
            getAdminKapsoIntegrations(INITIAL_FILTERS),
            getKapsoProjectOptions(),
            getKapsoBusinessFlows(),
         ]);

         if (!administratorsResponse.ok || !phoneNumbersResponse.ok || !projectsResponse.ok) {
            setOptionsError("No se pudieron cargar las opciones del módulo Admin–Kapso.");
            setOptionsLoading(false);
         } else {
            setAdministratorOptions(
               administratorsResponse.data.map(mapAdministratorOption).sort((currentOption, nextOption) =>
                  (currentOption.raw?.name || currentOption.label).localeCompare(nextOption.raw?.name || nextOption.label, "es", {
                     sensitivity: "base",
                  }),
               ),
            );
            setPhoneNumberOptions(phoneNumbersResponse.data.map(mapPhoneNumberOption));
            setProjectOptions(projectsResponse.data.map(mapProjectOption));
            setOptionsLoading(false);
         }

         if (!businessFlowsResponse.ok) {
            setBusinessFlowsState({
               loading: false,
               error: businessFlowsResponse.errorMessage || "No se pudieron cargar los flujos Kapso.",
               items: [],
            });
         } else {
            setBusinessFlowsState({
               loading: false,
               error: "",
               items: businessFlowsResponse.data || [],
            });
            await loadFlowMediaCollections(businessFlowsResponse.data || []);
         }

         if (!relationsResponse.ok) {
            setTableState((previous) => ({
               ...previous,
               loading: false,
               error: relationsResponse.errorMessage || "No se pudo cargar la configuración Admin–Kapso.",
            }));
            return;
         }

         setTableState({
            loading: false,
            error: "",
            items: relationsResponse.data.items || [],
            meta: relationsResponse.data.meta || {
               total: 0,
               page: 1,
               pageSize: INITIAL_FILTERS.pageSize,
               totalPages: 1,
            },
         });
      })();
   }, [loadFlowMediaCollections]);

   const resetForm = () => {
      setForm(EMPTY_FORM);
      setFormError("");
      setEditingRelationId(null);
      setModalMode("create");
   };

   const closeModal = (forceClose = false) => {
      if (modalLoading && !forceClose) {
         return;
      }

      setModalOpen(false);
      resetForm();
   };

   const openCreateModal = () => {
      resetForm();
      setModalOpen(true);
   };

   const openEditModal = async (relationId) => {
      setModalLoading(true);
      setFormError("");

      const response = await getAdminKapsoIntegrationById(relationId);

      if (!response.ok) {
         setModalLoading(false);
         await Swal.fire("No disponible", response.errorMessage || "No se pudo cargar la relación.", "warning");
         return;
      }

      const relation = response.data;
      const nextAdministratorOption = administratorOptions.find((option) => option.value === relation.idnetsuiteAdmin) || null;
      const nextPhoneNumberOption = phoneNumberOptions.find((option) => option.value === relation.kapsoPhoneNumberId) || null;
      const nextStatusOption = STATUS_OPTIONS.find((option) => option.value === relation.status) || STATUS_OPTIONS[0];

      setForm({
         administrator: nextAdministratorOption,
         phoneNumber: nextPhoneNumberOption,
         status: nextStatusOption,
      });
      setModalMode("edit");
      setEditingRelationId(relationId);
      setModalOpen(true);
      setModalLoading(false);
   };

   const handleFilterChange = (field, value) => {
      setFilters((previous) => ({
         ...previous,
         [field]: value,
      }));
   };

   const applyFilters = async () => {
      const nextFilters = {
         ...filters,
         page: 1,
      };

      setFilters(nextFilters);
      await loadRelations(nextFilters);
   };

   const clearFilters = async () => {
      const nextFilters = { ...INITIAL_FILTERS };

      setFilters(nextFilters);
      await loadRelations(nextFilters);
   };

   const goToPage = async (page) => {
      if (page < 1 || page > tableState.meta.totalPages || page === filters.page) {
         return;
      }

      const nextFilters = {
         ...filters,
         page,
      };

      setFilters(nextFilters);
      await loadRelations(nextFilters);
   };

   const saveRelation = async () => {
      if (!form.administrator || !form.phoneNumber || !form.status) {
         setFormError("Debes completar administrador, integración Kapso y estado.");
         return;
      }

      setModalLoading(true);
      setFormError("");

      const payload = {
         idnetsuiteAdmin: form.administrator.value,
         kapsoPhoneNumberId: form.phoneNumber.value,
         status: form.status.value,
      };

      const response =
         modalMode === "edit" && editingRelationId
            ? await updateAdminKapsoIntegration(editingRelationId, payload)
            : await createAdminKapsoIntegration(payload);

      if (!response.ok) {
         setFormError(response.errorMessage || "No se pudo guardar la relación.");
         setModalLoading(false);
         return;
      }

      setModalLoading(false);
      closeModal(true);
      await loadRelations();

      await Swal.fire(
         "Guardado",
         modalMode === "edit" ? "La asignación Admin–Kapso se actualizó correctamente." : "La asignación Admin–Kapso se creó correctamente.",
         "success",
      );
   };

   const confirmStatusChange = async (relation, nextStatus) => {
      const actionLabel = nextStatus === 1 ? "activar" : "desactivar";
      const confirmation = await Swal.fire({
         title: `¿Deseas ${actionLabel} esta asignación?`,
         text:
            nextStatus === 1
               ? "La relación volverá a estar disponible para procesos operativos."
               : "La relación dejará de usarse en los procesos operativos.",
         icon: "question",
         showCancelButton: true,
         confirmButtonText: "Confirmar",
         cancelButtonText: "Cancelar",
         confirmButtonColor: "#198754",
      });

      if (!confirmation.isConfirmed) {
         return;
      }

      const response = await updateAdminKapsoIntegrationStatus(relation.id, nextStatus);

      if (!response.ok) {
         await Swal.fire("No disponible", response.errorMessage || "No se pudo actualizar el estado.", "warning");
         return;
      }

      await Swal.fire("Actualizado", "El estado de la asignación fue actualizado.", "success");
      await loadRelations();
   };

   const confirmDelete = async (relation) => {
      const confirmation = await Swal.fire({
         title: "¿Eliminar relación?",
         text: "Esta acción elimina la asignación Admin–Kapso seleccionada.",
         icon: "warning",
         showCancelButton: true,
         confirmButtonText: "Eliminar",
         cancelButtonText: "Cancelar",
         confirmButtonColor: "#dc3545",
      });

      if (!confirmation.isConfirmed) {
         return;
      }

      const response = await deleteAdminKapsoIntegration(relation.id);

      if (!response.ok) {
         await Swal.fire("No disponible", response.errorMessage || "No se pudo eliminar la relación.", "warning");
         return;
      }

      await Swal.fire("Eliminado", "La relación fue eliminada correctamente.", "success");
      await loadRelations();
   };

   const getAvailableProjectOptionsForFlow = (flow) => {
      const enabledProjectIds = new Set((flow.projects || []).map((project) => Number(project.idProyecto)));

      return projectOptions.filter((option) => !enabledProjectIds.has(Number(option.value)));
   };

   const updateFlowProjectDraft = (flowUuid, option) => {
      setFlowProjectDrafts((previous) => ({
         ...previous,
         [flowUuid]: option,
      }));
   };

   const enableProjectForFlow = async (flow) => {
      const selectedProject = flowProjectDrafts[flow.flowUuid] || null;

      if (!selectedProject) {
         await Swal.fire("Proyecto requerido", "Selecciona el proyecto que puede ejecutar este flujo.", "warning");
         return;
      }

      const response = await enableKapsoBusinessFlowProject(flow.flowUuid, selectedProject.value);

      if (!response.ok) {
         await Swal.fire("No disponible", response.errorMessage || "No se pudo habilitar el proyecto.", "warning");
         return;
      }

      updateFlowProjectDraft(flow.flowUuid, null);
      await loadBusinessFlows();
      await Swal.fire("Proyecto habilitado", "El proyecto ya puede usar este flujo Kapso.", "success");
   };

   const disableProjectForFlow = async (flow, project) => {
      const confirmation = await Swal.fire({
         title: "Quitar proyecto del flujo",
         text: `${project.nombreProyecto || project.projectName || "Este proyecto"} dejara de ejecutar este flujo.`,
         icon: "question",
         showCancelButton: true,
         confirmButtonText: "Quitar",
         cancelButtonText: "Cancelar",
         confirmButtonColor: "#dc3545",
      });

      if (!confirmation.isConfirmed) {
         return;
      }

      const response = await disableKapsoBusinessFlowProject(flow.flowUuid, project.idProyecto);

      if (!response.ok) {
         await Swal.fire("No disponible", response.errorMessage || "No se pudo quitar el proyecto.", "warning");
         return;
      }

      await loadBusinessFlows();
      await Swal.fire("Proyecto retirado", "El proyecto fue retirado del flujo.", "success");
   };

   const uploadIntroMedia = async (flow, project, event) => {
      const files = Array.from(event.target.files || []);
      event.target.value = "";

      if (files.length === 0) {
         return;
      }

      const projectMediaId = getFlowProjectMediaId(project);
      const mediaKey = getFlowProjectMediaKey(flow.flowUuid, project);

      setFlowProjectMediaState((previous) => ({
         ...previous,
         [mediaKey]: {
            ...(previous[mediaKey] || {}),
            uploading: true,
            error: "",
         },
      }));

      const failedUploads = [];

      for (const file of files) {
         const response = await uploadKapsoFlowProjectMedia(flow.flowUuid, projectMediaId, file);

         if (!response.ok) {
            failedUploads.push(`${file.name}: ${response.errorMessage || "No se pudo subir"}`);
         }
      }

      await loadFlowProjectMedia(flow, project);

      if (failedUploads.length > 0) {
         const uploadedCount = files.length - failedUploads.length;
         const errorMessage = [`${uploadedCount} de ${files.length} archivos se subieron correctamente.`, ...failedUploads].join("\n");

         setFlowProjectMediaState((previous) => ({
            ...previous,
            [mediaKey]: {
               ...(previous[mediaKey] || {}),
               uploading: false,
               error: errorMessage,
            },
         }));
         await Swal.fire("Carga parcial", errorMessage, "warning");
         return;
      }

      await Swal.fire("Adjuntos guardados", "Los archivos quedaron disponibles para la intro del proyecto.", "success");
   };

   const deleteIntroMedia = async (flow, project, media) => {
      const confirmation = await Swal.fire({
         title: "Quitar adjunto",
         text: `${getMediaDisplayName(media)} dejara de enviarse en la intro del proyecto.`,
         icon: "question",
         showCancelButton: true,
         confirmButtonText: "Quitar",
         cancelButtonText: "Cancelar",
         confirmButtonColor: "#dc3545",
      });

      if (!confirmation.isConfirmed) {
         return;
      }

      const response = await deleteKapsoFlowProjectMedia(media.id);

      if (!response.ok) {
         await Swal.fire("No disponible", response.errorMessage || "No se pudo quitar el adjunto.", "warning");
         return;
      }

      const mediaKey = getFlowProjectMediaKey(flow.flowUuid, project);

      setFlowProjectMediaState((previous) => ({
         ...previous,
         [mediaKey]: {
            ...(previous[mediaKey] || {}),
            items: (previous[mediaKey]?.items || []).filter((item) => item.id !== media.id),
         },
      }));
      setHoveredMedia((previous) => (previous?.media?.id === media.id ? null : previous));
      setPreviewMedia((previous) => (previous?.id === media.id ? null : previous));
      await loadFlowProjectMedia(flow, project);
      await Swal.fire("Adjunto retirado", "El archivo ya no se usara en la intro del proyecto.", "success");
   };

   return (
      <div className="col-12">
         <div className="card border-0 shadow-sm">
            <div
               className="card-body py-4 px-4"
               style={{
                  background: "linear-gradient(135deg, rgba(25, 135, 84, 0.04) 0%, rgba(13, 110, 253, 0.02) 100%)",
               }}
            >
               <div className="d-flex flex-column flex-lg-row gap-3 justify-content-between align-items-lg-center">
                  <div>
                     <span className="badge rounded-pill text-bg-light border text-success mb-3">Integraciones Kapso</span>
                     <h1
                        className="mb-0 fw-semibold text-dark"
                        style={{
                           fontSize: "1.85rem",
                           lineHeight: 1.2,
                        }}
                     >
                        Configuración Admin–Kapso
                     </h1>
                  </div>

                  {activeConfigurationSection === "admins" ? (
                     <button
                        className="btn btn-success px-3 py-2 fw-semibold align-self-start align-self-lg-center"
                        onClick={openCreateModal}
                        type="button"
                     >
                        <i className="ti ti-plus me-2"></i>
                        Asignar integración
                     </button>
                  ) : null}
               </div>

               <div className="d-flex flex-wrap gap-2 mt-4">
                  <button
                     className={`btn btn-sm rounded-pill px-3 ${
                        activeConfigurationSection === "admins" ? "btn-success" : "btn-outline-secondary bg-white"
                     }`}
                     onClick={() => setActiveConfigurationSection("admins")}
                     type="button"
                  >
                     Asesores y números
                  </button>
                  <button
                     className={`btn btn-sm rounded-pill px-3 ${
                        activeConfigurationSection === "flows" ? "btn-success" : "btn-outline-secondary bg-white"
                     }`}
                     onClick={() => setActiveConfigurationSection("flows")}
                     type="button"
                  >
                     Flujos por proyecto
                  </button>
               </div>

               {activeConfigurationSection === "admins" ? (
                  <>
                     <div className="row g-3 mt-3">
                        <div className="col-md-6">
                           <div className="rounded-4 border bg-white p-3 h-100">
                              <small className="text-uppercase text-muted d-block mb-1">Visibles</small>
                              <div className="fs-3 fw-bold text-dark mb-0">{tableState.meta.total}</div>
                           </div>
                        </div>

                        <div className="col-md-6">
                           <div className="rounded-4 border bg-white p-3 h-100">
                              <small className="text-uppercase text-muted d-block mb-1">Activas</small>
                              <div className="fs-3 fw-bold text-success mb-0">{activeRelations}</div>
                           </div>
                        </div>
                     </div>

                     <div className="rounded-4 border bg-white p-3 mt-3">
                        <div className="d-flex flex-column flex-xl-row justify-content-between gap-2 mb-3">
                           <div>
                              <h2 className="h5 mb-0 text-dark">Filtros</h2>
                           </div>

                           <div className="d-flex gap-2">
                              <button className="btn btn-outline-secondary btn-sm" onClick={clearFilters} type="button">
                                 Limpiar
                              </button>
                              <button className="btn btn-success btn-sm" onClick={applyFilters} type="button">
                                 Aplicar
                              </button>
                           </div>
                        </div>

                        <div className="row g-3">
                           <div className="col-xl-3 col-md-6">
                              <label className="form-label fw-semibold text-dark">Buscar</label>
                              <input
                                 className="form-control"
                                 onChange={(event) => handleFilterChange("search", event.target.value)}
                                 placeholder="Administrador, correo o número"
                                 type="text"
                                 value={filters.search}
                              />
                           </div>

                           <div className="col-xl-3 col-md-6">
                              <label className="form-label fw-semibold text-dark">Administrador</label>
                              <Select
                                 formatOptionLabel={(option) => option.raw?.name || option.label}
                                 isClearable
                                 onChange={(option) => handleFilterChange("idnetsuiteAdmin", option ? option.value : "")}
                                 options={administratorOptions}
                                 placeholder="Todos los administradores"
                                 styles={selectStyles}
                                 value={administratorOptions.find((option) => option.value === filters.idnetsuiteAdmin) || null}
                              />
                           </div>

                           <div className="col-xl-3 col-md-6">
                              <label className="form-label fw-semibold text-dark">Integración Kapso</label>
                              <Select
                                 isClearable
                                 onChange={(option) => handleFilterChange("kapsoPhoneNumberId", option ? option.value : "")}
                                 options={phoneNumberOptions}
                                 placeholder="Todas las líneas"
                                 styles={selectStyles}
                                 value={phoneNumberOptions.find((option) => option.value === filters.kapsoPhoneNumberId) || null}
                              />
                           </div>

                           <div className="col-xl-3 col-md-6">
                              <label className="form-label fw-semibold text-dark">Estado de relación</label>
                              <Select
                                 isClearable
                                 onChange={(option) => handleFilterChange("status", option ? option.value : "")}
                                 options={STATUS_OPTIONS}
                                 placeholder="Todas"
                                 styles={selectStyles}
                                 value={STATUS_OPTIONS.find((option) => option.value === filters.status) || null}
                              />
                           </div>
                        </div>
                     </div>

                     <div className="rounded-4 border bg-white mt-3 overflow-hidden">
                        <div className="d-flex justify-content-between align-items-center px-3 py-3 border-bottom">
                           <div>
                              <h2 className="h5 mb-0 text-dark">Números asignados</h2>
                           </div>

                           <span className="badge rounded-pill text-bg-light border">
                              Página {tableState.meta.page} de {tableState.meta.totalPages}
                           </span>
                        </div>

                        {optionsError ? <div className="alert alert-warning m-4 mb-0">{optionsError}</div> : null}

                        {tableState.error ? (
                           <div className="p-4">
                              <div className="alert alert-danger mb-3">{tableState.error}</div>
                              <button className="btn btn-outline-danger" onClick={() => loadRelations()} type="button">
                                 Reintentar
                              </button>
                           </div>
                        ) : tableState.loading ? (
                           <div className="p-5 text-center text-muted">Cargando relaciones Admin–Kapso...</div>
                        ) : tableState.items.length === 0 ? (
                           <div className="p-5 text-center text-muted">
                              No hay relaciones Admin–Kapso configuradas para los filtros seleccionados.
                           </div>
                        ) : (
                           <>
                              <div className="table-responsive">
                                 <table className="table align-middle mb-0">
                                    <thead className="table-light">
                                       <tr>
                                          <th style={{ width: 60 }}></th>
                                          <th>Administrador</th>
                                          <th>Línea Kapso</th>
                                          <th>Estado</th>
                                          <th className="text-end">Acciones</th>
                                       </tr>
                                    </thead>
                                    <tbody>
                                       {tableState.items.map((relation) => {
                                          const isExpanded = expandedRowId === relation.id;

                                          return (
                                             <Fragment key={`relation-${relation.id}`}>
                                                <tr key={`row-${relation.id}`}>
                                                   <td className="text-center">
                                                      <button
                                                         className="btn btn-sm btn-light border"
                                                         onClick={() =>
                                                            setExpandedRowId((previous) => (previous === relation.id ? null : relation.id))
                                                         }
                                                         aria-expanded={isExpanded}
                                                         title={isExpanded ? "Ocultar detalle" : "Ver detalle"}
                                                         type="button"
                                                      >
                                                         <i className={`ti ${isExpanded ? "ti-chevron-up" : "ti-chevron-down"}`}></i>
                                                      </button>
                                                   </td>

                                                   <td>
                                                      <div className="fw-semibold text-dark">
                                                         {relation.administratorName || "Administrador sin nombre"}
                                                      </div>
                                                      <div className="text-muted small">
                                                         {relation.administratorEmail || "Sin correo registrado"}
                                                      </div>
                                                   </td>

                                                   <td>
                                                      <div className="fw-semibold text-dark">
                                                         {relation.displayPhoneNumber || relation.phoneNumberName || relation.phoneNumberId}
                                                      </div>
                                                      <div className="text-muted small">
                                                         {relation.phoneNumberName || relation.verifiedName || "Sin alias"}
                                                      </div>
                                                   </td>

                                                   <td>
                                                      <span className={`badge rounded-pill ${getRelationStatusBadgeClass(relation.status)}`}>
                                                         {relation.status === 1 ? "Activa" : "Inactiva"}
                                                      </span>
                                                   </td>

                                                   <td>
                                                      <div className="d-flex justify-content-end gap-2 flex-wrap">
                                                         <button
                                                            className="btn btn-sm btn-outline-success"
                                                            onClick={() => openEditModal(relation.id)}
                                                            type="button"
                                                         >
                                                            Editar
                                                         </button>

                                                         <button
                                                            className={`btn btn-sm ${
                                                               relation.status === 1 ? "btn-outline-warning" : "btn-outline-primary"
                                                            }`}
                                                            onClick={() => confirmStatusChange(relation, relation.status === 1 ? 0 : 1)}
                                                            type="button"
                                                         >
                                                            {relation.status === 1 ? "Desactivar" : "Activar"}
                                                         </button>

                                                         <button
                                                            className="btn btn-sm btn-outline-danger"
                                                            onClick={() => confirmDelete(relation)}
                                                            type="button"
                                                         >
                                                            Eliminar
                                                         </button>
                                                      </div>
                                                   </td>
                                                </tr>

                                                {isExpanded ? (
                                                   <tr key={`detail-${relation.id}`}>
                                                      <td></td>
                                                      <td colSpan={4}>
                                                         <div className="rounded-3 border bg-light px-3 py-2 my-1">
                                                            <div className="row g-2">
                                                               <div className="col-lg-4 col-md-6">
                                                                  <div className="text-uppercase text-muted small">ID de relación</div>
                                                                  <div className="small fw-semibold text-dark text-break">{relation.id}</div>
                                                               </div>

                                                               <div className="col-lg-4 col-md-6">
                                                                  <div className="text-uppercase text-muted small">Estado admin</div>
                                                                  <div className="small fw-semibold text-dark">
                                                                     {relation.administratorStatus === 1 ? "Activo" : "Inactivo"}
                                                                  </div>
                                                               </div>

                                                               <div className="col-lg-4 col-md-6">
                                                                  <div className="text-uppercase text-muted small">WABA</div>
                                                                  <div className="small fw-semibold text-dark text-break">
                                                                     {relation.businessAccountId || "Sin dato"}
                                                                  </div>
                                                               </div>

                                                               <div className="col-lg-4 col-md-6">
                                                                  <div className="text-uppercase text-muted small">Kapso</div>
                                                                  <div className="small fw-semibold text-dark">
                                                                     {relation.kapsoIntegrationStatus || "Sin dato"}
                                                                  </div>
                                                               </div>

                                                               <div className="col-lg-4 col-md-6">
                                                                  <div className="text-uppercase text-muted small">Setup</div>
                                                                  <div className="small fw-semibold text-dark">
                                                                     {relation.kapsoSetupStatus || "Sin dato"}
                                                                  </div>
                                                               </div>

                                                               <div className="col-lg-4 col-md-6">
                                                                  <div className="text-uppercase text-muted small">Sincronización</div>
                                                                  <div className="small fw-semibold text-dark">
                                                                     {relation.kapsoSetupSyncStatus || "Sin dato"}
                                                                  </div>
                                                               </div>
                                                            </div>
                                                         </div>
                                                      </td>
                                                   </tr>
                                                ) : null}
                                             </Fragment>
                                          );
                                       })}
                                    </tbody>
                                 </table>
                              </div>

                              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 px-3 py-3 border-top">
                                 <div className="text-muted small">
                                    {tableState.items.length} de {tableState.meta.total} relaciones
                                 </div>

                                 <div className="btn-group">
                                    <button
                                       className="btn btn-outline-secondary"
                                       disabled={filters.page <= 1}
                                       onClick={() => goToPage(filters.page - 1)}
                                       type="button"
                                    >
                                       Anterior
                                    </button>
                                    <button className="btn btn-outline-secondary disabled" type="button">
                                       {tableState.meta.page}
                                    </button>
                                    <button
                                       className="btn btn-outline-secondary"
                                       disabled={filters.page >= tableState.meta.totalPages}
                                       onClick={() => goToPage(filters.page + 1)}
                                       type="button"
                                    >
                                       Siguiente
                                    </button>
                                 </div>
                              </div>
                           </>
                        )}
                     </div>
                  </>
               ) : null}

               {activeConfigurationSection === "flows" ? (
                  <div className="rounded-4 border bg-white mt-3">
                     <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-2 px-3 py-3 border-bottom">
                        <div>
                           <h2 className="h5 mb-1 text-dark">Flujos por proyecto</h2>
                           <div className="text-muted small">Activa solo los proyectos que pueden usar cada flujo.</div>
                        </div>
                     </div>

                     {businessFlowsState.error ? (
                        <div className="p-4">
                           <div className="alert alert-warning mb-3">{businessFlowsState.error}</div>
                           <button className="btn btn-outline-warning btn-sm" onClick={loadBusinessFlows} type="button">
                              Reintentar
                           </button>
                        </div>
                     ) : businessFlowsState.loading ? (
                        <div className="p-4 text-center text-muted">Cargando flujos Kapso...</div>
                     ) : businessFlowsState.items.length === 0 ? (
                        <div className="p-4 text-center text-muted">No hay flujos Kapso configurados.</div>
                     ) : (
                        <div className="list-group list-group-flush">
                           {businessFlowsState.items.map((flow) => {
                              const availableProjectOptions = getAvailableProjectOptionsForFlow(flow);
                              const firstStep = flow.steps?.[0] || null;

                              return (
                                 <div className="list-group-item p-3" key={flow.flowUuid}>
                                    <div className="row g-3 align-items-center">
                                       <div className="col-lg-4">
                                          <div className="d-flex align-items-center gap-2 mb-1">
                                             <span className="fw-semibold text-dark">{flow.flowName}</span>
                                             <span className="badge rounded-pill text-bg-light border text-uppercase">{flow.status}</span>
                                          </div>
                                       </div>

                                       <div className="col-lg-3">
                                          <div className="text-uppercase text-muted small mb-1">Template</div>
                                          <div className="fw-semibold text-dark">{firstStep?.templateName || "Sin template"}</div>
                                          <div className="text-muted small">
                                             {firstStep
                                                ? `${firstStep.templateStatus || "sin estado"} | ${firstStep.templateLanguage || "sin idioma"}`
                                                : "Configura un paso antes de activar."}
                                          </div>
                                       </div>

                                       <div className="col-lg-5">
                                          <div
                                             className="d-flex flex-column gap-2 mb-3 pe-1"
                                             style={{
                                                maxHeight: 420,
                                                overflowY: "auto",
                                             }}
                                          >
                                             {(flow.projects || []).length === 0 ? (
                                                <span className="badge rounded-pill text-bg-light border text-muted align-self-start">Sin proyectos</span>
                                             ) : (
                                                flow.projects.map((project) => {
                                                   const mediaKey = getFlowProjectMediaKey(flow.flowUuid, project);
                                                   const mediaState = flowProjectMediaState[mediaKey] || {
                                                      items: [],
                                                   };
                                                   const mediaItems = mediaState.items || [];

                                                   return (
                                                      <div
                                                         className="rounded-4 border bg-white p-3 shadow-sm"
                                                         key={`${flow.flowUuid}-${project.idProyecto}`}
                                                      >
                                                         <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom pb-2 mb-3">
                                                            <button
                                                               className="btn btn-sm btn-outline-success rounded-pill py-1 px-2"
                                                               onClick={() => disableProjectForFlow(flow, project)}
                                                               title="Quitar proyecto del flujo"
                                                               type="button"
                                                            >
                                                               {project.nombreProyecto || project.projectName}
                                                               <i className="ti ti-x ms-1"></i>
                                                            </button>

                                                            <label
                                                               className={`btn btn-sm rounded-pill mb-0 py-1 px-2 ${
                                                                  mediaState.uploading ? "btn-outline-secondary disabled" : "btn-outline-success"
                                                               }`}
                                                            >
                                                               <i className="ti ti-upload me-1"></i>
                                                               {mediaState.uploading ? "Subiendo..." : "Subir adjuntos"}
                                                               <input
                                                                  accept="image/*,video/*,application/pdf"
                                                                  className="d-none"
                                                                  disabled={mediaState.uploading}
                                                                  multiple
                                                                  onChange={(event) => uploadIntroMedia(flow, project, event)}
                                                                  type="file"
                                                               />
                                                            </label>
                                                         </div>

                                                         <div>
                                                            {mediaState.loading ? (
                                                               <div className="small text-muted">Cargando adjuntos...</div>
                                                            ) : mediaState.error ? (
                                                               <div className="alert alert-warning py-2 px-3 mb-0 small">
                                                                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                                                                     <span>{mediaState.error}</span>
                                                                     <button
                                                                        className="btn btn-sm btn-outline-warning"
                                                                        onClick={() => loadFlowProjectMedia(flow, project)}
                                                                        type="button"
                                                                     >
                                                                        Reintentar
                                                                     </button>
                                                                  </div>
                                                               </div>
                                                            ) : mediaItems.length === 0 ? (
                                                               <div className="small text-muted rounded-3 border bg-light px-2 py-2">
                                                                  Sin adjuntos. La intro saldra solo con texto.
                                                               </div>
                                                            ) : (
                                                               <div className="d-flex flex-wrap align-items-center gap-3 pt-1">
                                                                  {mediaItems.map((media) => (
                                                                     <div
                                                                        className="position-relative d-inline-flex flex-column align-items-center"
                                                                        key={media.id}
                                                                        onMouseEnter={(event) =>
                                                                           setHoveredMedia({
                                                                              media,
                                                                              x: event.clientX,
                                                                              y: event.clientY,
                                                                           })
                                                                        }
                                                                        onMouseLeave={() => setHoveredMedia(null)}
                                                                        onMouseMove={(event) =>
                                                                           setHoveredMedia((previous) =>
                                                                              previous
                                                                                 ? {
                                                                                      media,
                                                                                      x: event.clientX,
                                                                                      y: event.clientY,
                                                                                   }
                                                                                 : null,
                                                                           )
                                                                        }
                                                                     >
                                                                        <button
                                                                           className="border-0 rounded-circle p-0 bg-light overflow-hidden shadow-sm"
                                                                           disabled={!media.publicUrl}
                                                                           onClick={() => setPreviewMedia(media)}
                                                                           style={{
                                                                              width: 44,
                                                                              height: 44,
                                                                              outline: "2px solid #e8f7f1",
                                                                              outlineOffset: 2,
                                                                           }}
                                                                           title={getMediaDisplayName(media)}
                                                                           type="button"
                                                                        >
                                                                           {media.mediaType === "image" && media.publicUrl ? (
                                                                              <img
                                                                                 alt={getMediaDisplayName(media)}
                                                                                 src={media.publicUrl}
                                                                                 style={{
                                                                                    width: "100%",
                                                                                    height: "100%",
                                                                                    objectFit: "cover",
                                                                                 }}
                                                                              />
                                                                           ) : media.mediaType === "video" && media.publicUrl ? (
                                                                              <video
                                                                                 muted
                                                                                 src={media.publicUrl}
                                                                                 style={{
                                                                                    width: "100%",
                                                                                    height: "100%",
                                                                                    objectFit: "cover",
                                                                                 }}
                                                                              />
                                                                           ) : (
                                                                              <span className="d-flex align-items-center justify-content-center h-100 text-success">
                                                                                 <i className={`ti ${getMediaTypeIcon(media.mediaType)} fs-5`}></i>
                                                                              </span>
                                                                           )}
                                                                        </button>

                                                                        <button
                                                                           className="btn btn-sm btn-light border rounded-circle position-absolute d-flex align-items-center justify-content-center"
                                                                           onClick={() => deleteIntroMedia(flow, project, media)}
                                                                           style={{
                                                                              top: -8,
                                                                              right: -10,
                                                                              width: 22,
                                                                              height: 22,
                                                                              color: "#dc3545",
                                                                           }}
                                                                           title="Quitar adjunto"
                                                                           type="button"
                                                                        >
                                                                           <i className="ti ti-x"></i>
                                                                        </button>

                                                                     </div>
                                                                  ))}
                                                               </div>
                                                            )}
                                                         </div>
                                                      </div>
                                                   );
                                                })
                                             )}
                                          </div>

                                          <div className="d-flex flex-column flex-md-row gap-2">
                                             <div className="flex-grow-1">
                                                <Select
                                                   isClearable
                                                   menuPortalTarget={document.body}
                                                   menuPosition="fixed"
                                                   noOptionsMessage={() => "Todos los proyectos ya estan habilitados"}
                                                   onChange={(option) => updateFlowProjectDraft(flow.flowUuid, option)}
                                                   options={availableProjectOptions}
                                                   placeholder="Agregar proyecto permitido"
                                                   styles={selectStyles}
                                                   value={flowProjectDrafts[flow.flowUuid] || null}
                                                />
                                             </div>
                                             <button
                                                className="btn btn-success"
                                                disabled={!flowProjectDrafts[flow.flowUuid]}
                                                onClick={() => enableProjectForFlow(flow)}
                                                type="button"
                                             >
                                                Permitir
                                             </button>
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     )}
                  </div>
               ) : null}
            </div>
         </div>

         {hoveredMedia ? (
            <div
               className="position-fixed bg-white border rounded-4 shadow-lg p-2"
               style={{
                  left: Math.min(hoveredMedia.x + 18, window.innerWidth - 250),
                  pointerEvents: "none",
                  top: Math.max(hoveredMedia.y - 170, 12),
                  width: 230,
                  zIndex: 1390,
               }}
            >
               <div
                  className="rounded-3 bg-light overflow-hidden mb-2"
                  style={{
                     height: 128,
                  }}
               >
                  {hoveredMedia.media.mediaType === "image" && hoveredMedia.media.publicUrl ? (
                     <img
                        alt={getMediaDisplayName(hoveredMedia.media)}
                        src={hoveredMedia.media.publicUrl}
                        style={{
                           width: "100%",
                           height: "100%",
                           objectFit: "cover",
                        }}
                     />
                  ) : hoveredMedia.media.mediaType === "video" && hoveredMedia.media.publicUrl ? (
                     <video
                        muted
                        src={hoveredMedia.media.publicUrl}
                        style={{
                           width: "100%",
                           height: "100%",
                           objectFit: "cover",
                        }}
                     />
                  ) : (
                     <div className="h-100 d-flex align-items-center justify-content-center text-success">
                        <i className={`ti ${getMediaTypeIcon(hoveredMedia.media.mediaType)} fs-1`}></i>
                     </div>
                  )}
               </div>
               <div className="small fw-semibold text-dark text-truncate">
                  {getMediaDisplayName(hoveredMedia.media)}
               </div>
               <div className="text-muted" style={{ fontSize: 11 }}>
                  {hoveredMedia.media.fileSize ? formatFileSize(hoveredMedia.media.fileSize) : ""}
               </div>
            </div>
         ) : null}

         {previewMedia ? (
            <div
               className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
               style={{
                  backgroundColor: "rgba(15, 23, 42, 0.62)",
                  zIndex: 1400,
               }}
            >
               <div
                  className="bg-white rounded-4 shadow-lg overflow-hidden w-100"
                  style={{
                     maxWidth: 820,
                  }}
               >
                  <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
                     <div className="min-w-0">
                        <div className="fw-semibold text-dark text-truncate">{getMediaDisplayName(previewMedia)}</div>
                        <div className="text-muted small">
                           {previewMedia.fileSize ? formatFileSize(previewMedia.fileSize) : ""}
                        </div>
                     </div>

                     <button className="btn btn-sm btn-light border rounded-circle" onClick={() => setPreviewMedia(null)} type="button">
                        <i className="ti ti-x"></i>
                     </button>
                  </div>

                  <div className="bg-light d-flex align-items-center justify-content-center" style={{ minHeight: 360 }}>
                     {previewMedia.mediaType === "image" && previewMedia.publicUrl ? (
                        <img
                           alt={getMediaDisplayName(previewMedia)}
                           src={previewMedia.publicUrl}
                           style={{
                              maxHeight: "72vh",
                              maxWidth: "100%",
                              objectFit: "contain",
                           }}
                        />
                     ) : previewMedia.mediaType === "video" && previewMedia.publicUrl ? (
                        <video
                           controls
                           src={previewMedia.publicUrl}
                           style={{
                              maxHeight: "72vh",
                              maxWidth: "100%",
                           }}
                        />
                     ) : previewMedia.publicUrl ? (
                        <iframe
                           className="border-0 w-100"
                           src={previewMedia.publicUrl}
                           title={getMediaDisplayName(previewMedia)}
                           style={{
                              height: "72vh",
                           }}
                        />
                     ) : (
                        <div className="text-center text-muted p-5">
                           <i className={`ti ${getMediaTypeIcon(previewMedia.mediaType)} fs-1 d-block mb-2`}></i>
                           Este adjunto no tiene vista previa disponible.
                        </div>
                     )}
                  </div>
               </div>
            </div>
         ) : null}

         {modalOpen ? (
            <div
               className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center p-3"
               style={{
                  backgroundColor: "rgba(15, 23, 42, 0.45)",
                  zIndex: 1200,
               }}
            >
               <div
                  className="bg-white rounded-4 shadow-lg w-100"
                  style={{
                     maxWidth: 780,
                     maxHeight: "90vh",
                     overflowY: "auto",
                  }}
               >
                  <div className="d-flex justify-content-between align-items-start p-4 border-bottom">
                     <div>
                        <h3 className="h4 mb-1 text-dark">{modalMode === "edit" ? "Editar asignación" : "Asignar número Kapso"}</h3>
                        <p className="text-muted mb-0">Elige quién puede usar esta línea.</p>
                     </div>

                     <button className="btn btn-sm btn-light" onClick={closeModal} type="button">
                        <i className="ti ti-x"></i>
                     </button>
                  </div>

                  <div className="p-4">
                     <div className="row g-3">
                        <div className="col-md-6">
                           <label className="form-label fw-semibold text-dark">Administrador</label>
                           <Select
                              formatOptionLabel={(option) => option.raw?.name || option.label}
                              isLoading={optionsLoading}
                              onChange={(option) =>
                                 setForm((previous) => ({
                                    ...previous,
                                    administrator: option,
                                 }))
                              }
                              options={administratorOptions}
                              placeholder="Seleccionar administrador"
                              styles={selectStyles}
                              value={form.administrator}
                           />
                        </div>

                        <div className="col-md-6">
                           <label className="form-label fw-semibold text-dark">Número Kapso</label>
                           <Select
                              isLoading={optionsLoading}
                              onChange={(option) =>
                                 setForm((previous) => ({
                                    ...previous,
                                    phoneNumber: option,
                                 }))
                              }
                              options={phoneNumberOptions}
                              placeholder="Seleccionar número"
                              styles={selectStyles}
                              value={form.phoneNumber}
                           />
                        </div>

                        <div className="col-md-6">
                           <label className="form-label fw-semibold text-dark">Estado de la relación</label>
                           <Select
                              onChange={(option) =>
                                 setForm((previous) => ({
                                    ...previous,
                                    status: option,
                                 }))
                              }
                              options={STATUS_OPTIONS}
                              placeholder="Seleccionar estado"
                              styles={selectStyles}
                              value={form.status}
                           />
                        </div>

                        <div className="col-md-6">
                           <div className="rounded-4 border bg-light h-100 p-3">
                              <div className="fw-semibold text-dark mb-2">Asignación</div>
                              <div className="text-muted small">{form.administrator?.raw?.name || "Sin administrador seleccionado"}</div>
                              <div className="text-muted small mt-1">
                                 {form.phoneNumber?.raw?.displayPhoneNumber || "Sin número Kapso seleccionado"}
                              </div>
                              <div className="mt-3">
                                 <span className={`badge rounded-pill ${getRelationStatusBadgeClass(form.status?.value)}`}>
                                    {form.status?.label || "Sin estado"}
                                 </span>
                              </div>
                           </div>
                        </div>
                     </div>

                     {formError ? <div className="alert alert-danger mt-4 mb-0">{formError}</div> : null}
                  </div>

                  <div className="d-flex justify-content-end gap-2 p-4 border-top">
                     <button className="btn btn-outline-secondary" onClick={closeModal} type="button">
                        Cancelar
                     </button>
                     <button className="btn btn-success" disabled={modalLoading} onClick={saveRelation} type="button">
                        {modalLoading ? "Guardando..." : modalMode === "edit" ? "Guardar cambios" : "Asignar número"}
                     </button>
                  </div>
               </div>
            </div>
         ) : null}
      </div>
   );
};
