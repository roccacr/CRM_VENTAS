import { Fragment, useEffect, useMemo, useState } from "react";
import Select from "react-select";
import Swal from "sweetalert2";

import {
   createAdminKapsoIntegration,
   deleteAdminKapsoIntegration,
   getAdminKapsoIntegrationById,
   getAdminKapsoIntegrations,
   getKapsoAdministratorOptions,
   getKapsoPhoneNumberOptions,
   updateAdminKapsoIntegration,
   updateAdminKapsoIntegrationStatus,
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
};

// ============================================================================
// HELPERS
// ============================================================================

const formatDateTime = (value) => {
   if (!value) {
      return "Sin registro";
   }

   const date = new Date(value);

   if (Number.isNaN(date.getTime())) {
      return value;
   }

   return new Intl.DateTimeFormat("es-CR", {
      dateStyle: "medium",
      timeStyle: "short",
   }).format(date);
};

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
   const [optionsLoading, setOptionsLoading] = useState(true);
   const [optionsError, setOptionsError] = useState("");
   const [modalOpen, setModalOpen] = useState(false);
   const [modalLoading, setModalLoading] = useState(false);
   const [modalMode, setModalMode] = useState("create");
   const [editingRelationId, setEditingRelationId] = useState(null);
   const [expandedRowId, setExpandedRowId] = useState(null);
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

   useEffect(() => {
      void (async () => {
         setOptionsLoading(true);
         setOptionsError("");
         setTableState((previous) => ({
            ...previous,
            loading: true,
            error: "",
         }));

         const [administratorsResponse, phoneNumbersResponse, relationsResponse] = await Promise.all([
            getKapsoAdministratorOptions("", 1),
            getKapsoPhoneNumberOptions("", 1),
            getAdminKapsoIntegrations(INITIAL_FILTERS),
         ]);

         if (!administratorsResponse.ok || !phoneNumbersResponse.ok) {
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
            setOptionsLoading(false);
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
   }, []);

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

                  <button
                     className="btn btn-success px-3 py-2 fw-semibold align-self-start align-self-lg-center"
                     onClick={openCreateModal}
                     type="button"
                  >
                     <i className="ti ti-plus me-2"></i>
                     Asignar integración
                  </button>
               </div>

               <div className="row g-3 mt-3">
                  <div className="col-md-4">
                     <div className="rounded-4 border bg-white p-3 h-100">
                        <small className="text-uppercase text-muted d-block mb-1">Visibles</small>
                        <div className="fs-3 fw-bold text-dark mb-0">{tableState.meta.total}</div>
                     </div>
                  </div>

                  <div className="col-md-4">
                     <div className="rounded-4 border bg-white p-3 h-100">
                        <small className="text-uppercase text-muted d-block mb-1">Activas</small>
                        <div className="fs-3 fw-bold text-success mb-0">{activeRelations}</div>
                     </div>
                  </div>

                  <div className="col-md-4">
                     <div className="rounded-4 border bg-white p-3 h-100">
                        <small className="text-uppercase text-muted d-block mb-1">Catálogo</small>
                        <div className="fs-4 fw-bold text-dark mb-0">
                           {administratorOptions.length} admins / {phoneNumberOptions.length} líneas
                        </div>
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
                        <h2 className="h5 mb-0 text-dark">Asignaciones</h2>
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
                     <div className="p-5 text-center text-muted">No hay relaciones Admin–Kapso configuradas para los filtros seleccionados.</div>
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
                                    <th>Creada</th>
                                    <th>Actualizada</th>
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
                                                <div className="text-muted small">{relation.administratorEmail || "Sin correo registrado"}</div>
                                                <div className="text-muted small">NetSuite ID: {relation.idnetsuiteAdmin}</div>
                                             </td>

                                             <td>
                                                <div className="fw-semibold text-dark">
                                                   {relation.displayPhoneNumber || relation.phoneNumberName || relation.phoneNumberId}
                                                </div>
                                                <div className="text-muted small">
                                                   {relation.phoneNumberName || relation.verifiedName || "Sin alias"}
                                                </div>
                                                <div className="text-muted small">Phone number ID: {relation.phoneNumberId}</div>
                                             </td>

                                             <td>
                                                <span className={`badge rounded-pill ${getRelationStatusBadgeClass(relation.status)}`}>
                                                   {relation.status === 1 ? "Activa" : "Inactiva"}
                                                </span>
                                             </td>

                                             <td className="text-muted small">{formatDateTime(relation.createdAt)}</td>
                                             <td className="text-muted small">{formatDateTime(relation.updatedAt)}</td>

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
                                                <td colSpan={6}>
                                                   <div className="rounded-4 border bg-light p-3 my-2">
                                                      <div className="row g-3">
                                                         <div className="col-lg-4 col-md-6">
                                                            <div className="text-uppercase text-muted small mb-1">ID de relación</div>
                                                            <div className="fw-semibold text-dark">{relation.id}</div>
                                                         </div>

                                                         <div className="col-lg-4 col-md-6">
                                                            <div className="text-uppercase text-muted small mb-1">Estado admin</div>
                                                            <div className="fw-semibold text-dark">
                                                               {relation.administratorStatus === 1 ? "Activo" : "Inactivo"}
                                                            </div>
                                                         </div>

                                                         <div className="col-lg-4 col-md-6">
                                                            <div className="text-uppercase text-muted small mb-1">WABA ID</div>
                                                            <div className="fw-semibold text-dark">
                                                               {relation.businessAccountId || "Sin dato"}
                                                            </div>
                                                         </div>

                                                         <div className="col-lg-4 col-md-6">
                                                            <div className="text-uppercase text-muted small mb-1">Estado Kapso</div>
                                                            <div className="fw-semibold text-dark">
                                                               {relation.kapsoIntegrationStatus || "Sin dato"}
                                                            </div>
                                                         </div>

                                                         <div className="col-lg-4 col-md-6">
                                                            <div className="text-uppercase text-muted small mb-1">Estado setup</div>
                                                            <div className="fw-semibold text-dark">
                                                               {relation.kapsoSetupStatus || "Sin dato"}
                                                            </div>
                                                         </div>

                                                         <div className="col-lg-4 col-md-6">
                                                            <div className="text-uppercase text-muted small mb-1">Estado sync</div>
                                                            <div className="fw-semibold text-dark">
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
            </div>
         </div>

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
                        <h3 className="h4 mb-1 text-dark">{modalMode === "edit" ? "Editar asignación Kapso" : "Asignar integración Kapso"}</h3>
                        <p className="text-muted mb-0">Selecciona el administrador, la línea Kapso y el estado operativo de la relación.</p>
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
                           <label className="form-label fw-semibold text-dark">Integración Kapso</label>
                           <Select
                              isLoading={optionsLoading}
                              onChange={(option) =>
                                 setForm((previous) => ({
                                    ...previous,
                                    phoneNumber: option,
                                 }))
                              }
                              options={phoneNumberOptions}
                              placeholder="Seleccionar línea Kapso"
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
                              <div className="fw-semibold text-dark mb-2">Resumen</div>
                              <div className="text-muted small">
                                 {form.administrator ? form.administrator.label : "Sin administrador seleccionado"}
                              </div>
                              <div className="text-muted small mt-1">
                                 {form.phoneNumber ? form.phoneNumber.label : "Sin línea Kapso seleccionada"}
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
                        {modalLoading ? "Guardando..." : modalMode === "edit" ? "Guardar cambios" : "Guardar asignación"}
                     </button>
                  </div>
               </div>
            </div>
         ) : null}
      </div>
   );
};
