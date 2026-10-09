/**
 * Pantalla reutilizable de valores de un catálogo CRM.
 *
 * La misma página sirve en Administración y en los perfiles operativos: el
 * catálogo y el módulo de contexto llegan por props. Crear, editar y cambiar
 * estado exigen un motivo porque el API audita cada cambio. Esta pantalla no
 * calcula permisos; el BFF rechaza la llamada si el usuario no puede actuar.
 */
import "./CatalogItemsPage.css";
import "./ProjectsView.css";

import PlusOutlined from "@ant-design/icons/PlusOutlined";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import SaveOutlined from "@ant-design/icons/SaveOutlined";
import Button from "antd/es/button";
import ConfigProvider from "antd/es/config-provider";
import Form from "antd/es/form";
import Input from "antd/es/input";
import message from "antd/es/message";
import Modal from "antd/es/modal";
import Tooltip from "antd/es/tooltip";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import { ApiClientError } from "../../../services/api/api-client";
import { type CatalogContextModuleCode, type CatalogExternalReferencePayload, type CatalogItem, type CatalogItemPayload, type CatalogItemStatus, createCatalogItem, listCatalogItems, updateCatalogItem, updateCatalogItemStatus } from "../../../services/catalogs/catalog-service";
import { ADMINISTRATION_MODAL_Z_INDEX, ADMINISTRATION_THEME } from "../administration-theme";
import { type AdministrationCatalogDefinition, CATALOG_REFERENCE_PROVIDERS } from "./catalog-definitions";
import { CatalogItemDetailDrawer } from "./CatalogItemDetailDrawer";
import { CatalogItemsDataTable } from "./CatalogItemsDataTable";

/** Mínimo que el formulario exige antes de enviar un motivo auditable. */
const MIN_REASON_LENGTH = 5;
const STATUS_LABELS: Record<CatalogItemStatus, string> = { active: "Activo", inactive: "Inactivo" };
/** Sistemas externos cuyas referencias se capturan en el formulario. */
const PROVIDER_OPTIONS = CATALOG_REFERENCE_PROVIDERS.map((provider) => provider.systemCode);

/** Cuerpo del formulario. El módulo de contexto lo agrega la página al guardar. */
type CatalogItemFormPayload = Omit<CatalogItemPayload, "moduleCode">;

/** Campos editables. Los ids externos son opcionales y se omiten si quedan en blanco. */
interface CatalogItemFormValues {
    detail?: string;
    name: string;
    netsuiteId?: string;
    odooId?: string;
    reason: string;
}

/** Catálogo a administrar y el módulo desde el que se abre. */
interface CatalogItemsPageProps {
    readonly catalog: AdministrationCatalogDefinition;
    readonly contextLabel?: string;
    readonly contextModuleCode?: CatalogContextModuleCode;
}

/** Cambio de estado pendiente de confirmación y de motivo. */
interface StatusAction {
    readonly item: CatalogItem;
    readonly status: CatalogItemStatus;
}

/**
 * Texto del BFF cuando viene como `message` string o lista de strings.
 *
 * Cualquier otro error usa el texto de respaldo para no mostrar estado HTTP ni cuerpos crudos.
 *
 * @param error - Fallo de la llamada
 * @param fallback - Mensaje neutro si el cuerpo no trae un texto usable
 */
const getApiErrorMessage = (error: unknown, fallback: string): string => {
    if (!(error instanceof ApiClientError)) {
        return fallback;
    }

    const responseBody = error.responseBody;
    if (!responseBody || typeof responseBody !== "object" || !("message" in responseBody)) {
        return fallback;
    }

    const message = (responseBody as { readonly message?: unknown }).message;
    return Array.isArray(message) ? message.filter((item): item is string => typeof item === "string").join(" ") : typeof message === "string" && message.length > 0 ? message : fallback;
};

/** Arma solo las referencias cuyo id quedó con texto. Un campo vacío no se envía. */
const buildExternalReferences = (values: CatalogItemFormValues): CatalogExternalReferencePayload[] =>
    PROVIDER_OPTIONS.flatMap((systemCode) => {
        const externalId = systemCode === "netsuite" ? values.netsuiteId?.trim() : values.odooId?.trim();
        return externalId ? [{ externalId, systemCode }] : [];
    });

/** Id externo ya guardado, para precargar el formulario de edición. */
const getReferenceValue = (item: CatalogItem | null, systemCode: "netsuite" | "odoo"): string | undefined => item?.externalReferences.find((reference) => reference.systemCode === systemCode)?.externalId;

/** Projects share drawer section hierarchy without changing sibling catalog forms. */
function CatalogFormSection({ projectView, title, children }: { readonly projectView: boolean; readonly title: string; readonly children: ReactNode }) {
    return projectView ? (
        <fieldset className="projects-view-form-section">
            <legend>{title}</legend>
            <div>{children}</div>
        </fieldset>
    ) : (
        <>{children}</>
    );
}

/**
 * Alta o edición de un valor.
 *
 * El motivo se vacía en cada apertura: un motivo anterior no debe reutilizarse
 * para auditar un cambio nuevo.
 */
function CatalogItemModal({ catalog, initialItem, isSaving, open, error, onClose, onSubmit }: { readonly catalog: AdministrationCatalogDefinition; readonly error: string | null; readonly initialItem: CatalogItem | null; readonly isSaving: boolean; readonly onClose: () => void; readonly onSubmit: (payload: CatalogItemFormPayload) => void; readonly open: boolean }) {
    const [form] = Form.useForm<CatalogItemFormValues>();
    const isEdit = initialItem !== null;
    const projectView = catalog.code === "projects";

    useEffect(() => {
        if (!open) {
            return;
        }

        form.setFieldsValue({
            detail: initialItem?.detail ?? "",
            name: initialItem?.name ?? "",
            netsuiteId: getReferenceValue(initialItem, "netsuite") ?? "",
            odooId: getReferenceValue(initialItem, "odoo") ?? "",
            reason: "",
        });
    }, [form, initialItem, open]);

    const submit = (): void => {
        void form.validateFields().then((values) => {
            const detail = values.detail?.trim();
            onSubmit({
                externalReferences: buildExternalReferences(values),
                name: values.name.trim(),
                reason: values.reason.trim(),
                ...(detail ? { detail } : {}),
            });
        });
    };

    return (
        <Modal
            centered
            forceRender
            className={`catalog-items-modal${projectView ? " catalog-items-modal--projects" : ""}`}
            footer={
                <div className="catalog-items-modal__footer">
                    <Button disabled={isSaving} onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="primary" loading={isSaving} onClick={submit}>
                        <SaveOutlined />
                        {isEdit ? "Guardar cambios" : "Crear valor"}
                    </Button>
                </div>
            }
            open={open}
            title={
                <div className="catalog-items-modal__title">
                    <h2>{isEdit ? `Editar ${catalog.label}` : `Nuevo ${catalog.label}`}</h2>
                    <p>Valor nativo CRM con referencias opcionales de NetSuite, Odoo u otros proveedores.</p>
                </div>
            }
            zIndex={ADMINISTRATION_MODAL_Z_INDEX}
            onCancel={onClose}
        >
            <Form form={form} layout="vertical" requiredMark="optional">
                {error ? <div className="catalog-items-error">{error}</div> : null}
                <CatalogFormSection projectView={projectView} title="Información del registro">
                    <Form.Item<CatalogItemFormValues>
                        label="Nombre"
                        name="name"
                        rules={[
                            { min: 2, message: "Agrega un nombre válido." },
                            { required: true, message: "El nombre es obligatorio." },
                        ]}
                    >
                        <Input placeholder={`Ej. ${catalog.label} principal`} />
                    </Form.Item>
                    <Form.Item<CatalogItemFormValues> label="Detalle" name="detail">
                        <Input.TextArea rows={3} maxLength={500} showCount placeholder="Detalle operativo visible para administración." />
                    </Form.Item>
                </CatalogFormSection>
                <div className="catalog-items-modal__grid">
                    <CatalogFormSection projectView={projectView} title="NetSuite">
                        <Form.Item<CatalogItemFormValues> label="ID NetSuite" name="netsuiteId">
                            <Input />
                        </Form.Item>
                    </CatalogFormSection>
                    <CatalogFormSection projectView={projectView} title="Odoo">
                        <Form.Item<CatalogItemFormValues> label="ID Odoo" name="odooId">
                            <Input />
                        </Form.Item>
                    </CatalogFormSection>
                </div>
                <CatalogFormSection projectView={projectView} title="Auditoría">
                    <Form.Item<CatalogItemFormValues>
                        label="Motivo de auditoría"
                        name="reason"
                        rules={[
                            { min: MIN_REASON_LENGTH, message: "Agrega un motivo auditable de al menos 5 caracteres." },
                            { required: true, message: "El motivo es obligatorio." },
                        ]}
                    >
                        <Input.TextArea rows={4} maxLength={255} showCount placeholder="Ej. Alta autorizada por jefatura." />
                    </Form.Item>
                </CatalogFormSection>
            </Form>
        </Modal>
    );
}

/**
 * Confirmación de activar o inactivar.
 *
 * El botón permanece deshabilitado hasta que el motivo alcanza el mínimo:
 * el API rechazaría un cambio sin texto auditable.
 */
function CatalogStatusModal({ action, isSaving, onClose, onReasonChange, onSubmit, reason, projectView }: { readonly action: StatusAction | null; readonly isSaving: boolean; readonly onClose: () => void; readonly onReasonChange: (value: string) => void; readonly onSubmit: () => void; readonly reason: string; readonly projectView: boolean }) {
    return (
        <Modal
            centered
            destroyOnHidden
            className={`catalog-items-modal${projectView ? " catalog-items-modal--projects" : ""}`}
            footer={
                <div className="catalog-items-modal__footer">
                    <Button disabled={isSaving} onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button type="primary" danger={action?.status === "inactive"} disabled={reason.trim().length < MIN_REASON_LENGTH} loading={isSaving} onClick={onSubmit}>
                        <SaveOutlined />
                        Confirmar acción
                    </Button>
                </div>
            }
            open={action !== null}
            title={
                <div className="catalog-items-modal__title">
                    <h2>{action?.status === "inactive" ? "Inactivar valor" : "Reactivar valor"}</h2>
                    <p>{action ? `Se actualizará ${action.item.name}.` : "Confirma el cambio de estado."}</p>
                </div>
            }
            zIndex={ADMINISTRATION_MODAL_Z_INDEX}
            onCancel={onClose}
        >
            {action ? (
                <div className="catalog-items-summary">
                    <strong>Resumen efectivo</strong>
                    <span>
                        Estado: {STATUS_LABELS[action.item.status]} -&gt; {STATUS_LABELS[action.status]}
                    </span>
                </div>
            ) : null}
            <label className="catalog-items-label" htmlFor="catalog-status-reason">
                Motivo de auditoría *
            </label>
            <Input.TextArea
                id="catalog-status-reason"
                rows={4}
                maxLength={255}
                showCount
                autoFocus
                value={reason}
                placeholder="Ej. Cambio autorizado por jefatura."
                onChange={(event) => {
                    onReasonChange(event.target.value);
                }}
            />
        </Modal>
    );
}

function CatalogLoadState({ error, isLoading, projectView, hasMore, isLoadingMore, loaded, total, onLoadMore }: { readonly error: string | null; readonly isLoading: boolean; readonly projectView: boolean; readonly hasMore: boolean; readonly isLoadingMore: boolean; readonly loaded: number; readonly total: number; readonly onLoadMore: () => void }) {
    return (
        <>
            {error ? (
                <div className="catalog-items-error" role="alert">
                    {error}
                </div>
            ) : null}
            {isLoading && !projectView ? <div role="status">Cargando catálogo…</div> : null}
            {hasMore ? (
                <div className="catalog-items-toolbar">
                    <span>
                        {loaded} de {total} valores cargados
                    </span>
                    <Button aria-label="Cargar más" loading={isLoadingMore} disabled={isLoading} onClick={onLoadMore}>
                        Cargar más
                    </Button>
                </div>
            ) : null}
        </>
    );
}

/** Domain-aware header actions; block refresh while a request or mutation is active. */
function CatalogHeaderActions({ catalogCode, isLoading, isLoadingMore, isSaving, isSavingStatus, onRefresh, onCreate }: { readonly catalogCode: string; readonly isLoading: boolean; readonly isLoadingMore: boolean; readonly isSaving: boolean; readonly isSavingStatus: boolean; readonly onRefresh: () => void; readonly onCreate: () => void }) {
    return (
        <div className="global-home-page-header__actions">
            {catalogCode === "projects" && (
                <Tooltip title="Actualizar proyectos">
                    <Button className="projects-view-refresh" aria-label="Actualizar proyectos" icon={<ReloadOutlined spin={isLoading} />} disabled={isLoading || isLoadingMore || isSaving || isSavingStatus} onClick={onRefresh} />
                </Tooltip>
            )}
            <button className="global-home-page-header__primary" type="button" onClick={onCreate}>
                <PlusOutlined />
                {catalogCode === "projects" ? "Nuevo proyecto" : "Nuevo valor"}
            </button>
        </div>
    );
}

/** Projects announce list updates without changing sibling catalogs' presentation. */
function CatalogListPanel({ catalog, isLoading, isLoadingMore, children }: { readonly catalog: AdministrationCatalogDefinition; readonly isLoading: boolean; readonly isLoadingMore: boolean; readonly children: ReactNode }) {
    return (
        <section className="catalog-items-panel" aria-label={`Listado de ${catalog.label}`} aria-busy={catalog.code === "projects" ? isLoading || isLoadingMore : undefined}>
            {children}
        </section>
    );
}

/** Pantalla administrativa scoped por catalogo y modulo autorizado. */
export function CatalogItemsPage({ catalog, contextLabel = "Administración", contextModuleCode = "administration" }: CatalogItemsPageProps) {
    const [error, setError] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [items, setItems] = useState<readonly CatalogItem[]>([]);
    const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingStatus, setIsSavingStatus] = useState(false);
    const [pendingStatusAction, setPendingStatusAction] = useState<StatusAction | null>(null);
    const [reason, setReason] = useState("");
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const nextOffset = useRef(0);
    const loadingMore = useRef(false);
    const [selection, setSelection] = useState<{ publicId: string; catalogCode: string; context: string; open: boolean } | null>(null);
    const isDetailOpen = selection?.catalogCode === catalog.code && selection.context === contextModuleCode && selection.open;
    const selectedItem = items.find((item) => item.publicId === selection?.publicId) ?? null;
    const selectedIndex = items.findIndex((item) => item === selectedItem);
    // A late response from an older filter/context must not replace the visible details.
    const loadSequence = useRef(0);

    const loadItems = useCallback(() => {
        const sequence = ++loadSequence.current;
        setIsLoading(true);
        setError(null);
        nextOffset.current = 0;
        loadingMore.current = false;
        setIsLoadingMore(false);
        void listCatalogItems(catalog.code, { limit: 100, moduleCode: contextModuleCode, status: "all" })
            .then((response) => {
                if (sequence !== loadSequence.current) return;
                setItems(response.items);
                nextOffset.current = response.items.length;
                setTotal(response.total);
                setHasMore(nextOffset.current < response.total);
            })
            .catch((loadError: unknown) => {
                if (sequence !== loadSequence.current) return;
                setError(getApiErrorMessage(loadError, "No pudimos cargar el catálogo."));
            })
            .finally(() => {
                if (sequence !== loadSequence.current) return;
                setIsLoading(false);
            });
    }, [catalog.code, contextModuleCode]);

    const loadMore = (): void => {
        if (loadingMore.current || isLoading || nextOffset.current >= total) return;
        const sequence = loadSequence.current;
        loadingMore.current = true;
        setIsLoadingMore(true);
        setError(null);
        void listCatalogItems(catalog.code, { limit: 100, offset: nextOffset.current, moduleCode: contextModuleCode, status: "all" })
            .then((response) => {
                if (sequence !== loadSequence.current) return;
                if (response.items.length === 0 && nextOffset.current < response.total) throw new Error("Catalog pagination did not advance");
                nextOffset.current += response.items.length;
                setItems((current) => {
                    const known = new Set(current.map((item) => item.publicId));
                    return [...current, ...response.items.filter((item) => !known.has(item.publicId))];
                });
                setTotal(response.total);
                setHasMore(nextOffset.current < response.total);
            })
            .catch(() => {
                if (sequence === loadSequence.current) setError("No pudimos cargar más valores. Intenta nuevamente.");
            })
            .finally(() => {
                if (sequence === loadSequence.current) {
                    loadingMore.current = false;
                    setIsLoadingMore(false);
                }
            });
    };

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Reload the initial batch when the catalog or authorized module changes.
        loadItems();
        return () => {
            // eslint-disable-next-line react-hooks/exhaustive-deps -- Invalidate the latest request counter, not a captured DOM ref.
            loadSequence.current++;
        };
    }, [loadItems]);

    const openCreate = (): void => {
        setFormError(null);
        setEditingItem(null);
        setIsFormOpen(true);
    };

    const openEdit = (item: CatalogItem): void => {
        setFormError(null);
        setEditingItem(item);
        setIsFormOpen(true);
    };

    const closeForm = (): void => {
        if (isSaving) {
            return;
        }

        setIsFormOpen(false);
        setEditingItem(null);
        setFormError(null);
    };

    const submitForm = (payload: CatalogItemFormPayload): void => {
        setIsSaving(true);
        setFormError(null);
        const scopedPayload = { ...payload, moduleCode: contextModuleCode };
        const request = editingItem ? updateCatalogItem(catalog.code, editingItem.publicId, scopedPayload) : createCatalogItem(catalog.code, scopedPayload);

        void request
            .then(() => {
                setIsFormOpen(false);
                setEditingItem(null);
                void message.success(`${catalog.label} guardado y auditado.`);
                loadItems();
            })
            .catch((saveError: unknown) => {
                setFormError(getApiErrorMessage(saveError, "No pudimos guardar el catálogo. Revisa permisos, duplicados y motivo de auditoría."));
            })
            .finally(() => {
                setIsSaving(false);
            });
    };

    const openStatusAction = (item: CatalogItem, status: CatalogItemStatus): void => {
        setReason("");
        setPendingStatusAction({ item, status });
    };

    const closeStatusAction = (): void => {
        if (isSavingStatus) {
            return;
        }

        setPendingStatusAction(null);
        setReason("");
    };

    const submitStatusAction = (): void => {
        if (!pendingStatusAction) {
            return;
        }

        setIsSavingStatus(true);
        void updateCatalogItemStatus(catalog.code, pendingStatusAction.item.publicId, { moduleCode: contextModuleCode, reason: reason.trim(), status: pendingStatusAction.status })
            .then(() => {
                void message.success(`${pendingStatusAction.item.name} actualizado.`);
                closeStatusAction();
                loadItems();
            })
            .catch(() => {
                void message.error("No pudimos actualizar el estado del catálogo.");
            })
            .finally(() => {
                setIsSavingStatus(false);
            });
    };

    return (
        <ConfigProvider theme={ADMINISTRATION_THEME}>
            <div className={`global-home-dashboard catalog-items-page catalog-items-page--${catalog.code}`}>
                <section className="global-home-page-header administration-users-page-header" aria-labelledby="catalog-items-page-title">
                    <div>
                        <nav className="administration-users-breadcrumb" aria-label="Ruta">
                            <span>{contextLabel}</span>
                            <span aria-hidden="true">/</span>
                            <span>Catálogos</span>
                            <span aria-hidden="true">/</span>
                            <span>{catalog.label}</span>
                        </nav>
                        <h1 id="catalog-items-page-title">{catalog.label}</h1>
                        <p>Gestión de valores nativos CRM y sus referencias externas.</p>
                    </div>
                    <CatalogHeaderActions catalogCode={catalog.code} isLoading={isLoading} isLoadingMore={isLoadingMore} isSaving={isSaving} isSavingStatus={isSavingStatus} onRefresh={loadItems} onCreate={openCreate} />
                </section>

                <CatalogListPanel catalog={catalog} isLoading={isLoading} isLoadingMore={isLoadingMore}>
                    <CatalogItemsDataTable
                        projectView={catalog.code === "projects"}
                        key={`${contextModuleCode}:${catalog.code}`}
                        items={items}
                        label={catalog.label}
                        isLoading={isLoading}
                        storageKey={`rocca.${contextModuleCode}.catalogs.${catalog.code}.datatable.v1`}
                        selectedPublicId={isDetailOpen ? selection.publicId : null}
                        onEdit={openEdit}
                        onStatusAction={openStatusAction}
                        onSelect={(item) => {
                            setSelection({ publicId: item.publicId, catalogCode: catalog.code, context: contextModuleCode, open: true });
                        }}
                    />
                    <CatalogLoadState error={error} isLoading={isLoading} projectView={catalog.code === "projects"} hasMore={hasMore} isLoadingMore={isLoadingMore} loaded={items.length} total={total} onLoadMore={loadMore} />
                </CatalogListPanel>

                <CatalogItemDetailDrawer
                    projectView={catalog.code === "projects"}
                    catalogLabel={catalog.label}
                    error={error}
                    isLoading={isLoading}
                    item={selectedItem}
                    open={isDetailOpen}
                    position={selectedIndex + 1}
                    total={items.length}
                    onSelectPrevious={() => {
                        const previous = items[selectedIndex - 1];
                        if (previous) setSelection({ publicId: previous.publicId, catalogCode: catalog.code, context: contextModuleCode, open: true });
                    }}
                    onSelectNext={() => {
                        const next = items[selectedIndex + 1];
                        if (next) setSelection({ publicId: next.publicId, catalogCode: catalog.code, context: contextModuleCode, open: true });
                    }}
                    onClose={() => {
                        setSelection((current) => (current ? { ...current, open: false } : null));
                    }}
                    onEdit={openEdit}
                    onRefresh={loadItems}
                    onStatusAction={openStatusAction}
                />
                <CatalogItemModal catalog={catalog} error={formError} initialItem={editingItem} isSaving={isSaving} open={isFormOpen} onClose={closeForm} onSubmit={submitForm} />
                <CatalogStatusModal action={pendingStatusAction} isSaving={isSavingStatus} reason={reason} onClose={closeStatusAction} onReasonChange={setReason} onSubmit={submitStatusAction} projectView={catalog.code === "projects"} />
            </div>
        </ConfigProvider>
    );
}
